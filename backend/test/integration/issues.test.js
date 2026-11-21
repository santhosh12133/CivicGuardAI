const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/server');

// These tests use the JSON photo_url path, which skips image evidence checks.
// Photo upload and EXIF/GPS/pHash rules are covered in evidence.test.js.

let api;
let citizen;
let staff;
let admin;

before(async () => {
  api = await startTestServer();
  citizen = await api.createUser('citizen');
  staff = await api.createUser('staff');
  admin = await api.createUser('admin');
});
after(async () => { await api.close(); });

const BENGALURU = { latitude: 12.9716, longitude: 77.5946 };
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const validIssue = (overrides = {}) => ({
  title: 'Broken streetlight',
  description: 'Streetlight has been out for a week',
  photo_url: 'https://images.example.test/light.jpg',
  ...BENGALURU,
  ...overrides,
});

const createIssue = async (overrides) => {
  const res = await api.request('POST', '/api/issues', { token: citizen.token, json: validIssue(overrides) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};

// ---------- create ----------

test('creating an issue requires authentication', async () => {
  const res = await api.request('POST', '/api/issues', { json: validIssue() });
  assert.equal(res.status, 401);
});

test('a citizen can report an issue; it starts Open with a resolved address', async () => {
  const issue = await createIssue();
  assert.match(issue.id, /^[0-9a-f-]{36}$/);
  assert.equal(issue.status, 'Open');
  assert.equal(Number(issue.latitude), BENGALURU.latitude);
  assert.equal(Number(issue.longitude), BENGALURU.longitude);
  // GEOCODING_ENABLED=false in tests stores a coordinate label instead.
  assert.equal(issue.address, 'Location (12.9716, 77.5946)');
});

test('an issue with a remote photo URL (no EXIF to check) is flagged for review', async () => {
  const issue = await createIssue();
  assert.equal(issue.needs_review, true);
});

for (const [label, overrides] of [
  ['a missing title', { title: '' }],
  ['a whitespace-only description', { description: '   ' }],
  ['latitude above 90', { latitude: 90.5 }],
  ['latitude below -90', { latitude: -91 }],
  ['longitude above 180', { longitude: 180.01 }],
  ['a non-numeric longitude', { longitude: 'east' }],
  ['missing coordinates', { latitude: undefined, longitude: undefined }],
  ['an unknown status', { status: 'Closed' }],
  ['an invalid photo URL', { photo_url: 'not a url' }],
]) {
  test(`creating an issue with ${label} is rejected with 400`, async () => {
    const res = await api.request('POST', '/api/issues', { token: citizen.token, json: validIssue(overrides) });
    assert.equal(res.status, 400, JSON.stringify(res.body));
  });
}

test('a citizen cannot create an issue that is already Resolved', { todo: 'POST /api/issues accepts status from any role; new reports should always start Open' }, async () => {
  const res = await api.request('POST', '/api/issues', { token: citizen.token, json: validIssue({ status: 'Resolved' }) });
  assert.ok(res.status === 400 || res.body.status === 'Open', `got ${res.status} / ${res.body.status}`);
});

// ---------- read ----------

test('anyone can list issues, newest first', async () => {
  const first = await createIssue({ title: 'Older' });
  await new Promise((resolve) => setTimeout(resolve, 10)); // distinct created_at
  const second = await createIssue({ title: 'Newer' });

  const res = await api.request('GET', '/api/issues');
  assert.equal(res.status, 200);
  const ids = res.body.map((issue) => issue.id);
  assert.ok(ids.indexOf(second.id) < ids.indexOf(first.id), 'newest issue should come first');
});

test('anyone can fetch one issue by id', async () => {
  const created = await createIssue();
  const res = await api.request('GET', `/api/issues/${created.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.id, created.id);
});

test('fetching a malformed id is 400', async () => {
  const res = await api.request('GET', '/api/issues/not-a-uuid');
  assert.equal(res.status, 400);
});

test('fetching an unknown id is 404', async () => {
  const res = await api.request('GET', `/api/issues/${MISSING_ID}`);
  assert.equal(res.status, 404);
});

// ---------- update ----------

test('updating an issue requires authentication', async () => {
  const { id } = await createIssue();
  const res = await api.request('PUT', `/api/issues/${id}`, { json: { status: 'In Progress' } });
  assert.equal(res.status, 401);
});

test('a citizen cannot update an issue, even their own', async () => {
  const { id } = await createIssue();
  const res = await api.request('PUT', `/api/issues/${id}`, { token: citizen.token, json: { status: 'Resolved' } });
  assert.equal(res.status, 403);

  const after = await api.request('GET', `/api/issues/${id}`);
  assert.equal(after.body.status, 'Open');
});

for (const who of ['staff', 'admin']) {
  test(`${who} can move an issue through its statuses`, async () => {
    const { token } = who === 'staff' ? staff : admin;
    const { id } = await createIssue();

    for (const status of ['In Progress', 'Resolved']) {
      const res = await api.request('PUT', `/api/issues/${id}`, { token, json: { status } });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.status, status);
    }

    const stored = await api.request('GET', `/api/issues/${id}`);
    assert.equal(stored.body.status, 'Resolved');
  });
}

test('staff can edit the title and description', async () => {
  const { id } = await createIssue();
  const res = await api.request('PUT', `/api/issues/${id}`, {
    token: staff.token,
    json: { title: 'Streetlight (pole 14)', description: 'Confirmed by ward office' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Streetlight (pole 14)');
  assert.equal(res.body.description, 'Confirmed by ward office');
});

test('updating to an unknown status is 400', async () => {
  const { id } = await createIssue();
  const res = await api.request('PUT', `/api/issues/${id}`, { token: staff.token, json: { status: 'Closed' } });
  assert.equal(res.status, 400);
});

test('an update with no fields is 400', async () => {
  const { id } = await createIssue();
  const res = await api.request('PUT', `/api/issues/${id}`, { token: staff.token, json: {} });
  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'No updates provided');
});

test('updating an unknown issue is 404', async () => {
  const res = await api.request('PUT', `/api/issues/${MISSING_ID}`, { token: staff.token, json: { status: 'Resolved' } });
  assert.equal(res.status, 404);
});

test('updating a malformed id is 400', async () => {
  const res = await api.request('PUT', '/api/issues/not-a-uuid', { token: staff.token, json: { status: 'Resolved' } });
  assert.equal(res.status, 400);
});

// ---------- delete ----------

test('deleting an issue requires authentication', async () => {
  const { id } = await createIssue();
  const res = await api.request('DELETE', `/api/issues/${id}`);
  assert.equal(res.status, 401);
});

for (const who of ['citizen', 'staff']) {
  test(`${who} cannot delete an issue`, async () => {
    const { token } = who === 'citizen' ? citizen : staff;
    const { id } = await createIssue();
    const res = await api.request('DELETE', `/api/issues/${id}`, { token });
    assert.equal(res.status, 403);
    assert.equal((await api.request('GET', `/api/issues/${id}`)).status, 200);
  });
}

test('admin can delete an issue, after which it is gone', async () => {
  const { id } = await createIssue();
  const res = await api.request('DELETE', `/api/issues/${id}`, { token: admin.token });
  assert.equal(res.status, 204);
  assert.equal((await api.request('GET', `/api/issues/${id}`)).status, 404);
  assert.equal((await api.request('DELETE', `/api/issues/${id}`, { token: admin.token })).status, 404);
});

test('deleting a malformed id is 400', async () => {
  const res = await api.request('DELETE', '/api/issues/not-a-uuid', { token: admin.token });
  assert.equal(res.status, 400);
});
