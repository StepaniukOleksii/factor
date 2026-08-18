import {beforeEach, describe, expect, it, vi} from 'vitest';
import {DatabaseSync, type SQLInputValue} from 'node:sqlite';
import {SCHEMA} from './Database';
import {SQLiteObservationRepository} from './SQLiteObservationRepository';
import {Metric} from '../domain/Metric';
import {Observation} from '../domain/Observation';

// What `update` must leave alone - `createdAt`, the Metric rows, the Records -
// is only observable against rows that are really there, so these run the app's
// own schema in a real in-memory database.

const {handle} = vi.hoisted(() => ({handle: {} as {db: DatabaseSync}}));

// Only the schema is wanted from the real module; its driver reaches for React
// Native's own sources, which Node cannot parse.
vi.mock('expo-sqlite', () => ({}));
vi.mock('./Database', async importOriginal => ({
  ...await importOriginal<typeof import('./Database')>(),
  getDatabase: async () => ({
    runAsync: async (sql: string, ...params: SQLInputValue[]) =>
      handle.db.prepare(sql).run(...params),
    getAllAsync: async (sql: string, ...params: SQLInputValue[]) =>
      handle.db.prepare(sql).all(...params),
    withTransactionAsync: async (work: () => Promise<void>) => {
      handle.db.exec('BEGIN');
      try {
        await work();
        handle.db.exec('COMMIT');
      } catch (error) {
        handle.db.exec('ROLLBACK');
        throw error;
      }
    },
  }),
}));

const CREATED_AT = new Date(2026, 4, 18, 9, 30);

describe('SQLiteObservationRepository.update', () => {
  let repository: SQLiteObservationRepository;
  /** The subject: two Metrics and a description, so a write past its own columns would show. */
  let subject: Observation;

  beforeEach(async () => {
    handle.db = new DatabaseSync(':memory:');
    handle.db.exec(SCHEMA);
    repository = new SQLiteObservationRepository();

    subject = new Observation(
      'obs-1',
      'Sleep',
      [new Metric('metric-1', 'Hours', 'Numeric'), new Metric('metric-2', 'Quality', 'Text')],
      'How I slept',
      CREATED_AT,
    );
    await repository.save(subject);
    await repository.save(new Observation('obs-2', 'Mood', [new Metric('metric-3', 'Level', 'Numeric')]));

    handle.db.exec(
      "INSERT INTO records (id, observationId, timestamp, note) VALUES ('rec-1', 'obs-1', 1700000000000, 'a note')");
    handle.db.exec(
      "INSERT INTO record_values (recordId, metricId, valueJson) VALUES ('rec-1', 'metric-1', '7')");
  });

  async function stored(id: string): Promise<Observation> {
    const observations = await repository.findAll();
    return observations.find(observation => observation.id === id)!;
  }

  it('round-trips a new name and description', async () => {
    subject.name = 'Rest';
    subject.description = 'How I rested';

    await repository.update(subject);

    const reloaded = await stored('obs-1');
    expect(reloaded.name).toBe('Rest');
    expect(reloaded.description).toBe('How I rested');
  });

  it('round-trips a cleared description as null', async () => {
    subject.description = null;

    await repository.update(subject);

    expect((await stored('obs-1')).description).toBeNull();
  });

  it('leaves createdAt as it was, so the list keeps its order', async () => {
    subject.name = 'Rest';

    await repository.update(subject);

    expect((await stored('obs-1')).createdAt).toEqual(CREATED_AT);
  });

  it('leaves the Observation\'s metric rows alone', async () => {
    subject.name = 'Rest';

    await repository.update(subject);

    const reloaded = await stored('obs-1');
    expect(reloaded.metrics.map(metric => [metric.id, metric.name]))
      .toEqual([['metric-1', 'Hours'], ['metric-2', 'Quality']]);
  });

  it('leaves the Observation\'s records and their values alone', async () => {
    subject.name = 'Rest';

    await repository.update(subject);

    expect(handle.db.prepare('SELECT id, observationId, note FROM records').all())
      .toEqual([{id: 'rec-1', observationId: 'obs-1', note: 'a note'}]);
    expect(handle.db.prepare('SELECT recordId, metricId, valueJson FROM record_values').all())
      .toEqual([{recordId: 'rec-1', metricId: 'metric-1', valueJson: '7'}]);
  });

  it('changes no other Observation\'s row', async () => {
    subject.name = 'Rest';
    subject.description = 'How I rested';

    await repository.update(subject);

    const other = await stored('obs-2');
    expect(other.name).toBe('Mood');
    expect(other.description).toBeNull();
  });
});
