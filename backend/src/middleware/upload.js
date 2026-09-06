const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadsDir = path.join(__dirname, '../../uploads');
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
    return cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter,
});

module.exports = {
  single: (fieldName) => upload.single(fieldName),
};
