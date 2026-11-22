const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('../helpers/env');
const { sequelize } = require('../../src/models');
const { syncSchema } = require('../../src/config/schema');

// A database created by an earlier version (no categories, reporters or
// timeline) must be upgraded in place on start-up without losing data.

before(async () => {
  await sequelize.getQueryInterface().dropAllTables();
  await sequelize.query('DROP TYPE IF EXISTS "enum_issues_status" CASCADE');
  await sequelize.query('DROP TYPE IF EXISTS "enum_users_role" CASCADE');
  await sequelize.query(`
    CREATE TYPE "enum_issues_status" AS ENUM ('Open', 'In Progress', 'Resolved');
    CREATE TABLE issues (
      id UUID PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      photo_url VARCHAR(255),
      resolved_photo_url VARCHAR(255),
      latitude DECIMAL(9,6) NOT NULL,
      longitude DECIMAL(9,6) NOT NULL,
      address TEXT,
      phash VARCHAR(255),
      needs_review BOOLEAN NOT NULL DEFAULT false,
      status "enum_issues_status" NOT NULL DEFAULT 'Open',
      created_at TIMESTAMPTZ NOT NULL
    );
    INSERT INTO issues (id, title, description, latitude, longitude, created_at)
    VALUES ('11111111-1111-4111-8111-111111111111', 'Old report', 'From before categories', 12.9, 77.5, NOW());
  `);
});

after(async () => {
  await sequelize.close();
});

test('syncSchema adds the new columns and tables to an older database', async () => {
  const added = await syncSchema();
  assert.ok(added.includes('issues.category'), `added: ${added}`);
  assert.ok(added.includes('issues.user_id'), `added: ${added}`);

  const qi = sequelize.getQueryInterface();
  const issues = await qi.describeTable('issues');
  assert.ok(issues.category);
  assert.ok(issues.user_id);
  const tables = (await qi.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
  for (const table of ['users', 'issue_updates', 'photos']) {
    assert.ok(tables.includes(table), `${table} created`);
  }

  const [rows] = await sequelize.query('SELECT title, category, user_id FROM issues');
  assert.deepEqual(rows, [{ title: 'Old report', category: 'other', user_id: null }]);
});

test('syncSchema is a no-op on an up-to-date database', async () => {
  assert.deepEqual(await syncSchema(), []);
});
