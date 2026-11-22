const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

// src/config/db.js reads the environment once at load time, so each case runs
// in a fresh Node process. Nothing here opens a database connection.
const backendDir = path.join(__dirname, '..', '..');
const inspect = (env) => {
  const script = `
    const { sequelize } = require('./src/config/db');
    const { host, port, database, username, password, dialectOptions } = sequelize.config;
    console.log(JSON.stringify({ host, port: Number(port), database, username, password, ssl: sequelize.options.dialectOptions.ssl || null }));
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: backendDir,
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });
  return { ...result, config: result.status === 0 ? JSON.parse(result.stdout.trim().split('\n').pop()) : null };
};

test('reads a single DATABASE_URL', () => {
  const { config, stderr } = inspect({ DATABASE_URL: 'postgres://app:secret@db.example.test:6543/civic' });
  assert.ok(config, stderr);
  assert.equal(config.host, 'db.example.test');
  assert.equal(config.port, 6543);
  assert.equal(config.database, 'civic');
  assert.equal(config.username, 'app');
  assert.equal(config.ssl, null);
});

test('reads separate DB_* variables, with a password that would break a URL', () => {
  const password = 'p@ss:w/rd#?%';
  const { config, stderr } = inspect({
    DB_HOST: 'civicfix.abc123.ap-south-1.rds.amazonaws.com',
    DB_NAME: 'civicfix',
    DB_USER: 'civicfix',
    DB_PASSWORD: password,
  });
  assert.ok(config, stderr);
  assert.equal(config.host, 'civicfix.abc123.ap-south-1.rds.amazonaws.com');
  assert.equal(config.port, 5432);
  assert.equal(config.database, 'civicfix');
  assert.equal(config.password, password);
});

test('fails clearly when no database is configured', () => {
  const result = inspect({});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Set DATABASE_URL, or DB_HOST/);
});

test('DATABASE_SSL with a CA bundle verifies the server certificate', () => {
  const { config, stderr } = inspect({
    DB_HOST: 'db.example.test', DB_NAME: 'x', DB_USER: 'x', DB_PASSWORD: 'x',
    DATABASE_SSL: 'true',
    DATABASE_SSL_CA: path.join(__dirname, '..', 'fixtures', 'test-ca.pem'),
  });
  assert.ok(config, stderr);
  assert.equal(config.ssl.require, true);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.match(config.ssl.ca, /BEGIN CERTIFICATE/);
});

test('sslmode=require in the URL turns SSL on and keeps the CA and verification settings', () => {
  const { config, stderr } = inspect({
    DATABASE_URL: 'postgres://a:b@db.example.test:5432/x?sslmode=require',
    DATABASE_SSL_CA: path.join(__dirname, '..', 'fixtures', 'test-ca.pem'),
  });
  assert.ok(config, stderr);
  assert.equal(config.ssl.require, true);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.match(config.ssl.ca, /BEGIN CERTIFICATE/);
  assert.equal(config.database, 'x');
});
