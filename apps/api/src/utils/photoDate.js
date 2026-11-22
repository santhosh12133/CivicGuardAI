// Capture-date rules for photo evidence.
//
// Only dates embedded in the image itself are trusted. Filesystem dates that
// ExifTool also reports (FileModifyDate, FileAccessDate, FileInodeChangeDate)
// describe the copy the server just saved, so they are always "now" and must
// never be used as the capture time.

const HOUR = 60 * 60 * 1000;

const MAX_PHOTO_AGE_MS = 24 * HOUR;
// Allowance for a phone clock that runs slightly fast.
const FUTURE_SKEW_MS = 15 * 60 * 1000;
// Real-world UTC offsets range from -12:00 to +14:00.
const MAX_OFFSET_AHEAD_MS = 14 * HOUR;
const MAX_OFFSET_BEHIND_MS = 12 * HOUR;

// In order of preference.
const CAPTURE_DATE_TAGS = ['DateTimeOriginal', 'CreateDate', 'GPSDateTime'];

/**
 * Parses an EXIF date (an exiftool-vendored ExifDateTime, a Date, or a string
 * such as "2026:11:21 14:05:09+05:30").
 *
 * @returns {{ date: Date, zoneKnown: boolean } | null}
 *   When the timezone is unknown, `date` is the wall-clock time read as UTC.
 */
const parseExifDate = (value) => {
  if (value === undefined || value === null || value === '') return null;

  // ExifDateTime#toISOString includes an offset only when the zone is known.
  const raw =
    typeof value === 'object' && typeof value.toISOString === 'function'
      ? value.toISOString()
      : String(value);
  if (!raw) return null;

  const iso = raw
    .trim()
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    .replace(/^(\d{4}-\d{2}-\d{2})[ T]/, '$1T');

  const match = iso.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?$/
  );
  if (!match) return null;

  const [, wallClock, zone] = match;
  const zoneKnown = Boolean(zone);
  const normalizedZone = zone && zone !== 'Z' && !zone.includes(':')
    ? `${zone.slice(0, 3)}:${zone.slice(3)}`
    : zone;
  const date = new Date(`${wallClock}${zoneKnown ? normalizedZone : 'Z'}`);
  if (Number.isNaN(date.getTime())) return null;

  return { date, zoneKnown };
};

/**
 * Returns the capture date embedded in the photo, or null when the photo has
 * none.
 *
 * @returns {{ date: Date, zoneKnown: boolean, tag: string } | null}
 */
const getCaptureDate = (exif) => {
  if (!exif) return null;
  for (const tag of CAPTURE_DATE_TAGS) {
    const parsed = parseExifDate(exif[tag]);
    if (parsed) return { ...parsed, tag };
  }
  return null;
};

/**
 * Applies the freshness rules to a capture date.
 *
 * With a known timezone the photo must be at most 24 hours old and not more
 * than 15 minutes in the future.
 *
 * Without a timezone the true moment could be anywhere from 14 hours before
 * to 12 hours after the wall-clock reading. The photo is rejected only if it
 * would be stale (or in the future) in every timezone. Otherwise it is
 * accepted but marked uncertain, so it can be flagged for manual review.
 *
 * @returns {{ ok: true, uncertain: boolean } | { ok: false, reason: 'stale' | 'future' }}
 */
const checkPhotoAge = (capture, now = Date.now()) => {
  const taken = capture.date.getTime();
  const earliest = capture.zoneKnown ? taken : taken - MAX_OFFSET_AHEAD_MS;
  const latest = capture.zoneKnown ? taken : taken + MAX_OFFSET_BEHIND_MS;

  if (earliest > now + FUTURE_SKEW_MS) return { ok: false, reason: 'future' };
  if (latest < now - MAX_PHOTO_AGE_MS) return { ok: false, reason: 'stale' };
  return { ok: true, uncertain: !capture.zoneKnown };
};

module.exports = {
  CAPTURE_DATE_TAGS,
  MAX_PHOTO_AGE_MS,
  FUTURE_SKEW_MS,
  parseExifDate,
  getCaptureDate,
  checkPhotoAge,
};
