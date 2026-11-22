const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRoles } = require('../../src/middleware/authMiddleware');

const SECRET = 'unit-test-secret-0123456789abcdef0123456789';
process.env.JWT_SECRET = SECRET;

const call = (middleware, req) => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; });
  return { res, nextCalled, req };
};

const withAuth = (value) => ({ method: 'GET', headers: value ? { authorization: value } : {} });

test('authenticateToken accepts a valid bearer token and exposes the claims', () => {
  const token = jwt.sign({ userId: 'u1', role: 'staff' }, SECRET, { expiresIn: '1h' });
  const { nextCalled, req } = call(authenticateToken, withAuth(`Bearer ${token}`));
  assert.equal(nextCalled, true);
  assert.equal(req.user.userId, 'u1');
  assert.equal(req.user.role, 'staff');
});

for (const [label, header] of [
  ['missing header', undefined],
  ['non-bearer scheme', 'Basic dXNlcjpwYXNz'],
  ['empty bearer', 'Bearer '],
]) {
  test(`authenticateToken rejects ${label} with 401`, () => {
    const { res, nextCalled } = call(authenticateToken, withAuth(header));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });
}

test('authenticateToken rejects an expired token', () => {
  const token = jwt.sign({ userId: 'u1', role: 'admin', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
  const { res, nextCalled } = call(authenticateToken, withAuth(`Bearer ${token}`));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('authenticateToken rejects a token signed with another secret', () => {
  const token = jwt.sign({ userId: 'u1', role: 'admin' }, 'attacker-secret-0123456789abcdef0123');
  const { res, nextCalled } = call(authenticateToken, withAuth(`Bearer ${token}`));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('authenticateToken rejects an unsigned (alg=none) token', () => {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: 'u1', role: 'admin' })}.`;
  const { res, nextCalled } = call(authenticateToken, withAuth(`Bearer ${token}`));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('authenticateToken lets CORS preflight through without a token', () => {
  const { nextCalled } = call(authenticateToken, { method: 'OPTIONS', headers: {} });
  assert.equal(nextCalled, true);
});

test('authorizeRoles allows listed roles and forbids others', () => {
  const staffOrAdmin = authorizeRoles('staff', 'admin');
  assert.equal(call(staffOrAdmin, { user: { role: 'admin' } }).nextCalled, true);
  assert.equal(call(staffOrAdmin, { user: { role: 'staff' } }).nextCalled, true);

  const { res, nextCalled } = call(staffOrAdmin, { user: { role: 'citizen' } });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test('authorizeRoles returns 401 when no user is attached', () => {
  const { res, nextCalled } = call(authorizeRoles('admin'), {});
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});
