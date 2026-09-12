#!/usr/bin/env node
/**
 * Delete what WanderGuesser no longer needs: expired round-cache rows
 * and sign-in links, play-meter rows for days long past, and rooms
 * nobody will open again.
 *
 *   npm run geo:sweep
 *
 * The round route also runs this at most once an hour per process, so
 * a normal deployment keeps itself tidy without anybody running it.
 * This exists for a one-off, for a cron, and for seeing the counts.
 *
 * Reads DATABASE_URL (or GEO_DATABASE_URL) from the environment.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local'), override: true });

async function main() {
  const { sweepGeo, RETENTION } = await import('../app/lib/geo/server/sweep.js');
  const { prismaRoomStore } = await import('../app/lib/geo/server/roomStore.js');
  console.log('Sweeping WanderGuesser tables.');
  console.log(`  usage rows older than ${RETENTION.usageDays} days`);
  console.log(`  rooms finished over ${RETENTION.finishedRoomDays} days ago, abandoned over ${RETENTION.staleRoomDays}`);
  const swept = await sweepGeo(prismaRoomStore);
  for (const [table, count] of Object.entries(swept)) console.log(`  ${table}: ${count}`);
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
