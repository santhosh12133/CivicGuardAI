const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../../src/middleware/rateLimiter');

const fakeRes = () => {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.set = (name, value) => { res.headers[name] = value; return res; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

// The limiter keeps a module-level bucket map, so every test uses its own IP.
const hit = (limiter, ip) => {
  const res = fakeRes();
  let passed = false;
  limiter({ ip }, res, () => { passed = true; });
  return { passed, res };
};

test('allows requests up to the limit', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3, message: 'slow down' });
  for (let i = 0; i < 3; i += 1) {
    assert.equal(hit(limiter, '10.0.0.1').passed, true);
  }
});

test('blocks the request after the limit with 429 and Retry-After', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, message: 'slow down' });
  hit(limiter, '10.0.0.2');
  hit(limiter, '10.0.0.2');
  const { passed, res } = hit(limiter, '10.0.0.2');

  assert.equal(passed, false);
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, { message: 'slow down' });
  const retryAfter = Number(res.headers['Retry-After']);
  assert.ok(retryAfter >= 1 && retryAfter <= 60, `Retry-After was ${retryAfter}`);
});

test('counts each client IP separately', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, message: 'slow down' });
  assert.equal(hit(limiter, '10.0.0.3').passed, true);
  assert.equal(hit(limiter, '10.0.0.3').passed, false);
  assert.equal(hit(limiter, '10.0.0.4').passed, true);
});

test('starts a new window once the old one expires', (t) => {
  t.mock.method(Date, 'now', () => 1_000_000);
  const limiter = createRateLimiter({ windowMs: 1_000, max: 1, message: 'slow down' });
  assert.equal(hit(limiter, '10.0.0.5').passed, true);
  assert.equal(hit(limiter, '10.0.0.5').passed, false);

  Date.now.mock.mockImplementation(() => 1_001_000);
  assert.equal(hit(limiter, '10.0.0.5').passed, true);
});
