const fs = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');
const { Issue, Photo } = require('../models');
const { UPLOADS_DIR, UPLOAD_NAME, photoNameFromUrl } = require('./photoStore');

// Skip recent items: they may belong to a request that is still being processed.
const DEFAULT_MIN_AGE_MS = 60 * 60 * 1000;

/**
 * Finds uploaded photos that no issue references (photo_url or
 * resolved_photo_url), both files in uploads/ and rows in the photos table.
 * Typical sources: rejected reports saved by older versions of the API, or
 * issues deleted before photos were cleaned up with them. Deletes them
 * unless dryRun.
 *
 * @returns {Promise<{ orphans: string[], deleted: string[], kept: number,
 *                     orphanRows: string[], deletedRows: string[] }>}
 */
const pruneOrphanUploads = async ({
  dir = UPLOADS_DIR,
  dryRun = true,
  minAgeMs = DEFAULT_MIN_AGE_MS,
  now = Date.now(),
} = {}) => {
  const issues = await Issue.findAll({ attributes: ['photo_url', 'resolved_photo_url'], raw: true });
  const referenced = new Set();
  for (const issue of issues) {
    for (const url of [issue.photo_url, issue.resolved_photo_url]) {
      const name = photoNameFromUrl(url);
      if (name) referenced.add(name);
    }
  }

  // Files on local disk.
  const orphans = [];
  let kept = 0;
  let entries = [];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const name of entries) {
    if (!UPLOAD_NAME.test(name)) continue;
    if (referenced.has(name)) {
      kept += 1;
      continue;
    }
    const { mtimeMs } = await fs.stat(path.join(dir, name));
    if (now - mtimeMs < minAgeMs) continue;
    orphans.push(name);
  }

  // Rows in the photos table.
  const rows = await Photo.findAll({
    attributes: ['name'],
    where: { created_at: { [Op.lt]: new Date(now - minAgeMs) } },
    raw: true,
  });
  const orphanRows = rows.map((row) => row.name).filter((name) => !referenced.has(name));

  const deleted = [];
  const deletedRows = [];
  if (!dryRun) {
    for (const name of orphans) {
      await fs.rm(path.join(dir, name), { force: true });
      deleted.push(name);
    }
    if (orphanRows.length) {
      await Photo.destroy({ where: { name: orphanRows } });
      deletedRows.push(...orphanRows);
    }
  }

  return { orphans, deleted, kept, orphanRows, deletedRows };
};

module.exports = { pruneOrphanUploads };
