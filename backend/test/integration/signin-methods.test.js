const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

// A fake Google: the real sign-in code talks to it exactly as it would talk to
// Google (token endpoint + published signing keys), with ID tokens signed by a
// key made for this test run.
const GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'test-client-secret';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const attackerKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

let googleServer;
let googleUrl;
let nextIdentity; // what the fake Google says about the next person
let lastTokenRequest;

const makeIdToken = (claims, { key = privateKey } = {}) =>
  jwt.sign(
    {
      iss: 'https://accounts.google.com',
      aud: GOOGLE_CLIENT_ID,
      email_verified: true,
      ...claims,
    },
    key,
    { algorithm: 'RS256', keyid: 'test-key', expiresIn: claims.exp ? undefined : '5m' }
  );

before(async () => {
  const google = express();
  google.use(express.urlencoded({ extended: false }));
  google.post('/token', (req, res) => {
    lastTokenRequest = req.body;
    if (req.body.client_secret !== GOOGLE_CLIENT_SECRET || req.body.code !== 'good-code') {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    return res.json({ id_token: nextIdentity() });
  });
  google.get('/certs', (req, res) =>
    res.json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' }] })
  );
  await new Promise((resolve) => {
    googleServer = google.listen(0, '127.0.0.1', resolve);
  });
  googleUrl = `http://127.0.0.1:${googleServer.address().port}`;

  Object.assign(process.env, {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_AUTH_URL: `${googleUrl}/authorize`,
    GOOGLE_TOKEN_URL: `${googleUrl}/token`,
    GOOGLE_JWKS_URL: `${googleUrl}/certs`,
    TEST_OTP_PHONE: '+919999900000',
    TEST_OTP_CODE: '424242',
  });
});

const { startTestServer } = require('../helpers/server');
const { User, OtpCode } = require('../../src/models');
const { outbox } = require('../../src/services/notify');

let api;
before(async () => { api = await startTestServer(); });
after(async () => {
  await api.close();
  googleServer.close();
});
beforeEach(() => { outbox.length = 0; });

const lastMessage = (kind, to) => [...outbox].reverse().find((m) => m.kind === kind && m.to === to);
const codeIn = (message) => message && message.text.match(/\b(\d{6})\b/)[1];
// Lets a test ask for another code without waiting out the 60-second cooldown.
const skipCooldown = (target) =>
  OtpCode.update({ created_at: new Date(Date.now() - 5 * 60 * 1000) }, { where: { target }, silent: true });

test('the server lists which sign-in methods are available', async () => {
  const res = await api.request('GET', '/api/auth/providers');
  assert.deepEqual(res.body, { password: true, google: true, phone: true, passwordReset: true });
});

// ---------------------------------------------------------------- forgot password

test('forgot password: an emailed code resets the password and signs out every device', async () => {
  const { email } = await api.createUser('citizen');
  const oldSession = (await api.request('POST', '/api/auth/login', { json: { email, password: api.PASSWORD } })).body;

  const forgot = await api.request('POST', '/api/auth/password/forgot', { json: { email } });
  assert.equal(forgot.status, 200);
  const message = lastMessage('email', email);
  assert.ok(message, 'reset email sent');
  assert.match(message.text, /password reset code is \d{6}/);
  const code = codeIn(message);

  const wrong = await api.request('POST', '/api/auth/password/reset', {
    json: { email, code: code === '000000' ? '111111' : '000000', newPassword: 'brand-new-pass-1' },
  });
  assert.equal(wrong.status, 400);

  const ok = await api.request('POST', '/api/auth/password/reset', { json: { email, code, newPassword: 'brand-new-pass-1' } });
  assert.equal(ok.status, 200);

  assert.equal((await api.request('POST', '/api/auth/login', { json: { email, password: api.PASSWORD } })).status, 401);
  assert.equal((await api.request('POST', '/api/auth/login', { json: { email, password: 'brand-new-pass-1' } })).status, 200);
  assert.equal((await api.request('GET', '/api/auth/me', { token: oldSession.token })).status, 401);

  const reuse = await api.request('POST', '/api/auth/password/reset', { json: { email, code, newPassword: 'another-pass-22' } });
  assert.equal(reuse.status, 400, 'a code works once');
});

test('forgot password answers the same for unknown emails and sends nothing', async () => {
  const res = await api.request('POST', '/api/auth/password/forgot', { json: { email: 'nobody@example.test' } });
  assert.equal(res.status, 200);
  assert.match(res.body.message, /If an account exists/);
  assert.equal(outbox.length, 0);
});

test('forgot password also unlocks a locked account', async () => {
  const { email, user } = await api.createUser('citizen');
  await User.update({ locked_until: new Date(Date.now() + 10 * 60000) }, { where: { id: user.id } });
  await api.request('POST', '/api/auth/password/forgot', { json: { email } });
  const code = codeIn(lastMessage('email', email));
  await api.request('POST', '/api/auth/password/reset', { json: { email, code, newPassword: 'unlocked-pass-1' } });
  assert.equal((await api.request('POST', '/api/auth/login', { json: { email, password: 'unlocked-pass-1' } })).status, 200);
});

test('a reset code stops working after five wrong tries', async () => {
  const { email } = await api.createUser('citizen');
  await api.request('POST', '/api/auth/password/forgot', { json: { email } });
  const code = codeIn(lastMessage('email', email));
  const wrong = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i += 1) {
    await api.request('POST', '/api/auth/password/reset', { json: { email, code: wrong, newPassword: 'whatever-pass-1' } });
  }
  const res = await api.request('POST', '/api/auth/password/reset', { json: { email, code, newPassword: 'whatever-pass-1' } });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Too many wrong codes/);
});

test('asking again within a minute does not send another email', async () => {
  const { email } = await api.createUser('citizen');
  await api.request('POST', '/api/auth/password/forgot', { json: { email } });
  await api.request('POST', '/api/auth/password/forgot', { json: { email } });
  assert.equal(outbox.filter((m) => m.to === email).length, 1);
});

// ---------------------------------------------------------------- phone + SMS code

test('phone sign-in: a new number creates a citizen account after the SMS code', async () => {
  const phone = '+919876500001';
  const sent = await api.request('POST', '/api/auth/otp/request', { json: { phone } });
  assert.equal(sent.status, 200);
  const code = codeIn(lastMessage('sms', phone));
  assert.match(lastMessage('sms', phone).text, /CivicFix sign-in code/);

  const noName = await api.request('POST', '/api/auth/otp/verify', { json: { phone, code } });
  assert.equal(noName.status, 400);
  assert.equal(noName.body.code, 'NAME_REQUIRED');

  const created = await api.request('POST', '/api/auth/otp/verify', { json: { phone, code, name: 'Lakshmi' } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.user.phone, phone);
  assert.equal(created.body.user.role, 'citizen');
  assert.equal(created.body.user.email, null);
  assert.equal(created.body.user.has_password, false);
  assert.equal(typeof created.body.refreshToken, 'string');

  // The same number signs in to the same account next time.
  await skipCooldown(phone);
  await api.request('POST', '/api/auth/otp/request', { json: { phone } });
  const again = await api.request('POST', '/api/auth/otp/verify', {
    json: { phone, code: codeIn(lastMessage('sms', phone)) },
  });
  assert.equal(again.status, 200);
  assert.equal(again.body.user.id, created.body.user.id);
});

test('phone sign-in rejects badly formatted numbers and wrong codes', async () => {
  assert.equal((await api.request('POST', '/api/auth/otp/request', { json: { phone: '9876543210' } })).status, 400);

  const phone = '+919876500002';
  await api.request('POST', '/api/auth/otp/request', { json: { phone } });
  const code = codeIn(lastMessage('sms', phone));
  const wrong = await api.request('POST', '/api/auth/otp/verify', {
    json: { phone, code: code === '000000' ? '111111' : '000000', name: 'X' },
  });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.message, /not correct/);
});

test('a new code cannot be requested within 60 seconds', async () => {
  const phone = '+919876500003';
  assert.equal((await api.request('POST', '/api/auth/otp/request', { json: { phone } })).status, 200);
  const second = await api.request('POST', '/api/auth/otp/request', { json: { phone } });
  assert.equal(second.status, 429);
  assert.ok(second.body.retryAfter > 0);
});

test('only the newest code is valid', async () => {
  const phone = '+919876500004';
  await api.request('POST', '/api/auth/otp/request', { json: { phone } });
  const first = codeIn(lastMessage('sms', phone));
  await skipCooldown(phone);
  await api.request('POST', '/api/auth/otp/request', { json: { phone } });
  const second = codeIn(lastMessage('sms', phone));
  if (first !== second) {
    const old = await api.request('POST', '/api/auth/otp/verify', { json: { phone, code: first, name: 'Y' } });
    assert.equal(old.status, 400);
  }
  assert.equal((await api.request('POST', '/api/auth/otp/verify', { json: { phone, code: second, name: 'Y' } })).status, 201);
});

test('a configured test phone number uses its fixed code and sends no SMS', async () => {
  const phone = process.env.TEST_OTP_PHONE;
  assert.equal((await api.request('POST', '/api/auth/otp/request', { json: { phone } })).status, 200);
  assert.equal(lastMessage('sms', phone), undefined);
  const res = await api.request('POST', '/api/auth/otp/verify', { json: { phone, code: process.env.TEST_OTP_CODE, name: 'Reviewer' } });
  assert.ok([200, 201].includes(res.status), JSON.stringify(res.body));
});

test('a phone-only account can set a password without a current one', async () => {
  const phone = '+919876500005';
  await api.request('POST', '/api/auth/otp/request', { json: { phone } });
  const { token } = (await api.request('POST', '/api/auth/otp/verify', {
    json: { phone, code: codeIn(lastMessage('sms', phone)), name: 'Phone Only' },
  })).body;
  const res = await api.request('POST', '/api/auth/change-password', { token, json: { newPassword: 'first-password-1' } });
  assert.equal(res.status, 200);
  const me = await api.request('GET', '/api/auth/me', { token });
  assert.equal(me.body.user.has_password, true);
});

// ---------------------------------------------------------------- Google

const startGoogle = async (client) => {
  const res = await fetch(`${api.baseUrl}/api/auth/google/start?client=${client}`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location'));
  assert.equal(location.origin + location.pathname, `${googleUrl}/authorize`);
  return location.searchParams;
};

const finishGoogle = async (params, code = 'good-code') => {
  const url = `${api.baseUrl}/api/auth/google/callback?code=${code}&state=${encodeURIComponent(params.get('state'))}`;
  const res = await fetch(url, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') };
};

const exchange = (code) => api.request('POST', '/api/auth/google/exchange', { json: { code } });

test('Google sign-in sends the person to Google with our client id and callback', async () => {
  const params = await startGoogle('app');
  assert.equal(params.get('client_id'), GOOGLE_CLIENT_ID);
  assert.equal(params.get('redirect_uri'), `${api.baseUrl}/api/auth/google/callback`);
  assert.equal(params.get('scope'), 'openid email profile');
  assert.ok(params.get('state'));
  assert.ok(params.get('nonce'));
});

test('Google sign-in from the app creates a citizen and hands over a session', async () => {
  const params = await startGoogle('app');
  nextIdentity = () => makeIdToken({ sub: 'google-1001', email: 'Priya@Gmail.example', name: 'Priya', nonce: params.get('nonce') });

  const { status, location } = await finishGoogle(params);
  assert.equal(status, 302);
  assert.match(location, /^civicfix:\/\/auth\?google_code=/);
  assert.equal(lastTokenRequest.redirect_uri, `${api.baseUrl}/api/auth/google/callback`);

  const code = new URL(location).searchParams.get('google_code');
  const res = await exchange(code);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.user.email, 'priya@gmail.example');
  assert.equal(res.body.user.role, 'citizen');
  assert.equal(typeof res.body.refreshToken, 'string');

  assert.equal((await exchange(code)).status, 400, 'a hand-over code works once');
});

test('Google sign-in links to an existing account with the same email', async () => {
  const { email, user } = await api.createUser('citizen');
  const params = await startGoogle('app');
  nextIdentity = () => makeIdToken({ sub: 'google-2002', email, name: 'Whoever', nonce: params.get('nonce') });
  const { location } = await finishGoogle(params);
  const res = await exchange(new URL(location).searchParams.get('google_code'));
  assert.equal(res.body.user.id, user.id);
  assert.equal((await User.findByPk(user.id)).google_id, 'google-2002');
});

test('in the admin portal, Google sign-in works for staff and is refused for citizens', async () => {
  const staff = await api.createUser('staff');
  let params = await startGoogle('admin');
  nextIdentity = () => makeIdToken({ sub: 'google-3003', email: staff.email, name: 'Officer', nonce: params.get('nonce') });
  let result = await finishGoogle(params);
  assert.match(result.location, /^http:\/\/admin\.test\/login\?google_code=/);
  const res = await exchange(new URL(result.location).searchParams.get('google_code'));
  assert.equal(res.body.user.role, 'staff');

  params = await startGoogle('admin');
  nextIdentity = () => makeIdToken({ sub: 'google-4004', email: 'stranger@gmail.example', name: 'Stranger', nonce: params.get('nonce') });
  result = await finishGoogle(params);
  assert.equal(result.location, 'http://admin.test/login?error=not_staff');
  assert.equal(await User.count({ where: { email: 'stranger@gmail.example' } }), 0, 'no account is created from the admin portal');
});

for (const [label, identity] of [
  ['signed with the wrong key', (nonce) => makeIdToken({ sub: 'x1', email: 'a@gmail.example', nonce }, { key: attackerKey })],
  ['for another app (audience)', (nonce) => makeIdToken({ sub: 'x2', email: 'b@gmail.example', nonce, aud: 'someone-else' })],
  ['from another issuer', (nonce) => makeIdToken({ sub: 'x3', email: 'c@gmail.example', nonce, iss: 'https://evil.example' })],
  ['with an unverified email', (nonce) => makeIdToken({ sub: 'x4', email: 'd@gmail.example', nonce, email_verified: false })],
  ['with the wrong nonce (replayed)', () => makeIdToken({ sub: 'x5', email: 'e@gmail.example', nonce: 'other-nonce' })],
  ['that has expired', (nonce) => makeIdToken({ sub: 'x6', email: 'f@gmail.example', nonce, exp: Math.floor(Date.now() / 1000) - 60 })],
]) {
  test(`Google sign-in rejects an ID token ${label}`, async () => {
    const params = await startGoogle('app');
    nextIdentity = () => identity(params.get('nonce'));
    const { location } = await finishGoogle(params);
    assert.equal(location, 'civicfix://auth?error=google_failed');
  });
}

test('Google sign-in rejects a bad code and a forged state', async () => {
  const params = await startGoogle('app');
  assert.equal((await finishGoogle(params, 'bad-code')).location, 'civicfix://auth?error=google_failed');

  const forged = jwt.sign({ client: 'app', nonce: 'n', purpose: 'google_state' }, 'not-our-secret');
  const res = await fetch(`${api.baseUrl}/api/auth/google/callback?code=good-code&state=${forged}`, { redirect: 'manual' });
  assert.equal(res.status, 400);
});

test('cancelling on Google returns to the app with an error', async () => {
  const params = await startGoogle('app');
  const res = await fetch(
    `${api.baseUrl}/api/auth/google/callback?error=access_denied&state=${encodeURIComponent(params.get('state'))}`,
    { redirect: 'manual' }
  );
  assert.equal(res.headers.get('location'), 'civicfix://auth?error=cancelled');
});

test('without Google credentials the option is off', async () => {
  const saved = process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_SECRET;
  try {
    assert.equal((await api.request('GET', '/api/auth/providers')).body.google, false);
    assert.equal((await fetch(`${api.baseUrl}/api/auth/google/start`, { redirect: 'manual' })).status, 404);
  } finally {
    process.env.GOOGLE_CLIENT_SECRET = saved;
  }
});
