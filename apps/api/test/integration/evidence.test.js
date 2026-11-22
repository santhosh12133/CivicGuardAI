const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startTestServer } = require('../helpers/server');
const { makePhoto, issueForm } = require('../helpers/photos');
const crypto = require('crypto');
const { Issue, Photo, sequelize } = require('../../src/models');

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
let admin;

before(async () => {
  api = await startTestServer();
  citizen = await api.createUser('citizen');
  staff = await api.createUser('staff');
  admin = await api.createUser('admin');
});
after(async () => { await api.close(); });
// Each test starts with no stored photos, so duplicate detection is predictable.
beforeEach(async () => { await Issue.destroy({ where: {}, truncate: true, cascade: true }); });

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

// ---------- capture date rules ----------

test('a camera photo with no capture date is rejected', async () => {
  // Previously the server's own file-save time was used, so this passed as "fresh".
  const res = await report({ gps: MG_ROAD, takenAt: null }, MG_ROAD)();
  assert.equal(res.status, 400);
  assert.match(res.body.message, /no date metadata/i);
});

test('a photo dated in the future is rejected', async () => {
  const res = await report({ gps: MG_ROAD, takenAt: new Date(Date.now() + 48 * HOUR) }, MG_ROAD)();
  assert.equal(res.status, 400);
  assert.match(res.body.message, /in the future/i);
});

test('a phone clock a few minutes fast is tolerated', async () => {
  const res = await report({ gps: MG_ROAD, takenAt: new Date(Date.now() + 5 * 60 * 1000) }, MG_ROAD)();
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

test('CreateDate is used when DateTimeOriginal is missing', async () => {
  const res = await report({ gps: MG_ROAD, dateTag: 'CreateDate' }, MG_ROAD)();
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.needs_review, false);
});

test('a fresh photo with no timezone information is accepted but flagged for review', async () => {
  const res = await report({ gps: null, zone: false }, MG_ROAD)();
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.needs_review, true);
});

// ---------- rejected uploads are removed ----------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs a request and returns any files it left in uploads/. Cleanup happens
// when the response finishes, so poll briefly before deciding.
const uploadsLeftBy = async (action) => {
  const before = new Set(fs.readdirSync(UPLOADS_DIR));
  const res = await action();
  let leftover = [];
  for (let i = 0; i < 20; i += 1) {
    leftover = fs.readdirSync(UPLOADS_DIR).filter((name) => !before.has(name));
    if (!leftover.length) break;
    await sleep(50);
  }
  return { res, leftover };
};

for (const [label, action, expectedStatus] of [
  ['no camera metadata', report({ bare: true }, MG_ROAD), 400],
  ['a stale photo', report({ gps: MG_ROAD, takenAt: new Date(Date.now() - 72 * HOUR) }, MG_ROAD), 400],
  ['a future-dated photo', report({ gps: MG_ROAD, takenAt: new Date(Date.now() + 48 * HOUR) }, MG_ROAD), 400],
  ['a GPS mismatch', report({ gps: CHENNAI }, MG_ROAD), 400],
  ['a missing title', report({ gps: MG_ROAD }, MG_ROAD, { title: '' }), 400],
]) {
  test(`a report rejected for ${label} leaves no file in uploads/`, async () => {
    const { res, leftover } = await uploadsLeftBy(action);
    assert.equal(res.status, expectedStatus, JSON.stringify(res.body));
    assert.deepEqual(leftover, []);
  });
}

test('an accepted report keeps its photo', async () => {
  const res = await report({ gps: MG_ROAD }, MG_ROAD)();
  assert.equal(res.status, 201);
  const name = res.body.photo_url.split('/').pop();
  await sleep(100);
  assert.ok(fs.existsSync(path.join(UPLOADS_DIR, name)));
});

test('a rejected staff update leaves no file in uploads/', async () => {
  const created = await report({ gps: MG_ROAD }, MG_ROAD)();
  const photo = await makePhoto({ fixture: 'streetlight.jpg' });

  const missingIssue = () => {
    const form = new FormData();
    form.append('status', 'Resolved');
    form.append('image', new Blob([photo], { type: 'image/jpeg' }), 'fixed.jpg');
    return api.request('PUT', '/api/issues/00000000-0000-4000-8000-000000000000', { token: staff.token, form });
  };
  const badStatus = () => {
    const form = new FormData();
    form.append('status', 'Closed');
    form.append('image', new Blob([photo], { type: 'image/jpeg' }), 'fixed.jpg');
    return api.request('PUT', `/api/issues/${created.body.id}`, { token: staff.token, form });
  };

  const first = await uploadsLeftBy(missingIssue);
  assert.equal(first.res.status, 404);
  assert.deepEqual(first.leftover, []);

  const second = await uploadsLeftBy(badStatus);
  assert.equal(second.res.status, 400);
  assert.deepEqual(second.leftover, []);
});

// ---------- cleaning up files leaked by older versions ----------

test('pruneOrphanUploads removes old unreferenced uploads only', async () => {
  const { pruneOrphanUploads } = require('../../src/utils/orphanUploads');

  const accepted = await report({ gps: MG_ROAD }, MG_ROAD)();
  assert.equal(accepted.status, 201);
  const referenced = accepted.body.photo_url.split('/').pop();

  const twoHoursAgo = new Date(Date.now() - 2 * HOUR);
  const oldOrphan = `issue-${Date.now()}-${'a'.repeat(24)}.jpg`;
  const newOrphan = `issue-${Date.now()}-${'b'.repeat(24)}.jpg`;
  const unrelated = 'keep-me.txt';
  for (const name of [oldOrphan, newOrphan, unrelated]) {
    fs.writeFileSync(path.join(UPLOADS_DIR, name), 'x');
  }
  fs.utimesSync(path.join(UPLOADS_DIR, oldOrphan), twoHoursAgo, twoHoursAgo);
  fs.utimesSync(path.join(UPLOADS_DIR, referenced), twoHoursAgo, twoHoursAgo);
  fs.utimesSync(path.join(UPLOADS_DIR, unrelated), twoHoursAgo, twoHoursAgo);

  try {
    const dryRun = await pruneOrphanUploads({ dryRun: true });
    assert.ok(dryRun.orphans.includes(oldOrphan));
    assert.ok(!dryRun.orphans.includes(newOrphan), 'recent files are skipped');
    assert.ok(!dryRun.orphans.includes(referenced), 'referenced files are kept');
    assert.ok(!dryRun.orphans.includes(unrelated), 'files the API did not create are ignored');
    assert.deepEqual(dryRun.deleted, []);
    assert.ok(fs.existsSync(path.join(UPLOADS_DIR, oldOrphan)), 'dry run deletes nothing');

    const real = await pruneOrphanUploads({ dryRun: false });
    assert.ok(real.deleted.includes(oldOrphan));
    assert.equal(fs.existsSync(path.join(UPLOADS_DIR, oldOrphan)), false);
    assert.equal(fs.existsSync(path.join(UPLOADS_DIR, referenced)), true);
    assert.equal(fs.existsSync(path.join(UPLOADS_DIR, newOrphan)), true);
  } finally {
    for (const name of [oldOrphan, newOrphan, unrelated]) {
      fs.rmSync(path.join(UPLOADS_DIR, name), { force: true });
    }
  }
});

// ---------- durable photo storage ----------

const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const photoName = (url) => url.split('/').pop();

test('photos are stored in the database and survive losing the local uploads folder', async () => {
  const photo = await makePhoto({ gps: MG_ROAD });
  const res = await api.request('POST', '/api/issues', {
    token: citizen.token,
    form: issueForm({ photo, ...MG_ROAD }),
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const name = photoName(res.body.photo_url);

  const row = await Photo.findByPk(name);
  assert.ok(row, 'photo row saved');
  assert.equal(row.mime_type, 'image/jpeg');
  assert.equal(sha(row.data), sha(photo));

  // Simulate a restart/redeploy on an ephemeral filesystem.
  fs.rmSync(path.join(UPLOADS_DIR, name), { force: true });

  const served = await fetch(res.body.photo_url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/jpeg');
  assert.equal(sha(Buffer.from(await served.arrayBuffer())), sha(photo));
});

test('/uploads only serves names the API generated', async () => {
  for (const pathname of ['/uploads/package.json', '/uploads/..%2Fpackage.json', '/uploads/issue-1-zz.jpg']) {
    const res = await api.request('GET', pathname);
    assert.equal(res.status, 404, pathname);
  }
});

test('deleting an issue removes its photos, including timeline photos', async () => {
  const created = await report({ gps: MG_ROAD }, MG_ROAD)();
  assert.equal(created.status, 201);
  const name = photoName(created.body.photo_url);

  const form = new FormData();
  form.append('status', 'Resolved');
  form.append('image', new Blob([await makePhoto({ fixture: 'streetlight.jpg' })], { type: 'image/jpeg' }), 'fixed.jpg');
  const resolved = await api.request('PUT', `/api/issues/${created.body.id}`, { token: staff.token, form });
  const resolutionName = photoName(resolved.body.resolved_photo_url);

  const del = await api.request('DELETE', `/api/issues/${created.body.id}`, { token: admin.token });
  assert.equal(del.status, 204);

  assert.equal(await Photo.findByPk(name), null);
  assert.equal(await Photo.findByPk(resolutionName), null);
  assert.equal(fs.existsSync(path.join(UPLOADS_DIR, name)), false);
  assert.equal((await fetch(created.body.photo_url)).status, 404);
});

test('replacing a resolution photo keeps the previous one for the timeline', async () => {
  const created = await report({ gps: MG_ROAD }, MG_ROAD)();
  const resolve = async () => {
    const form = new FormData();
    form.append('status', 'Resolved');
    form.append('image', new Blob([await makePhoto({ fixture: 'streetlight.jpg' })], { type: 'image/jpeg' }), 'fixed.jpg');
    const res = await api.request('PUT', `/api/issues/${created.body.id}`, { token: staff.token, form });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.resolved_photo_url;
  };

  const first = await resolve();
  const second = await resolve();
  assert.notEqual(first, second);

  assert.ok(await Photo.findByPk(photoName(first)), 'earlier timeline photo is kept');
  assert.ok(await Photo.findByPk(photoName(second)));
  assert.ok(await Photo.findByPk(photoName(created.body.photo_url)), 'the original evidence photo is kept');

  // Both resolution photos appear in the public timeline.
  const detail = await api.request('GET', `/api/issues/${created.body.id}`);
  const photos = detail.body.updates.map((update) => update.photo_url).filter(Boolean);
  assert.deepEqual(photos, [first, second]);
  assert.equal((await fetch(first)).status, 200);
});

test('pruneOrphanUploads also removes unreferenced photos from the database', async () => {
  const { pruneOrphanUploads } = require('../../src/utils/orphanUploads');
  const accepted = await report({ gps: MG_ROAD }, MG_ROAD)();
  const referenced = photoName(accepted.body.photo_url);
  const orphan = `issue-${Date.now()}-${'c'.repeat(24)}.jpg`;
  await Photo.create({ name: orphan, mime_type: 'image/jpeg', size: 1, data: Buffer.from('x') });

  const old = new Date(Date.now() - 2 * HOUR);
  await sequelize.query('UPDATE photos SET created_at = $1 WHERE name IN ($2, $3)', { bind: [old, orphan, referenced] });

  const dryRun = await pruneOrphanUploads({ dryRun: true });
  assert.ok(dryRun.orphanRows.includes(orphan));
  assert.ok(!dryRun.orphanRows.includes(referenced));
  assert.ok(await Photo.findByPk(orphan), 'dry run deletes nothing');

  const real = await pruneOrphanUploads({ dryRun: false });
  assert.ok(real.deletedRows.includes(orphan));
  assert.equal(await Photo.findByPk(orphan), null);
  assert.ok(await Photo.findByPk(referenced));
});
