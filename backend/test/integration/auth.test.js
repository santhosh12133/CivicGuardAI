const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startTestServer } = require('../helpers/server');

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

const newCitizen = (overrides = {}) => ({
  name: 'Asha Citizen',
  email: `asha.${Math.random().toString(36).slice(2)}@example.test`,
  password: 'a-long-password',
  ...overrides,
});

test('register creates a citizen and returns a token without the password', async () => {
  const payload = newCitizen();
  const res = await api.request('POST', '/api/auth/register', { json: payload });

  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, payload.email);
  assert.equal(res.body.user.role, 'citizen');
  assert.equal(res.body.user.password, undefined);
  assert.equal(typeof res.body.token, 'string');

  const claims = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(claims.userId, res.body.user.id);
  assert.equal(claims.role, 'citizen');
});

for (const role of ['staff', 'admin']) {
  test(`register refuses to create a ${role} account`, async () => {
    const res = await api.request('POST', '/api/auth/register', { json: newCitizen({ role }) });
    assert.equal(res.status, 400);
  });
}

test('register rejects a duplicate email with 409', async () => {
  const payload = newCitizen();
  assert.equal((await api.request('POST', '/api/auth/register', { json: payload })).status, 201);
  const res = await api.request('POST', '/api/auth/register', { json: payload });
  assert.equal(res.status, 409);
});

for (const [label, overrides] of [
  ['a missing name', { name: '' }],
  ['an invalid email', { email: 'not-an-email' }],
  ['a password under 8 characters', { password: 'short' }],
]) {
  test(`register rejects ${label} with 400`, async () => {
    const res = await api.request('POST', '/api/auth/register', { json: newCitizen(overrides) });
    assert.equal(res.status, 400);
    assert.ok(Array.isArray(res.body.errors));
  });
}

test('login returns a token for correct credentials', async () => {
  const { email } = await api.createUser('staff');
  const res = await api.request('POST', '/api/auth/login', { json: { email, password: api.PASSWORD } });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.role, 'staff');
  assert.equal(res.body.user.password, undefined);
  assert.equal(typeof res.body.token, 'string');
});

test('login gives the same 401 for a wrong password and an unknown email', async () => {
  const { email } = await api.createUser('citizen');
  const wrongPassword = await api.request('POST', '/api/auth/login', { json: { email, password: 'nope-nope-nope' } });
  const unknownEmail = await api.request('POST', '/api/auth/login', { json: { email: 'ghost@example.test', password: 'nope-nope-nope' } });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.deepEqual(wrongPassword.body, unknownEmail.body);
});

test('login validates its input', async () => {
  const res = await api.request('POST', '/api/auth/login', { json: { email: 'nope' } });
  assert.equal(res.status, 400);
});

test('GET /api/auth/users requires a token', async () => {
  const res = await api.request('GET', '/api/auth/users');
  assert.equal(res.status, 401);
});

for (const role of ['citizen', 'staff']) {
  test(`GET /api/auth/users is forbidden for ${role}`, async () => {
    const { token } = await api.createUser(role);
    const res = await api.request('GET', '/api/auth/users', { token });
    assert.equal(res.status, 403);
  });
}

test('GET /api/auth/users lists users for admin without password hashes', async () => {
  const { token } = await api.createUser('admin');
  const res = await api.request('GET', '/api/auth/users', { token });

  assert.equal(res.status, 200);
  assert.ok(res.body.count >= 1);
  assert.equal(res.body.users.length, res.body.count);
  for (const user of res.body.users) {
    assert.equal(user.password, undefined);
  }
});

test('a forged admin token (wrong secret) is rejected', async () => {
  const { user } = await api.createUser('citizen');
  const forged = jwt.sign({ userId: user.id, role: 'admin' }, 'not-the-server-secret-0123456789abcdef');
  const res = await api.request('GET', '/api/auth/users', { token: forged });
  assert.equal(res.status, 401);
});

test('an expired token is rejected', async () => {
  const { user } = await api.createUser('admin');
  const expired = jwt.sign(
    { userId: user.id, role: 'admin', exp: Math.floor(Date.now() / 1000) - 60 },
    process.env.JWT_SECRET
  );
  const res = await api.request('GET', '/api/auth/users', { token: expired });
  assert.equal(res.status, 401);
});
