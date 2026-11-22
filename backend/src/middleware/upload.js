const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

const { UPLOADS_DIR: uploadsDir, deletePhotos } = require('../utils/photoStore');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const extensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const extension = extensions[file.mimetype];
    const filename = `issue-${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension || '.bin'}`;
    cb(null, filename);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!extensions[file.mimetype]) {
    const error = new Error('Only JPEG, PNG, GIF, and WebP images are allowed');
    error.statusCode = 400;
    return cb(error);
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter,
});

// Multer reports client mistakes (oversized file, extra files, wrong field
// name) as MulterError without an HTTP status, which the error handler would
// otherwise turn into a 500. Give them proper 4xx statuses here.
const toClientError = (error) => {
  if (!(error instanceof multer.MulterError)) return error;
  const clientError = new Error(
    error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 10 MB or smaller' : error.message
  );
  clientError.statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  return clientError;
};

// Multer saves the file before the controller validates it. If the request
// then fails (bad fields, rejected evidence, missing issue, server error),
// remove the file, and any copy already saved to the photos table, so
// rejected photos are not kept or served from /uploads.
const discardFileOnFailure = (req, res) => {
  if (!req.file || !req.file.filename) return;
  const { filename } = req.file;
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    deletePhotos(filename).catch((error) => {
      console.warn('Could not remove rejected upload:', filename, error.code || error.message);
    });
  });
};

module.exports = {
  uploadsDir,
  single: (fieldName) => {
    const handler = upload.single(fieldName);
    return (req, res, next) =>
      handler(req, res, (error) => {
        if (error) return next(toClientError(error));
        discardFileOnFailure(req, res);
        return next();
      });
  },
};
