#!/usr/bin/env node
// Lists (or deletes) uploaded photos that no issue references, such as photos
// from rejected reports that older versions of the API left in uploads/.
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
  const { orphans, deleted, kept } = await pruneOrphanUploads({ dryRun });

  console.log(`Referenced uploads kept: ${kept}`);
  console.log(`Unreferenced uploads found: ${orphans.length}`);
  for (const name of orphans) console.log(`  ${name}`);

  if (dryRun) {
    if (orphans.length) console.log('\nDry run only. Re-run with --delete to remove them.');
  } else {
    console.log(`Deleted: ${deleted.length}`);
  }
};

main()
  .catch((error) => {
    console.error('Prune failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
