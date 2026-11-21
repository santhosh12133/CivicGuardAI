const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/server');

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

test('GET / reports the service is up', async () => {
  const res = await api.request('GET', '/');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { service: 'CivicFix API', status: 'ok' });
});

test('GET /health checks the database', async () => {
  const res = await api.request('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok', database: 'ok' });
});

test('responses carry security headers and hide the framework', async () => {
  const res = await api.request('GET', '/');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('CORS allows the configured admin origin', async () => {
  const res = await api.request('GET', '/', { headers: { Origin: 'http://admin.test' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://admin.test');
});

test('CORS rejects an unknown origin with 403', async () => {
  const res = await api.request('GET', '/', { headers: { Origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('requests without an Origin header (mobile app, curl) are allowed', async () => {
  const res = await api.request('GET', '/api/issues');
  assert.equal(res.status, 200);
});

test('malformed JSON is a 400, not a 500', async () => {
  const res = await api.request('POST', '/api/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    form: '{"email": ',
  });
  assert.equal(res.status, 400);
});

test('JSON bodies over 1 MB are rejected with 413', async () => {
  const res = await api.request('POST', '/api/auth/login', {
    json: { email: 'a@example.test', password: 'x'.repeat(1024 * 1024 + 10) },
  });
  assert.equal(res.status, 413);
});
