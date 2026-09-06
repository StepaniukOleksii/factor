import {SQLiteEventRepository} from './SQLiteEventRepository';
import {SQLiteObservationRepository} from './SQLiteObservationRepository';
import {SQLiteRecordRepository} from './SQLiteRecordRepository';
import {buildEventSeedData, buildSeedData} from './devSeedData';

/**
 * Dev-menu-only commands (wired up in App.tsx, gated by `__DEV__`) that reset the
 * local database to a known fixture dataset for manual QA. See testing-data.md
 * for what gets seeded, testing-android-manually.md for triggering it on-device.
 */

const observationRepository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();
const eventRepository = new SQLiteEventRepository();

/**
 * Wipes every Observation and every Event without seeding anything back - the
 * empty-state fixture. An Observation cascades to its metrics, records and
 * record values through the `ON DELETE CASCADE` foreign keys in Database.ts; an
 * Event belongs to nothing, so it is deleted on its own. Never call from
 * production.
 */
export async function clearDevData(): Promise<void> {
  console.log('[devSeed] Clearing existing observations and events...');
  const existing = await observationRepository.findAll();
  for (const observation of existing) {
    await observationRepository.delete(observation.id);
  }
  const existingEvents = await eventRepository.findAll();
  for (const event of existingEvents) {
    await eventRepository.delete(event.id);
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

  const events = buildEventSeedData();
  for (const event of events) {
    await eventRepository.save(event);
  }

  console.log(`[devSeed] Done. Seeded ${seedData.length} observations and ${events.length} events.`);
}
