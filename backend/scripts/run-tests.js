#!/usr/bin/env node
// Runs the backend test suites with Node's built-in test runner.
//
//   node scripts/run-tests.js              # unit + integration
//   node scripts/run-tests.js unit         # unit only (no database needed)
//   node scripts/run-tests.js integration  # integration only
//
// Integration tests need TEST_DATABASE_URL pointing at a disposable PostgreSQL
// database. Each integration file resets that database, so the files run one
// at a time rather than in parallel.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testRoot = path.join(__dirname, '..', 'test');
const listTests = (suite) =>
  fs
    .readdirSync(path.join(testRoot, suite))
    .filter((name) => name.endsWith('.test.js'))
    .sort()
    .map((name) => path.join(testRoot, suite, name));

const run = (files) =>
  spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' }).status === 0;

const requested = process.argv.slice(2);
const suites = requested.length ? requested : ['unit', 'integration'];
let ok = true;

if (suites.includes('unit')) {
  ok = run(listTests('unit')) && ok;
}

if (suites.includes('integration')) {
  if (!process.env.TEST_DATABASE_URL) {
    console.error(
      '\nSkipping integration tests: set TEST_DATABASE_URL to a disposable PostgreSQL database, e.g.\n' +
        '  TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/civicguard_test npm test\n'
    );
    process.exit(1);
  }
  for (const file of listTests('integration')) {
    ok = run([file]) && ok;
  }
}

process.exit(ok ? 0 : 1);
