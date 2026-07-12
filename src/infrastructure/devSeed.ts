import {SQLiteObservationRepository} from './SQLiteObservationRepository';
import {SQLiteRecordRepository} from './SQLiteRecordRepository';
import {buildSeedData} from './devSeedData';

/**
 * Dev-menu-only command (wired up in App.tsx, gated by `__DEV__`) that resets
 * the local database to a known fixture dataset for manual QA — see
 * testing-data.md for what gets seeded and why, and testing-android.md for
 * how to trigger it on-device.
 *
 * Destructive: wipes every existing observation (cascading to its metrics,
 * records, and record values via the `ON DELETE CASCADE` foreign keys set up
 * in Database.ts) before inserting the fixture set. Never call this from a
 * production code path.
 */

const observationRepository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();

export async function reseedDevData(): Promise<void> {
  console.log('[devSeed] Clearing existing observations...');
  const existing = await observationRepository.findAll();
  for (const observation of existing) {
    await observationRepository.delete(observation.id);
  }

  console.log('[devSeed] Inserting seed dataset...');
  const seedData = buildSeedData();
  for (const {observation, records} of seedData) {
    await observationRepository.save(observation);
    for (const record of records) {
      await recordRepository.save(record);
    }
  }

  console.log(`[devSeed] Done. Seeded ${seedData.length} observations.`);
}
