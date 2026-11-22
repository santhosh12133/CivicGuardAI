const test = require('node:test');
const assert = require('node:assert/strict');
const { parseExifDate, getCaptureDate, checkPhotoAge } = require('../../src/utils/photoDate');

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-11-21T12:00:00Z');

// ---------- parseExifDate ----------

test('parses an EXIF string with an offset', () => {
  const parsed = parseExifDate('2026:11:21 17:30:00+05:30');
  assert.equal(parsed.zoneKnown, true);
  assert.equal(parsed.date.toISOString(), '2026-11-21T12:00:00.000Z');
});

test('parses compact offsets and Z', () => {
  assert.equal(parseExifDate('2026:11:21 07:00:00-0500').date.toISOString(), '2026-11-21T12:00:00.000Z');
  assert.equal(parseExifDate('2026-11-21T12:00:00Z').date.toISOString(), '2026-11-21T12:00:00.000Z');
});

test('marks a date without an offset as zone-unknown (wall clock read as UTC)', () => {
  const parsed = parseExifDate('2026:11:21 12:00:00');
  assert.equal(parsed.zoneKnown, false);
  assert.equal(parsed.date.toISOString(), '2026-11-21T12:00:00.000Z');
});

test('uses toISOString from ExifDateTime-like objects', () => {
  const withZone = { toISOString: () => '2026-11-21T17:30:00.000+05:30' };
  const withoutZone = { toISOString: () => '2026-11-21T12:00:00.000' };
  assert.equal(parseExifDate(withZone).zoneKnown, true);
  assert.equal(parseExifDate(withZone).date.toISOString(), '2026-11-21T12:00:00.000Z');
  assert.equal(parseExifDate(withoutZone).zoneKnown, false);
});

test('returns null for empty or unparseable values', () => {
  for (const value of [undefined, null, '', '0000:00:00 00:00:00', 'yesterday', {}]) {
    assert.equal(parseExifDate(value), null, `value ${JSON.stringify(value)}`);
  }
});

// ---------- getCaptureDate ----------

test('prefers DateTimeOriginal, then CreateDate, then GPSDateTime', () => {
  const all = {
    DateTimeOriginal: '2026:11:21 10:00:00Z',
    CreateDate: '2026:11:21 09:00:00Z',
    GPSDateTime: '2026:11:21 08:00:00Z',
  };
  assert.equal(getCaptureDate(all).tag, 'DateTimeOriginal');
  assert.equal(getCaptureDate({ CreateDate: all.CreateDate, GPSDateTime: all.GPSDateTime }).tag, 'CreateDate');
  assert.equal(getCaptureDate({ GPSDateTime: all.GPSDateTime }).tag, 'GPSDateTime');
});

test('never uses filesystem dates as the capture date', () => {
  const exif = {
    Make: 'TestCam',
    FileModifyDate: '2026:11:21 12:00:00+00:00',
    FileAccessDate: '2026:11:21 12:00:00+00:00',
    FileInodeChangeDate: '2026:11:21 12:00:00+00:00',
  };
  assert.equal(getCaptureDate(exif), null);
});

// ---------- checkPhotoAge: timezone known ----------

const known = (offsetMs) => ({ date: new Date(NOW + offsetMs), zoneKnown: true });

test('accepts a recent photo with a known timezone', () => {
  assert.deepEqual(checkPhotoAge(known(-10 * 60 * 1000), NOW), { ok: true, uncertain: false });
  assert.deepEqual(checkPhotoAge(known(-23.9 * HOUR), NOW), { ok: true, uncertain: false });
});

test('rejects a photo older than 24 hours', () => {
  assert.deepEqual(checkPhotoAge(known(-24.1 * HOUR), NOW), { ok: false, reason: 'stale' });
});

test('allows a phone clock up to 15 minutes fast', () => {
  assert.equal(checkPhotoAge(known(14 * 60 * 1000), NOW).ok, true);
});

test('rejects a photo dated in the future', () => {
  assert.deepEqual(checkPhotoAge(known(20 * 60 * 1000), NOW), { ok: false, reason: 'future' });
  assert.deepEqual(checkPhotoAge(known(48 * HOUR), NOW), { ok: false, reason: 'future' });
});

// ---------- checkPhotoAge: timezone unknown ----------

const unknown = (offsetMs) => ({ date: new Date(NOW + offsetMs), zoneKnown: false });

test('accepts but flags a zoneless photo that is fresh in some timezone', () => {
  // A phone at UTC+05:30 writing local time looks 5.5 h "ahead" of UTC.
  assert.deepEqual(checkPhotoAge(unknown(5.5 * HOUR), NOW), { ok: true, uncertain: true });
  // A phone at UTC-08:00 photo taken 20 h ago looks 28 h old when read as UTC.
  assert.deepEqual(checkPhotoAge(unknown(-28 * HOUR), NOW), { ok: true, uncertain: true });
});

test('rejects a zoneless photo that is in the future in every timezone', () => {
  assert.deepEqual(checkPhotoAge(unknown(14.5 * HOUR), NOW), { ok: false, reason: 'future' });
});

test('rejects a zoneless photo that is stale in every timezone', () => {
  assert.deepEqual(checkPhotoAge(unknown(-36.5 * HOUR), NOW), { ok: false, reason: 'stale' });
  assert.deepEqual(checkPhotoAge(unknown(-72 * HOUR), NOW), { ok: false, reason: 'stale' });
});
