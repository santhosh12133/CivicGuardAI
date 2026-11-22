const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { exiftool } = require('../../src/utils/exiftool');

const FIXTURES = path.join(__dirname, '..', 'fixtures');

// EXIF dates are wall-clock strings. Write them in UTC with an explicit offset
// so the result does not depend on the CI machine's timezone.
const exifDate = (date) => date.toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, ':');

/**
 * Copies a fixture image to a temp file and stamps it with EXIF metadata,
 * the way a phone camera would. Returns the photo bytes.
 *
 * @param {object} opts
 * @param {string} [opts.fixture] - 'pothole.jpg' or 'streetlight.jpg'
 * @param {Date|null} [opts.takenAt] - DateTimeOriginal; null to omit
 * @param {{lat:number, lon:number}|null} [opts.gps] - embedded GPS; null to omit
 * @param {boolean} [opts.camera] - write Make/Model
 * @param {boolean} [opts.bare] - return the fixture with no EXIF at all
 * @param {boolean} [opts.zone] - write a UTC offset for the date (false = timezone unknown)
 * @param {string} [opts.dateTag] - 'DateTimeOriginal' or 'CreateDate'
 */
const makePhoto = async ({
  fixture = 'pothole.jpg',
  takenAt = new Date(Date.now() - 10 * 60 * 1000),
  gps = null,
  camera = true,
  bare = false,
  zone = true,
  dateTag = 'DateTimeOriginal',
} = {}) => {
  const source = path.join(FIXTURES, fixture);
  if (bare) return fs.readFile(source);

  const target = path.join(os.tmpdir(), `civicguard-${crypto.randomBytes(6).toString('hex')}.jpg`);
  await fs.copyFile(source, target);

  const tags = {};
  if (camera) Object.assign(tags, { Make: 'TestCam', Model: 'Fixture One' });
  if (takenAt) {
    tags[dateTag] = exifDate(takenAt);
    if (zone) {
      // OffsetTimeOriginal pairs with DateTimeOriginal, OffsetTimeDigitized with CreateDate.
      tags[dateTag === 'CreateDate' ? 'OffsetTimeDigitized' : 'OffsetTimeOriginal'] = '+00:00';
    }
  }
  if (gps) {
    Object.assign(tags, {
      GPSLatitude: Math.abs(gps.lat),
      GPSLatitudeRef: gps.lat >= 0 ? 'N' : 'S',
      GPSLongitude: Math.abs(gps.lon),
      GPSLongitudeRef: gps.lon >= 0 ? 'E' : 'W',
    });
  }

  await exiftool.write(target, tags, ['-overwrite_original']);
  const bytes = await fs.readFile(target);
  await fs.rm(target, { force: true });
  return bytes;
};

/** Builds the multipart body the mobile app sends when reporting an issue. */
const issueForm = ({ photo, mimeType = 'image/jpeg', filename = 'photo.jpg', lat, lon, title = 'Pothole', description = 'Deep pothole near the bus stop' }) => {
  const form = new FormData();
  form.append('title', title);
  form.append('description', description);
  form.append('latitude', String(lat));
  form.append('longitude', String(lon));
  if (photo) form.append('image', new Blob([photo], { type: mimeType }), filename);
  return form;
};

module.exports = { makePhoto, issueForm };
