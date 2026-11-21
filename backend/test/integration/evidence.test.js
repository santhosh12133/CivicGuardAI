const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startTestServer } = require('../helpers/server');
const { makePhoto, issueForm } = require('../helpers/photos');
const { Issue } = require('../../src/models');

// End-to-end checks of the photo evidence rules in issueController.createIssue:
// EXIF presence, 24-hour photo age, 200 m GPS consistency, and pHash duplicates.

const MG_ROAD = { lat: 12.9756, lon: 77.6066 }; // Bengaluru
const MG_ROAD_100M_NORTH = { lat: 12.9765, lon: 77.6066 };
const CHENNAI = { lat: 13.0827, lon: 80.2707 }; // ~290 km from MG Road
const NEW_YORK = { lat: 40.7128, lon: -74.006 };
const SYDNEY = { lat: -33.8688, lon: 151.2093 };
const BUENOS_AIRES = { lat: -34.6037, lon: -58.3816 };

const HOUR = 60 * 60 * 1000;
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

let api;
let citizen;
let staff;

before(async () => {
  api = await startTestServer();
  citizen = await api.createUser('citizen');
  staff = await api.createUser('staff');
});
after(async () => { await api.close(); });
// Each test starts with no stored photos, so duplicate detection is predictable.
beforeEach(async () => { await Issue.destroy({ where: {}, truncate: true }); });

const report = (photoOpts, at, formOpts = {}) => async () => {
  const photo = await makePhoto(photoOpts);
  return api.request('POST', '/api/issues', {
    token: citizen.token,
    form: issueForm({ photo, lat: at.lat, lon: at.lon, ...formOpts }),
  });
};

// ---------- accepted evidence ----------

test('a fresh camera photo taken where the issue is reported is accepted', async () => {
  const res = await report({ gps: MG_ROAD }, MG_ROAD)();

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.needs_review, false);
  assert.match(res.body.phash, /^[0-9a-f]{16}$/);
  assert.match(res.body.photo_url, /\/uploads\/issue-\d+-[0-9a-f]{24}\.jpg$/);

  // The stored photo is served back from /uploads.
  const image = await fetch(res.body.photo_url);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  await image.arrayBuffer();
});

test('a photo taken 100 m from the reported spot is accepted', async () => {
  const res = await report({ gps: MG_ROAD_100M_NORTH }, MG_ROAD)();
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

for (const [label, place] of [
  ['the western hemisphere (New York)', NEW_YORK],
  ['the southern hemisphere (Sydney)', SYDNEY],
  ['the south-western hemisphere (Buenos Aires)', BUENOS_AIRES],
]) {
  test(`a matching photo from ${label} is accepted`, async () => {
    const res = await report({ gps: place }, place)();
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });
}

test('a gallery photo with a capture date but no GPS falls back to the device location', async () => {
  const res = await report({ gps: null, camera: false }, MG_ROAD)();
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

// ---------- rejected evidence ----------

test('a photo with no camera metadata is rejected', async () => {
  const res = await report({ bare: true }, MG_ROAD)();
  assert.equal(res.status, 400);
  assert.match(res.body.message, /no camera metadata/i);
});

test('a photo taken more than 24 hours ago is rejected', async () => {
  const res = await report({ gps: MG_ROAD, takenAt: new Date(Date.now() - 72 * HOUR) }, MG_ROAD)();
  assert.equal(res.status, 400);
  assert.match(res.body.message, /older than 24 hours/i);
});

test('a photo taken far from the reported location is rejected', async () => {
  const res = await report({ gps: CHENNAI }, MG_ROAD)();
  assert.equal(res.status, 400);
  assert.match(res.body.message, /away from reported location/i);
});

test('a file that is not really an image is rejected with 400', async () => {
  const res = await api.request('POST', '/api/issues', {
    token: citizen.token,
    form: issueForm({ photo: Buffer.from('definitely not a jpeg'), ...MG_ROAD }),
  });
  assert.equal(res.status, 400);
});

test('a disallowed file type is rejected with 400', async () => {
  const res = await api.request('POST', '/api/issues', {
    token: citizen.token,
    form: issueForm({ photo: Buffer.from('hello'), mimeType: 'text/plain', filename: 'notes.txt', ...MG_ROAD }),
  });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /JPEG, PNG, GIF, and WebP/);
});

test('a file over 10 MB is rejected with 413', async () => {
  const res = await api.request('POST', '/api/issues', {
    token: citizen.token,
    form: issueForm({ photo: Buffer.alloc(10 * 1024 * 1024 + 1024), ...MG_ROAD }),
  });
  assert.equal(res.status, 413);
});

test('uploading requires authentication', async () => {
  const photo = await makePhoto({ gps: MG_ROAD });
  const res = await api.request('POST', '/api/issues', { form: issueForm({ photo, ...MG_ROAD }) });
  assert.equal(res.status, 401);
});

// ---------- duplicate detection ----------

test('different scenes are not flagged; re-uploading the same scene is flagged for review', async () => {
  const pothole = await report({ fixture: 'pothole.jpg', gps: MG_ROAD }, MG_ROAD)();
  const streetlight = await report({ fixture: 'streetlight.jpg', gps: MG_ROAD }, MG_ROAD)();
  const potholeAgain = await report({ fixture: 'pothole.jpg', gps: MG_ROAD }, MG_ROAD)();

  assert.equal(pothole.status, 201);
  assert.equal(pothole.body.needs_review, false);
  assert.equal(streetlight.status, 201);
  assert.equal(streetlight.body.needs_review, false, 'a different scene should not look like a duplicate');
  assert.equal(potholeAgain.status, 201, 'duplicates are flagged, not blocked');
  assert.equal(potholeAgain.body.needs_review, true);
  assert.equal(potholeAgain.body.phash, pothole.body.phash);
});

// ---------- resolution evidence ----------

test('staff can attach a resolution photo while resolving an issue', async () => {
  const created = await report({ gps: MG_ROAD }, MG_ROAD)();
  assert.equal(created.status, 201);

  const form = new FormData();
  form.append('status', 'Resolved');
  form.append('image', new Blob([await makePhoto({ fixture: 'streetlight.jpg' })], { type: 'image/jpeg' }), 'fixed.jpg');
  const res = await api.request('PUT', `/api/issues/${created.body.id}`, { token: staff.token, form });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'Resolved');
  assert.equal(res.body.photo_url, created.body.photo_url, 'the original evidence photo is kept');
  assert.match(res.body.resolved_photo_url, /\/uploads\/issue-.*\.jpg$/);
});

test('a citizen cannot upload a resolution photo', async () => {
  const created = await report({ gps: MG_ROAD }, MG_ROAD)();
  const form = new FormData();
  form.append('status', 'Resolved');
  form.append('image', new Blob([await makePhoto()], { type: 'image/jpeg' }), 'fixed.jpg');
  const res = await api.request('PUT', `/api/issues/${created.body.id}`, { token: citizen.token, form });
  assert.equal(res.status, 403);
});

// ---------- known gaps (reported as TODO, do not fail the build) ----------

test('a camera photo with no capture date is not treated as fresh', {
  todo: 'without DateTimeOriginal the controller falls back to FileModifyDate, which is the server upload time, so the 24-hour rule is bypassed',
}, async () => {
  const res = await report({ gps: MG_ROAD, takenAt: null }, MG_ROAD)();
  assert.ok(res.status === 400 || res.body.needs_review === true, `got ${res.status}, needs_review=${res.body.needs_review}`);
});

test('a photo dated in the future is not accepted as fresh', {
  todo: 'photo age is only checked against the 24-hour maximum; future capture dates pass',
}, async () => {
  const res = await report({ gps: MG_ROAD, takenAt: new Date(Date.now() + 48 * HOUR) }, MG_ROAD)();
  assert.ok(res.status === 400 || res.body.needs_review === true, `got ${res.status}, needs_review=${res.body.needs_review}`);
});

test('rejected photos are not left in the public uploads folder', {
  todo: 'multer writes the file before validation; rejected evidence stays on disk and is served from /uploads',
}, async () => {
  const before = new Set(fs.readdirSync(UPLOADS_DIR));
  const res = await report({ bare: true }, MG_ROAD)();
  assert.equal(res.status, 400);
  const leftover = fs.readdirSync(UPLOADS_DIR).filter((name) => !before.has(name));
  assert.deepEqual(leftover, []);
});
