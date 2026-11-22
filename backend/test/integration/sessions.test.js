const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const jwt = require('jsonwebtoken');
const { startTestServer } = require('../helpers/server');
const { User, Session } = require('../../src/models');

// Short-lived access tokens + rotating refresh tokens, sign-out, session
// revocation, and lock-out after repeated wrong passwords.

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

const login = async (email, password = api.PASSWORD) => {
  const res = await api.request('POST', '/api/auth/login', { json: { email, password } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const me = (token) => api.request('GET', '/api/auth/me', { token });
const refresh = (refreshToken) => api.request('POST', '/api/auth/refresh', { json: { refreshToken } });

test('signing in returns a short-lived access token and a refresh token', async () => {
  const { email } = await api.createUser('citizen');
  const body = await login(email);
  assert.equal(typeof body.refreshToken, 'string');
  assert.ok(body.refreshToken.length >= 40);
  assert.equal(body.expiresIn, 15 * 60);
  const claims = jwt.verify(body.token, process.env.JWT_SECRET);
  assert.ok(claims.sid, 'access token names its session');
  assert.equal((await me(body.token)).status, 200);
});

test('registering also starts a session', async () => {
  const res = await api.request('POST', '/api/auth/register', {
    json: { name: 'New Person', email: 'New.Person@Example.test', password: 'long-enough-1' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'new.person@example.test', 'emails are stored lower-case');
  assert.equal(typeof res.body.refreshToken, 'string');

  // Signing in works with any capitalisation.
  const again = await api.request('POST', '/api/auth/login', {
    json: { email: 'NEW.PERSON@example.test', password: 'long-enough-1' },
  });
  assert.equal(again.status, 200);
});

test('an expired access token is reported as TOKEN_EXPIRED and the refresh token renews it', async () => {
  const { email, user } = await api.createUser('citizen');
  const body = await login(email);
  const { sid } = jwt.decode(body.token);
  const expired = jwt.sign(
    { userId: user.id, role: 'citizen', sid, exp: Math.floor(Date.now() / 1000) - 5 },
    process.env.JWT_SECRET
  );
  const res = await me(expired);
  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_EXPIRED');

  const renewed = await refresh(body.refreshToken);
  assert.equal(renewed.status, 200);
  assert.notEqual(renewed.body.refreshToken, body.refreshToken, 'refresh tokens rotate');
  assert.equal(jwt.decode(renewed.body.token).sid, sid, 'same session continues');
  assert.equal((await me(renewed.body.token)).status, 200);
});

test('reusing an old refresh token ends every session of that account', async () => {
  const { email } = await api.createUser('citizen');
  const phone = await login(email);
  const laptop = await login(email);

  const first = await refresh(phone.refreshToken);
  assert.equal(first.status, 200);

  // Someone replays the original (already rotated) refresh token.
  const replay = await refresh(phone.refreshToken);
  assert.equal(replay.status, 401);
  assert.match(replay.body.message, /used from somewhere else/);

  assert.equal((await me(first.body.token)).status, 401);
  assert.equal((await me(laptop.token)).status, 401);
  assert.equal((await refresh(first.body.refreshToken)).status, 401);
});

test('signing out ends the session at once', async () => {
  const { email } = await api.createUser('citizen');
  const body = await login(email);
  const out = await api.request('POST', '/api/auth/logout', { token: body.token, json: { refreshToken: body.refreshToken } });
  assert.equal(out.status, 200);

  const after = await me(body.token);
  assert.equal(after.status, 401);
  assert.equal(after.body.code, 'SESSION_ENDED');
  assert.equal((await refresh(body.refreshToken)).status, 401);
});

test('signing out with only the access token also works', async () => {
  const { email } = await api.createUser('citizen');
  const body = await login(email);
  await api.request('POST', '/api/auth/logout', { token: body.token, json: {} });
  assert.equal((await me(body.token)).status, 401);
});

test('"sign out everywhere" ends all sessions', async () => {
  const { email } = await api.createUser('staff');
  const a = await login(email);
  const b = await login(email);
  const res = await api.request('POST', '/api/auth/logout-all', { token: a.token });
  assert.equal(res.status, 200);
  // a, b, and the session createUser itself signed in with.
  assert.equal(res.body.sessions, 3);
  assert.equal((await me(a.token)).status, 401);
  assert.equal((await me(b.token)).status, 401);
});

test('changing your password signs out your other devices but not this one', async () => {
  const { email } = await api.createUser('citizen');
  const here = await login(email);
  const elsewhere = await login(email);
  const res = await api.request('POST', '/api/auth/change-password', {
    token: here.token,
    json: { currentPassword: api.PASSWORD, newPassword: 'a-new-password-9' },
  });
  assert.equal(res.status, 200);
  // "elsewhere" and the session createUser itself signed in with.
  assert.equal(res.body.signedOutSessions, 2);
  assert.equal((await me(here.token)).status, 200);
  assert.equal((await me(elsewhere.token)).status, 401);
});

test('an admin password reset signs the person out everywhere', async () => {
  const officer = await api.createUser('staff');
  const admin = await api.createUser('admin');
  const session = await login(officer.email);
  const res = await api.request('POST', `/api/auth/users/${officer.user.id}/reset-password`, { token: admin.token });
  assert.equal(res.status, 200);
  assert.equal((await me(session.token)).status, 401);
});

test('five wrong passwords lock the account for a while, even for the right password', async () => {
  const { email, user } = await api.createUser('citizen');
  for (let i = 0; i < 5; i += 1) {
    const res = await api.request('POST', '/api/auth/login', { json: { email, password: 'wrong-password' } });
    assert.equal(res.status, 401);
  }
  const locked = await api.request('POST', '/api/auth/login', { json: { email, password: api.PASSWORD } });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.code, 'ACCOUNT_LOCKED');
  assert.match(locked.body.message, /Try again in 15 minutes/);

  // After the lock-out period, the right password works and the counter resets.
  await User.update({ locked_until: new Date(Date.now() - 1000) }, { where: { id: user.id } });
  assert.equal((await api.request('POST', '/api/auth/login', { json: { email, password: api.PASSWORD } })).status, 200);
  const fresh = await User.findByPk(user.id);
  assert.equal(fresh.failed_logins, 0);
  assert.equal(fresh.locked_until, null);
});

test('a successful sign-in clears earlier wrong attempts', async () => {
  const { email, user } = await api.createUser('citizen');
  for (let i = 0; i < 3; i += 1) {
    await api.request('POST', '/api/auth/login', { json: { email, password: 'wrong-password' } });
  }
  await login(email);
  assert.equal((await User.findByPk(user.id)).failed_logins, 0);
});

test('sessions record the device and are removed with the account', async () => {
  const { email, user } = await api.createUser('citizen');
  await api.request('POST', '/api/auth/login', {
    json: { email, password: api.PASSWORD },
    headers: { 'User-Agent': 'CivicFix-Test/1.0' },
  });
  const session = await Session.findOne({ where: { user_id: user.id }, order: [['created_at', 'DESC']] });
  assert.equal(session.user_agent, 'CivicFix-Test/1.0');
  assert.equal(session.method, 'password');
  await User.destroy({ where: { id: user.id } });
  assert.equal(await Session.count({ where: { user_id: user.id } }), 0);
});

test('sign-in endpoints have their own per-address limit', () => {
  const script = `
    const { createApp } = require('./src/app');
    const server = createApp().listen(0, async () => {
      const url = 'http://127.0.0.1:' + server.address().port + '/api/auth/login';
      const statuses = [];
      for (let i = 0; i < 4; i += 1) {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'nobody@example.test', password: 'x' }) });
        statuses.push(res.status);
      }
      const other = await fetch('http://127.0.0.1:' + server.address().port + '/api/issues/categories');
      console.log(JSON.stringify({ statuses, other: other.status }));
      process.exit(0);
    });
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, AUTH_RATE_LIMIT_MAX: '3' },
    encoding: 'utf8',
  });
  const out = JSON.parse(result.stdout.trim().split('\n').pop());
  assert.deepEqual(out.statuses, [401, 401, 401, 429], result.stderr);
  assert.equal(out.other, 200, 'the rest of the API is unaffected');
});
