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

test('the API can connect using DB_HOST/DB_NAME/DB_USER/DB_PASSWORD (as on AWS)', () => {
  const { spawnSync } = require('child_process');
  const path = require('path');
  const url = new URL(process.env.TEST_DATABASE_URL);
  const result = spawnSync(
    process.execPath,
    ['-e', "require('./src/config/db').sequelize.authenticate().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); })"],
    {
      cwd: path.join(__dirname, '..', '..'),
      env: {
        PATH: process.env.PATH,
        DB_HOST: url.hostname,
        DB_PORT: url.port || '5432',
        DB_NAME: url.pathname.slice(1),
        DB_USER: decodeURIComponent(url.username),
        DB_PASSWORD: decodeURIComponent(url.password),
      },
      encoding: 'utf8',
    }
  );
  assert.equal(result.status, 0, result.stderr);
});

test('CORS preflight allows the methods the admin portal uses', async () => {
  const res = await api.request('OPTIONS', '/api/auth/users/00000000-0000-4000-8000-000000000000', {
    headers: {
      Origin: 'http://admin.test',
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(res.status, 204);
  assert.match(res.headers.get('access-control-allow-methods'), /PATCH/);
  assert.match(res.headers.get('access-control-allow-headers'), /Authorization/i);
});

test('the rate limit defaults to 300 requests a minute and can be configured', () => {
  const { spawnSync } = require('child_process');
  const path = require('path');
  const script = `
    process.env.RATE_LIMIT_MAX = process.argv[1] || '';
    const { createApp } = require('./src/app');
    const http = require('http');
    const server = createApp().listen(0, async () => {
      const port = server.address().port;
      let blockedAt = null;
      for (let i = 1; i <= 400 && blockedAt === null; i += 1) {
        const res = await fetch('http://127.0.0.1:' + port + '/');
        if (res.status === 429) blockedAt = i;
      }
      console.log(blockedAt);
      process.exit(0);
    });
  `;
  const run = (max) =>
    spawnSync(process.execPath, ['-e', script, max], {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env },
      encoding: 'utf8',
    });
  const byDefault = run('');
  assert.equal(byDefault.stdout.trim().split('\n').pop(), '301', byDefault.stderr);
  const custom = run('5');
  assert.equal(custom.stdout.trim().split('\n').pop(), '6', custom.stderr);
});
