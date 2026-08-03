import {SQLiteObservationRepository} from './SQLiteObservationRepository';
import {SQLiteRecordRepository} from './SQLiteRecordRepository';
import {buildSeedData} from './devSeedData';

/**
 * Dev-menu-only commands (wired up in App.tsx, gated by `__DEV__`) that reset the
 * local database to a known fixture dataset for manual QA. See testing-data.md
 * for what gets seeded, testing-android-manually.md for triggering it on-device.
 */

const observationRepository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();

/**
 * Wipes every Observation without seeding anything back - the empty-state
 * fixture. Cascades to metrics, records and record values through the
 * `ON DELETE CASCADE` foreign keys in Database.ts. Never call from production.
 */
export async function clearDevData(): Promise<void> {
  console.log('[devSeed] Clearing existing observations...');
  const existing = await observationRepository.findAll();
  for (const observation of existing) {
    await observationRepository.delete(observation.id);
  }
  console.log('[devSeed] Cleared.');
}

export async function reseedDevData(): Promise<void> {
  await clearDevData();

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
