const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/server');
const { Issue, IssueUpdate, User } = require('../../src/models');

// Reporter tracking + "My reports", categories, the updates timeline,
// dashboard statistics, and staff/password management.

let api;
let alice; // citizen
let bob; // citizen
let staff;
let admin;

before(async () => {
  api = await startTestServer();
  alice = await api.createUser('citizen');
  bob = await api.createUser('citizen');
  staff = await api.createUser('staff');
  admin = await api.createUser('admin');
});
after(async () => { await api.close(); });
beforeEach(async () => {
  await IssueUpdate.destroy({ where: {} });
  await Issue.destroy({ where: {} });
});

const report = async (who, overrides = {}) => {
  const res = await api.request('POST', '/api/issues', {
    token: who.token,
    json: {
      title: 'Broken streetlight',
      description: 'Out for a week',
      photo_url: 'https://images.example.test/light.jpg',
      latitude: 12.9716,
      longitude: 77.5946,
      ...overrides,
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};

// ---------------- reporter + my reports ----------------

test('a new report belongs to its reporter, without exposing who they are', async () => {
  const issue = await report(alice);
  assert.equal(issue.is_mine, true);
  assert.equal(issue.user_id, undefined);
  assert.equal(issue.reporter, undefined);
});

test('other citizens and anonymous visitors see the report but not the reporter', async () => {
  const issue = await report(alice);

  const asBob = await api.request('GET', `/api/issues/${issue.id}`, { token: bob.token });
  assert.equal(asBob.status, 200);
  assert.equal(asBob.body.is_mine, false);
  assert.equal(asBob.body.reporter, undefined);
  assert.equal(asBob.body.user_id, undefined);

  const anonymous = await api.request('GET', '/api/issues');
  assert.equal(anonymous.body[0].is_mine, false);
  assert.equal(anonymous.body[0].reporter, undefined);
});

test('staff and admins see who reported an issue', async () => {
  await report(alice);
  for (const who of [staff, admin]) {
    const list = await api.request('GET', '/api/issues', { token: who.token });
    assert.equal(list.body[0].reporter.email, alice.email);
    const detail = await api.request('GET', `/api/issues/${list.body[0].id}`, { token: who.token });
    assert.equal(detail.body.reporter.name, alice.user.name);
  }
});

test('mine=true lists only the signed-in citizen\'s reports', async () => {
  const mine = await report(alice, { title: 'Alice report' });
  await report(bob, { title: 'Bob report' });

  const asAlice = await api.request('GET', '/api/issues?mine=true', { token: alice.token });
  assert.equal(asAlice.status, 200);
  assert.deepEqual(asAlice.body.map((issue) => issue.id), [mine.id]);
  assert.ok(asAlice.body.every((issue) => issue.is_mine));

  const asStaff = await api.request('GET', '/api/issues?mine=true', { token: staff.token });
  assert.deepEqual(asStaff.body, []);

  const anonymous = await api.request('GET', '/api/issues?mine=true');
  assert.equal(anonymous.status, 401);
});

test('an invalid token on a public list is treated as anonymous', async () => {
  await report(alice);
  const res = await api.request('GET', '/api/issues', { token: 'not-a-real-token' });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
});

test('reports survive when the reporter\'s account is removed', async () => {
  const temp = await api.createUser('citizen');
  const issue = await report(temp);
  await User.destroy({ where: { id: temp.user.id } });

  const detail = await api.request('GET', `/api/issues/${issue.id}`, { token: staff.token });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.reporter, null);

  const me = await api.request('GET', '/api/auth/me', { token: temp.token });
  assert.equal(me.status, 401, 'a removed account\'s token stops working');
});

// ---------------- categories ----------------

test('GET /api/issues/categories lists the categories', async () => {
  const res = await api.request('GET', '/api/issues/categories');
  assert.equal(res.status, 200);
  const ids = res.body.map((category) => category.id);
  for (const id of ['pothole', 'streetlight', 'garbage', 'water_supply', 'drainage', 'other']) {
    assert.ok(ids.includes(id), id);
  }
  assert.ok(res.body.every((category) => typeof category.label === 'string'));
});

test('a report keeps its category, and defaults to "other"', async () => {
  assert.equal((await report(alice, { category: 'pothole' })).category, 'pothole');
  assert.equal((await report(alice)).category, 'other');
});

test('an unknown category is rejected', async () => {
  const res = await api.request('POST', '/api/issues', {
    token: alice.token,
    json: { title: 'x', description: 'y', latitude: 1, longitude: 1, photo_url: 'https://a.test/x.jpg', category: 'volcano' },
  });
  assert.equal(res.status, 400);
});

test('issues can be filtered by category and status', async () => {
  const pothole = await report(alice, { category: 'pothole' });
  await report(alice, { category: 'garbage' });
  await api.request('PUT', `/api/issues/${pothole.id}`, { token: staff.token, json: { status: 'In Progress' } });

  const potholes = await api.request('GET', '/api/issues?category=pothole');
  assert.deepEqual(potholes.body.map((issue) => issue.id), [pothole.id]);

  const inProgress = await api.request('GET', '/api/issues?status=In%20Progress');
  assert.deepEqual(inProgress.body.map((issue) => issue.id), [pothole.id]);

  const both = await api.request('GET', '/api/issues?status=Open&category=garbage');
  assert.equal(both.body.length, 1);

  assert.equal((await api.request('GET', '/api/issues?category=volcano')).status, 400);
  assert.equal((await api.request('GET', '/api/issues?status=Closed')).status, 400);
});

test('staff can recategorise an issue; unknown categories are refused', async () => {
  const issue = await report(alice, { category: 'other' });
  const res = await api.request('PUT', `/api/issues/${issue.id}`, { token: staff.token, json: { category: 'drainage' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.category, 'drainage');

  const bad = await api.request('PUT', `/api/issues/${issue.id}`, { token: staff.token, json: { category: 'volcano' } });
  assert.equal(bad.status, 400);
});

// ---------------- updates timeline ----------------

test('a new issue starts its timeline with the report', async () => {
  const issue = await report(alice);
  assert.equal(issue.updates.length, 1);
  assert.equal(issue.updates[0].to_status, 'Open');
  assert.equal(issue.updates[0].author.role, 'citizen');
  assert.equal(issue.updates[0].author.is_me, true);
});

test('status changes and notes from staff appear in the timeline in order', async () => {
  const issue = await report(alice);

  const progress = await api.request('PUT', `/api/issues/${issue.id}`, {
    token: staff.token,
    json: { status: 'In Progress', note: 'Crew scheduled for Monday' },
  });
  assert.equal(progress.status, 200);

  const noteOnly = await api.request('PUT', `/api/issues/${issue.id}`, {
    token: staff.token,
    json: { note: 'Materials ordered' },
  });
  assert.equal(noteOnly.status, 200, 'a note alone is a valid update');
  assert.equal(noteOnly.body.status, 'In Progress');

  const done = await api.request('PUT', `/api/issues/${issue.id}`, {
    token: admin.token,
    json: { status: 'Resolved', note: 'Light replaced' },
  });

  const timeline = done.body.updates.map((u) => [u.from_status, u.to_status, u.note, u.author.role]);
  assert.deepEqual(timeline, [
    [null, 'Open', null, 'citizen'],
    ['Open', 'In Progress', 'Crew scheduled for Monday', 'staff'],
    [null, null, 'Materials ordered', 'staff'],
    ['In Progress', 'Resolved', 'Light replaced', 'admin'],
  ]);
  assert.equal(done.body.updates[1].author.name, staff.user.name, 'officials are named');
});

test('a citizen\'s name in a timeline is shown only to staff and to that citizen', async () => {
  const issue = await report(alice);
  const path = `/api/issues/${issue.id}`;

  assert.equal((await api.request('GET', path, { token: alice.token })).body.updates[0].author.name, alice.user.name);
  assert.equal((await api.request('GET', path, { token: staff.token })).body.updates[0].author.name, alice.user.name);
  assert.equal((await api.request('GET', path, { token: bob.token })).body.updates[0].author.name, null);
  assert.equal((await api.request('GET', path)).body.updates[0].author.name, null);
});

test('setting the same status again without a note adds nothing to the timeline', async () => {
  const issue = await report(alice);
  const res = await api.request('PUT', `/api/issues/${issue.id}`, { token: staff.token, json: { status: 'Open' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.updates.length, 1);
});

test('notes longer than 1000 characters are rejected', async () => {
  const issue = await report(alice);
  const res = await api.request('PUT', `/api/issues/${issue.id}`, {
    token: staff.token,
    json: { note: 'x'.repeat(1001) },
  });
  assert.equal(res.status, 400);
});

test('citizens cannot add notes to an issue', async () => {
  const issue = await report(alice);
  const res = await api.request('PUT', `/api/issues/${issue.id}`, { token: alice.token, json: { note: 'Any news?' } });
  assert.equal(res.status, 403);
});

test('deleting an issue deletes its timeline', async () => {
  const issue = await report(alice);
  await api.request('PUT', `/api/issues/${issue.id}`, { token: staff.token, json: { note: 'Checked' } });
  assert.equal(await IssueUpdate.count({ where: { issue_id: issue.id } }), 2);

  assert.equal((await api.request('DELETE', `/api/issues/${issue.id}`, { token: admin.token })).status, 204);
  assert.equal(await IssueUpdate.count({ where: { issue_id: issue.id } }), 0);
});

// ---------------- dashboard statistics ----------------

test('statistics are for staff and admins only', async () => {
  assert.equal((await api.request('GET', '/api/issues/stats')).status, 401);
  assert.equal((await api.request('GET', '/api/issues/stats', { token: alice.token })).status, 403);
  assert.equal((await api.request('GET', '/api/issues/stats', { token: staff.token })).status, 200);
});

test('statistics count issues by status and category', async () => {
  const a = await report(alice, { category: 'pothole' });
  await report(alice, { category: 'pothole' });
  await report(bob, { category: 'garbage' });
  await api.request('PUT', `/api/issues/${a.id}`, { token: staff.token, json: { status: 'Resolved' } });

  const res = await api.request('GET', '/api/issues/stats', { token: admin.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 3);
  assert.deepEqual(res.body.byStatus, { Open: 2, 'In Progress': 0, Resolved: 1 });
  assert.equal(res.body.byCategory.pothole, 2);
  assert.equal(res.body.byCategory.garbage, 1);
  assert.equal(res.body.byCategory.streetlight, 0);
  // Reports made with a photo URL (no EXIF to check) are flagged for review.
  assert.equal(res.body.needsReview, 2);
  assert.equal(res.body.overdue, 0);
  assert.deepEqual(res.body.last7Days, { reported: 3, resolved: 1 });
  assert.equal(typeof res.body.avgResolutionHours, 'number');
  assert.ok(res.body.avgResolutionHours >= 0);
});

test('statistics count open issues older than a week as overdue', async () => {
  const old = await report(alice);
  await Issue.update({ created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000) }, { where: { id: old.id }, silent: true });
  const res = await api.request('GET', '/api/issues/stats', { token: staff.token });
  assert.equal(res.body.overdue, 1);
  assert.equal(res.body.last7Days.reported, 0);
});

test('statistics work with no issues at all', async () => {
  const res = await api.request('GET', '/api/issues/stats', { token: staff.token });
  assert.equal(res.body.total, 0);
  assert.equal(res.body.avgResolutionHours, null);
});

// ---------------- staff management + passwords ----------------

test('an admin can create a staff account with a one-time password', async () => {
  const res = await api.request('POST', '/api/auth/staff', {
    token: admin.token,
    json: { name: 'Ward Officer', email: 'ward.officer@city.example.test', role: 'staff' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.user.role, 'staff');
  assert.ok(res.body.temporaryPassword.length >= 12);
  assert.equal(res.body.user.password, undefined);

  const login = await api.request('POST', '/api/auth/login', {
    json: { email: 'ward.officer@city.example.test', password: res.body.temporaryPassword },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'staff');
});

test('creating a staff account for an existing email is refused', async () => {
  const res = await api.request('POST', '/api/auth/staff', {
    token: admin.token,
    json: { name: 'Alice', email: alice.email, role: 'staff' },
  });
  assert.equal(res.status, 409);
});

test('only admins can manage accounts, and only with staff/admin roles', async () => {
  const payload = { name: 'X', email: 'x.staff@example.test', role: 'staff' };
  assert.equal((await api.request('POST', '/api/auth/staff', { token: staff.token, json: payload })).status, 403);
  assert.equal((await api.request('POST', '/api/auth/staff', { token: alice.token, json: payload })).status, 403);
  assert.equal((await api.request('POST', '/api/auth/staff', { json: payload })).status, 401);
  assert.equal(
    (await api.request('POST', '/api/auth/staff', { token: admin.token, json: { ...payload, role: 'citizen' } })).status,
    400
  );
});

test('an admin can list staff accounts', async () => {
  const res = await api.request('GET', '/api/auth/users?role=staff,admin', { token: admin.token });
  assert.equal(res.status, 200);
  assert.ok(res.body.users.length >= 2);
  assert.ok(res.body.users.every((user) => ['staff', 'admin'].includes(user.role)));
});

test('a role change takes effect immediately, even for existing tokens', async () => {
  const officer = await api.createUser('staff');
  assert.equal((await api.request('GET', '/api/issues/stats', { token: officer.token })).status, 200);

  const demote = await api.request('PATCH', `/api/auth/users/${officer.user.id}`, {
    token: admin.token,
    json: { role: 'citizen' },
  });
  assert.equal(demote.status, 200);
  assert.equal(demote.body.user.role, 'citizen');

  assert.equal((await api.request('GET', '/api/issues/stats', { token: officer.token })).status, 403);

  const promote = await api.request('PATCH', `/api/auth/users/${officer.user.id}`, {
    token: admin.token,
    json: { role: 'admin' },
  });
  assert.equal(promote.body.user.role, 'admin');
  assert.equal((await api.request('GET', '/api/auth/users', { token: officer.token })).status, 200);
});

test('admins cannot change their own role', async () => {
  const res = await api.request('PATCH', `/api/auth/users/${admin.user.id}`, {
    token: admin.token,
    json: { role: 'citizen' },
  });
  assert.equal(res.status, 400);
});

test('an admin can reset someone\'s password', async () => {
  const officer = await api.createUser('staff');
  const res = await api.request('POST', `/api/auth/users/${officer.user.id}/reset-password`, { token: admin.token });
  assert.equal(res.status, 200);

  const oldLogin = await api.request('POST', '/api/auth/login', { json: { email: officer.email, password: api.PASSWORD } });
  assert.equal(oldLogin.status, 401);
  const newLogin = await api.request('POST', '/api/auth/login', {
    json: { email: officer.email, password: res.body.temporaryPassword },
  });
  assert.equal(newLogin.status, 200);
});

test('GET /api/auth/me returns the signed-in account', async () => {
  const res = await api.request('GET', '/api/auth/me', { token: staff.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, staff.email);
  assert.equal(res.body.user.role, 'staff');
  assert.equal(res.body.user.password, undefined);
});

test('anyone signed in can change their own password', async () => {
  const person = await api.createUser('citizen');
  const wrong = await api.request('POST', '/api/auth/change-password', {
    token: person.token,
    json: { currentPassword: 'not-my-password', newPassword: 'a-brand-new-password' },
  });
  assert.equal(wrong.status, 400);

  const short = await api.request('POST', '/api/auth/change-password', {
    token: person.token,
    json: { currentPassword: api.PASSWORD, newPassword: 'short' },
  });
  assert.equal(short.status, 400);

  const ok = await api.request('POST', '/api/auth/change-password', {
    token: person.token,
    json: { currentPassword: api.PASSWORD, newPassword: 'a-brand-new-password' },
  });
  assert.equal(ok.status, 200);

  const login = await api.request('POST', '/api/auth/login', {
    json: { email: person.email, password: 'a-brand-new-password' },
  });
  assert.equal(login.status, 200);
});
