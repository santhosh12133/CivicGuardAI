const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/server');
const { Issue, IssueUpdate } = require('../../src/models');

// Triage: priority, assignment and due dates, the filters built on them,
// the assignee list, and range statistics for the dashboard charts.

let api;
let citizen;
let staff;
let otherStaff;
let admin;

before(async () => {
  api = await startTestServer();
  citizen = await api.createUser('citizen');
  staff = await api.createUser('staff');
  otherStaff = await api.createUser('staff');
  admin = await api.createUser('admin');
});
after(async () => { await api.close(); });
beforeEach(async () => {
  await IssueUpdate.destroy({ where: {} });
  await Issue.destroy({ where: {} });
});

const report = async (overrides = {}) => {
  const res = await api.request('POST', '/api/issues', {
    token: citizen.token,
    json: {
      title: 'Overflowing drain',
      description: 'Water on the road',
      photo_url: 'https://images.example.test/drain.jpg',
      latitude: 12.9716,
      longitude: 77.5946,
      category: 'drainage',
      ...overrides,
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
};
const update = (who, id, json) => api.request('PUT', `/api/issues/${id}`, { token: who.token, json });
const daysFromToday = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// ---------------- defaults and visibility ----------------

test('new issues are normal priority, unassigned, without a due date', async () => {
  const issue = await report();
  const asStaff = await api.request('GET', `/api/issues/${issue.id}`, { token: staff.token });
  assert.equal(asStaff.body.priority, 'normal');
  assert.equal(asStaff.body.assignee, null);
  assert.equal(asStaff.body.due_date, null);
  assert.equal(asStaff.body.is_overdue, false);
});

test('citizens and the public never see triage fields', async () => {
  const issue = await report();
  await update(staff, issue.id, { priority: 'urgent', assigned_to: staff.user.id, due_date: daysFromToday(3) });
  for (const token of [citizen.token, undefined]) {
    const detail = await api.request('GET', `/api/issues/${issue.id}`, { token });
    for (const field of ['priority', 'assigned_to', 'assignee', 'due_date', 'is_overdue']) {
      assert.equal(detail.body[field], undefined, `${field} leaked`);
    }
    const list = await api.request('GET', '/api/issues', { token });
    assert.equal(list.body[0].priority, undefined);
  }
});

// ---------------- updating ----------------

test('staff set priority, assignee and due date, and can clear them', async () => {
  const issue = await report();
  const res = await update(staff, issue.id, { priority: 'high', assigned_to: otherStaff.user.id, due_date: daysFromToday(5) });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.priority, 'high');
  assert.deepEqual(res.body.assignee, { id: otherStaff.user.id, name: otherStaff.user.name });
  assert.equal(res.body.due_date, daysFromToday(5));

  const cleared = await update(admin, issue.id, { assigned_to: '', due_date: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.assignee, null);
  assert.equal(cleared.body.due_date, null);
  assert.equal(cleared.body.priority, 'high');
});

test('triage changes do not add entries to the public timeline', async () => {
  const issue = await report();
  const res = await update(staff, issue.id, { priority: 'urgent', assigned_to: staff.user.id });
  assert.equal(res.body.updates.length, 1); // only the original report
});

test('invalid triage values are rejected', async () => {
  const issue = await report();
  assert.equal((await update(staff, issue.id, { priority: 'critical' })).status, 400);
  assert.equal((await update(staff, issue.id, { assigned_to: citizen.user.id })).status, 400);
  assert.equal((await update(staff, issue.id, { assigned_to: '00000000-0000-4000-8000-000000000000' })).status, 400);
  assert.equal((await update(staff, issue.id, { assigned_to: 'not-a-uuid' })).status, 400);
  assert.equal((await update(staff, issue.id, { due_date: '23/11/2026' })).status, 400);
  assert.equal((await update(citizen, issue.id, { priority: 'high' })).status, 403);
});

// ---------------- filters ----------------

test('filter by assignee: me, none, or a person', async () => {
  const a = await report({ title: 'A' });
  const b = await report({ title: 'B' });
  await report({ title: 'C' });
  await update(staff, a.id, { assigned_to: staff.user.id });
  await update(staff, b.id, { assigned_to: otherStaff.user.id });

  const titles = async (query, who = staff) =>
    (await api.request('GET', `/api/issues?${query}`, { token: who.token })).body.map((i) => i.title).sort();
  assert.deepEqual(await titles('assigned_to=me'), ['A']);
  assert.deepEqual(await titles('assigned_to=me', otherStaff), ['B']);
  assert.deepEqual(await titles('assigned_to=none'), ['C']);
  assert.deepEqual(await titles(`assigned_to=${otherStaff.user.id}`), ['B']);
});

test('filter by priority and overdue', async () => {
  const urgent = await report({ title: 'Urgent' });
  const late = await report({ title: 'Late' });
  const old = await report({ title: 'Old' });
  const done = await report({ title: 'Done' });
  await update(staff, urgent.id, { priority: 'urgent', due_date: daysFromToday(2) });
  await update(staff, late.id, { due_date: daysFromToday(-1) });
  await update(staff, done.id, { due_date: daysFromToday(-3), status: 'Resolved' });
  await Issue.update({ created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }, { where: { id: old.id } });

  const get = async (query) => (await api.request('GET', `/api/issues?${query}`, { token: staff.token })).body;
  assert.deepEqual((await get('priority=urgent')).map((i) => i.title), ['Urgent']);
  const overdue = await get('overdue=true');
  assert.deepEqual(overdue.map((i) => i.title).sort(), ['Late', 'Old']);
  assert.ok(overdue.every((i) => i.is_overdue));
  const all = await get('');
  assert.equal(all.find((i) => i.title === 'Urgent').is_overdue, false);
  assert.equal(all.find((i) => i.title === 'Done').is_overdue, false);
});

test('citizens cannot use the triage filters', async () => {
  await report();
  for (const query of ['assigned_to=me', 'priority=high', 'overdue=true']) {
    const res = await api.request('GET', `/api/issues?${query}`, { token: citizen.token });
    assert.equal(res.status, 403, query);
  }
  assert.equal((await api.request('GET', '/api/issues?priority=critical', { token: staff.token })).status, 400);
});

// ---------------- assignees ----------------

test('the assignee list has staff and admins only, for staff and admins only', async () => {
  const res = await api.request('GET', '/api/issues/assignees', { token: staff.token });
  assert.equal(res.status, 200);
  const ids = res.body.map((u) => u.id);
  for (const who of [staff, otherStaff, admin]) assert.ok(ids.includes(who.user.id));
  assert.ok(!ids.includes(citizen.user.id));
  assert.deepEqual(Object.keys(res.body[0]).sort(), ['id', 'name', 'role']);
  assert.equal((await api.request('GET', '/api/issues/assignees', { token: citizen.token })).status, 403);
  assert.equal((await api.request('GET', '/api/issues/assignees')).status, 401);
});

// ---------------- statistics ----------------

test('stats: daily series for a range, including empty days', async () => {
  const a = await report();
  await report({ category: 'pothole' });
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const old = await report({ category: 'pothole' });
  await Issue.update({ created_at: twoDaysAgo }, { where: { id: old.id } });
  await update(staff, a.id, { status: 'Resolved' });

  const from = daysFromToday(-6);
  const to = daysFromToday(0);
  const res = await api.request('GET', `/api/issues/stats?from=${from}&to=${to}`, { token: staff.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { range } = res.body;
  assert.equal(range.daily.length, 7);
  assert.equal(range.daily[0].date, from);
  assert.equal(range.daily[6].date, to);
  assert.equal(range.daily[6].reported, 2);
  assert.equal(range.daily[6].resolved, 1);
  assert.equal(range.daily[4].reported, 1);
  assert.equal(range.reported, 3);
  assert.equal(range.resolved, 1);
  assert.equal(range.byCategory.pothole, 2);
  assert.equal(range.byCategory.drainage, 1);
  assert.equal(typeof range.avgResolutionHours, 'number');
  // Existing fields are still there for older clients.
  assert.equal(res.body.total, 3);
  assert.deepEqual(res.body.last7Days, { reported: 3, resolved: 1 });
});

test('stats: assignment and priority workload', async () => {
  const a = await report();
  const b = await report();
  await report();
  await update(staff, a.id, { assigned_to: staff.user.id, priority: 'urgent' });
  await update(staff, b.id, { assigned_to: staff.user.id, status: 'In Progress' });

  const res = await api.request('GET', '/api/issues/stats', { token: staff.token });
  assert.equal(res.body.assignment.mine, 2);
  assert.equal(res.body.assignment.unassigned, 1);
  assert.deepEqual(res.body.assignment.byAssignee, [{ id: staff.user.id, name: staff.user.name, open: 1, inProgress: 1 }]);
  assert.deepEqual(res.body.unresolvedByPriority, { low: 0, normal: 2, high: 0, urgent: 1 });
  assert.equal(res.body.range.daily.length, 30); // default: last 30 days
});

test('stats: invalid ranges and time zones are rejected', async () => {
  const get = (query) => api.request('GET', `/api/issues/stats?${query}`, { token: staff.token });
  assert.equal((await get('from=2026-02-30x&to=2026-03-01')).status, 400);
  assert.equal((await get(`from=${daysFromToday(0)}&to=${daysFromToday(-1)}`)).status, 400);
  assert.equal((await get('from=2024-01-01&to=2026-01-01')).status, 400);
  assert.equal((await get('tz=Mars/Olympus')).status, 400);
  assert.equal((await get('tz=Asia/Kolkata')).status, 200);
});
