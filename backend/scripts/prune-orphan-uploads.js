#!/usr/bin/env node
// Lists (or deletes) uploaded photos that no issue references, in uploads/ and
// in the photos table, such as photos from rejected reports that older
// versions of the API left behind.
//
//   npm run prune-uploads            # dry run: list what would be deleted
//   npm run prune-uploads -- --delete
//
// Files modified in the last hour are skipped, so this is safe to run while
// the API is serving traffic.
require('dotenv').config();

const { pruneOrphanUploads } = require('../src/utils/orphanUploads');
const { sequelize } = require('../src/config/db');

const main = async () => {
  const dryRun = !process.argv.includes('--delete');
  const { orphans, deleted, kept, orphanRows, deletedRows } = await pruneOrphanUploads({ dryRun });

  console.log(`Referenced files in uploads/ kept: ${kept}`);
  console.log(`Unreferenced files in uploads/: ${orphans.length}`);
  for (const name of orphans) console.log(`  ${name}`);
  console.log(`Unreferenced photos in the database: ${orphanRows.length}`);
  for (const name of orphanRows) console.log(`  ${name}`);

  if (dryRun) {
    if (orphans.length || orphanRows.length) console.log('\nDry run only. Re-run with --delete to remove them.');
  } else {
    console.log(`Deleted files: ${deleted.length}, deleted database photos: ${deletedRows.length}`);
  }
};

main()
  .catch((error) => {
    console.error('Prune failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
