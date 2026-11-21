const fs = require('fs/promises');
const path = require('path');
const { Issue } = require('../models');
const { uploadsDir } = require('../middleware/upload');

// Only files the upload middleware itself creates are ever considered.
const UPLOAD_NAME = /^issue-\d+-[0-9a-f]{24}\.(jpg|png|gif|webp|bin)$/;
// Skip recent files: they may belong to a request that is still being processed.
const DEFAULT_MIN_AGE_MS = 60 * 60 * 1000;

const fileNameFromUrl = (url) => {
  if (!url) return null;
  try {
    return path.basename(new URL(url).pathname);
  } catch {
    return path.basename(String(url));
  }
};

/**
 * Finds files in uploads/ that no issue references (photo_url or
 * resolved_photo_url), typically photos from rejected reports saved before the
 * upload middleware started cleaning them up. Deletes them unless dryRun.
 *
 * @returns {Promise<{ orphans: string[], deleted: string[], kept: number }>}
 */
const pruneOrphanUploads = async ({
  dir = uploadsDir,
  dryRun = true,
  minAgeMs = DEFAULT_MIN_AGE_MS,
  now = Date.now(),
} = {}) => {
  const issues = await Issue.findAll({ attributes: ['photo_url', 'resolved_photo_url'], raw: true });
  const referenced = new Set();
  for (const issue of issues) {
    for (const url of [issue.photo_url, issue.resolved_photo_url]) {
      const name = fileNameFromUrl(url);
      if (name) referenced.add(name);
    }
  }

  const orphans = [];
  let kept = 0;
  for (const name of await fs.readdir(dir)) {
    if (!UPLOAD_NAME.test(name)) continue;
    if (referenced.has(name)) {
      kept += 1;
      continue;
    }
    const { mtimeMs } = await fs.stat(path.join(dir, name));
    if (now - mtimeMs < minAgeMs) continue;
    orphans.push(name);
  }

  const deleted = [];
  if (!dryRun) {
    for (const name of orphans) {
      await fs.rm(path.join(dir, name), { force: true });
      deleted.push(name);
    }
  }

  return { orphans, deleted, kept };
};

module.exports = { pruneOrphanUploads };
