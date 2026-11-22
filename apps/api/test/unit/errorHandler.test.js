const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../../src/middleware/errorHandler');

const run = (err, nodeEnv) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  const res = {};
  const originalConsoleError = console.error;
  console.error = () => {}; // the handler logs every error; keep test output quiet
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  try {
    errorHandler(err, {}, res, () => {});
  } finally {
    process.env.NODE_ENV = previous;
    console.error = originalConsoleError;
  }
  return res;
};

test('hides internal error details in production', () => {
  const res = run(new Error('relation "users" does not exist'), 'production');
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { message: 'Internal server error' });
});

test('shows internal error details outside production', () => {
  const res = run(new Error('relation "users" does not exist'), 'development');
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'relation "users" does not exist');
});

test('keeps client error messages in production', () => {
  const err = Object.assign(new Error('Image must be 10 MB or smaller'), { statusCode: 413 });
  const res = run(err, 'production');
  assert.equal(res.statusCode, 413);
  assert.equal(res.body.message, 'Image must be 10 MB or smaller');
});

test('honours err.status as well as err.statusCode', () => {
  const err = Object.assign(new Error('Bad JSON'), { status: 400 });
  const res = run(err, 'production');
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Bad JSON');
});
