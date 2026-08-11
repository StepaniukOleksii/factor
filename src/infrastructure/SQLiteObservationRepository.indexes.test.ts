import {beforeEach, describe, expect, it, vi} from 'vitest';
import {DatabaseSync, type SQLInputValue} from 'node:sqlite';
import {SCHEMA} from './Database';
import {SQLiteObservationRepository} from './SQLiteObservationRepository';
import {Metric} from '../domain/Metric';
import {Observation} from '../domain/Observation';

// What the unique indexes refuse is SQLite's own behaviour - `NOCASE` above all -
// so these run the app's own schema in a real in-memory database. The suite
// beside this one mocks the driver away, to assert the SQL instead.

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

describe('SQLiteObservationRepository against the real schema', () => {
  let repository: SQLiteObservationRepository;

  beforeEach(() => {
    handle.db = new DatabaseSync(':memory:');
    handle.db.exec(SCHEMA);
    repository = new SQLiteObservationRepository();
  });

  function observation(id: string, name: string, metricNames: string[]): Observation {
    return new Observation(id, name,
      metricNames.map((metricName, index) => new Metric(`${id}-m${index}`, metricName, 'Numeric')));
  }

  it('should reject a second observation whose name differs from a stored one only in case', async () => {
    await repository.save(observation('o1', 'Sleep', ['Hours']));

    await expect(repository.save(observation('o2', 'sleep', ['Hours'])))
      .rejects.toThrow(/UNIQUE constraint failed/);
    expect(await repository.findAll()).toHaveLength(1);
  });

  it('should accept observations whose names are distinct', async () => {
    await repository.save(observation('o1', 'Sleep', ['Hours']));
    await repository.save(observation('o2', 'Mood', ['Level']));

    expect(await repository.findAll()).toHaveLength(2);
  });

  // The aggregate refuses to hold a colliding pair at all, so the fixture is
  // built sound and then spoiled - a writer bypassing the domain being the one
  // the index is here to catch.
  it('should reject two metrics on one observation whose names differ only in case', async () => {
    const spoiled = observation('o1', 'Sleep', ['Hours', 'Quality']);
    spoiled.metrics[1].name = 'hours';

    await expect(repository.save(spoiled)).rejects.toThrow(/UNIQUE constraint failed/);
    expect(await repository.findAll()).toHaveLength(0);
  });

  it('should accept the same metric name on two different observations', async () => {
    await repository.save(observation('o1', 'Sleep', ['Hours']));
    await repository.save(observation('o2', 'Work', ['hours']));

    const metricNames = new Map((await repository.findAll()).map(o => [o.name, o.metrics[0].name]));
    expect(metricNames.get('Sleep')).toBe('Hours');
    expect(metricNames.get('Work')).toBe('hours');
  });
});
