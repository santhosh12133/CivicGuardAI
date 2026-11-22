// Environment for integration tests. Must be required before anything under src/.
//
// Integration tests DROP AND RECREATE every table, so they only ever run
// against TEST_DATABASE_URL — never the DATABASE_URL from your .env.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'Integration tests need TEST_DATABASE_URL pointing at a disposable PostgreSQL database (it is wiped on every run).'
  );
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'civicguard-test-secret-0123456789abcdef0123456789';
process.env.GEOCODING_ENABLED = 'false';
// Tests sign in many times from one address; one test checks the limit itself.
process.env.AUTH_RATE_LIMIT_MAX = '100000';
// Codes are recorded in the in-memory outbox instead of being sent.
process.env.EMAIL_PROVIDER = 'log';
process.env.SMS_PROVIDER = 'log';
process.env.CORS_ORIGINS = 'http://admin.test';
// Uploaded-image URLs should point at the test server itself.
delete process.env.API_HOST;
delete process.env.API_PROTOCOL;
