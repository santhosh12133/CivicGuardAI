const fs = require('fs/promises');
const path = require('path');
const { Photo } = require('../models');

// Where multer writes incoming files. On hosts with an ephemeral filesystem
// this is only a cache; the photos table is the durable copy.
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Names the upload middleware generates. Anything else is never stored or served.
const UPLOAD_NAME = /^issue-\d+-[0-9a-f]{24}\.(jpg|png|gif|webp|bin)$/;

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** Returns the upload filename referenced by a photo URL, or null. */
const photoNameFromUrl = (url) => {
  if (!url) return null;
  let pathname = String(url);
  try {
    pathname = new URL(pathname).pathname;
  } catch {
    // Relative or malformed: fall back to the raw string.
  }
  const name = path.basename(pathname);
  return UPLOAD_NAME.test(name) ? name : null;
};

/**
 * Copies a file saved by the upload middleware into the photos table.
 * The local file stays as a cache; the database copy is the durable one.
 */
const savePhoto = async (file) => {
  const data = await fs.readFile(file.path);
  await Photo.upsert({
    name: file.filename,
    mime_type: MIME_TYPES[path.extname(file.filename)] || file.mimetype || 'application/octet-stream',
    size: data.length,
    data,
  });
  return file.filename;
};

/**
 * Deletes stored photos (database row and local cached file) by URL or name.
 * Unknown names are ignored.
 */
const deletePhotos = async (...urlsOrNames) => {
  const names = [...new Set(urlsOrNames.map(photoNameFromUrl).filter(Boolean))];
  if (!names.length) return 0;
  await Promise.all(names.map((name) => fs.rm(path.join(UPLOADS_DIR, name), { force: true })));
  return Photo.destroy({ where: { name: names } });
};

/** Loads a stored photo, or null. */
const findPhoto = async (name) => {
  if (!UPLOAD_NAME.test(name)) return null;
  return Photo.findByPk(name);
};

module.exports = {
  UPLOADS_DIR,
  UPLOAD_NAME,
  photoNameFromUrl,
  savePhoto,
  deletePhotos,
  findPhoto,
};
