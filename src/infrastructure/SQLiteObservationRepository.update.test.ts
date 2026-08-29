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
    // Stated rather than inherited from the driver's default, as the app's own
    // connection states it: without it a removed Metric's `record_values` are
    // left behind and every test here still passes.
    handle.db.exec('PRAGMA foreign_keys = ON');
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

  it('leaves a Metric it was handed unchanged as it was', async () => {
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

  describe('metrics', () => {
    function withMetrics(metrics: Metric[]): Observation {
      return new Observation('obs-1', subject.name, metrics, subject.description, CREATED_AT);
    }

    it('round-trips a renamed and redescribed Metric under its own id', async () => {
      const renamed = new Metric('metric-1', 'Duration', 'Numeric', {min: 0}, 'Hours in bed');

      await repository.update(withMetrics([renamed, subject.metrics[1]]));

      const reloaded = (await stored('obs-1')).metrics[0];
      expect([reloaded.id, reloaded.name, reloaded.description])
        .toEqual(['metric-1', 'Duration', 'Hours in bed']);
      expect(reloaded.constraint).toEqual({min: 0});
    });

    it('keeps the values a renamed Metric\'s Records hold', async () => {
      await repository.update(withMetrics([
        new Metric('metric-1', 'Duration', 'Numeric'),
        subject.metrics[1],
      ]));

      expect(handle.db.prepare('SELECT recordId, metricId, valueJson FROM record_values').all())
        .toEqual([{recordId: 'rec-1', metricId: 'metric-1', valueJson: '7'}]);
    });

    it('inserts a Metric the table does not hold, after the ones it does', async () => {
      const added = new Metric('metric-4', 'Dreams', 'Text', null, null);

      await repository.update(withMetrics([...subject.metrics, added]));

      expect((await stored('obs-1')).metrics.map(metric => metric.id))
        .toEqual(['metric-1', 'metric-2', 'metric-4']);
    });

    it('writes a rename and an insertion together', async () => {
      await repository.update(withMetrics([
        new Metric('metric-1', 'Duration', 'Numeric'),
        subject.metrics[1],
        new Metric('metric-4', 'Dreams', 'Text'),
      ]));

      expect((await stored('obs-1')).metrics.map(metric => metric.name))
        .toEqual(['Duration', 'Quality', 'Dreams']);
    });

    it('lets two Metrics exchange names', async () => {
      await repository.update(withMetrics([
        new Metric('metric-1', 'Quality', 'Numeric'),
        new Metric('metric-2', 'Hours', 'Text'),
      ]));

      expect((await stored('obs-1')).metrics.map(metric => [metric.id, metric.name]))
        .toEqual([['metric-1', 'Quality'], ['metric-2', 'Hours']]);
    });

    describe('a Metric the aggregate has lost', () => {
      // A second value on `rec-1` and a Record answering `metric-1` alone, so
      // what survives the removal and what is left holding nothing both show.
      beforeEach(() => {
        handle.db.exec(
          `INSERT INTO record_values (recordId, metricId, valueJson) VALUES ('rec-1', 'metric-2', '"Good"')`);
        handle.db.exec(
          "INSERT INTO records (id, observationId, timestamp, note) VALUES ('rec-2', 'obs-1', 1700000001000, null)");
        handle.db.exec(
          "INSERT INTO record_values (recordId, metricId, valueJson) VALUES ('rec-2', 'metric-1', '8')");
      });

      it('is deleted, and the Metrics it still holds are not', async () => {
        await repository.update(withMetrics([subject.metrics[1]]));

        expect((await stored('obs-1')).metrics.map(metric => [metric.id, metric.name]))
          .toEqual([['metric-2', 'Quality']]);
      });

      it('takes its stored values with it, leaving the others on the same Record', async () => {
        await repository.update(withMetrics([subject.metrics[1]]));

        expect(handle.db.prepare('SELECT recordId, metricId, valueJson FROM record_values').all())
          .toEqual([{recordId: 'rec-1', metricId: 'metric-2', valueJson: '"Good"'}]);
      });

      it('leaves a Record now holding no value where it was', async () => {
        await repository.update(withMetrics([subject.metrics[1]]));

        expect(handle.db.prepare('SELECT id FROM records ORDER BY id').all())
          .toEqual([{id: 'rec-1'}, {id: 'rec-2'}]);
      });

      it('frees its name for a Metric added in the same call', async () => {
        await repository.update(withMetrics([
          subject.metrics[1],
          new Metric('metric-4', 'Hours', 'Numeric'),
        ]));

        expect((await stored('obs-1')).metrics.map(metric => [metric.id, metric.name]))
          .toEqual([['metric-2', 'Quality'], ['metric-4', 'Hours']]);
      });

      it('leaves another Observation\'s Metrics and values alone', async () => {
        handle.db.exec(
          "INSERT INTO records (id, observationId, timestamp, note) VALUES ('rec-3', 'obs-2', 1700000002000, null)");
        handle.db.exec(
          "INSERT INTO record_values (recordId, metricId, valueJson) VALUES ('rec-3', 'metric-3', '3')");

        await repository.update(withMetrics([subject.metrics[1]]));

        expect((await stored('obs-2')).metrics.map(metric => metric.id)).toEqual(['metric-3']);
        expect(handle.db.prepare(
          "SELECT metricId FROM record_values WHERE recordId = 'rec-3'").all())
          .toEqual([{metricId: 'metric-3'}]);
      });
    });

    it('leaves another Observation\'s Metrics alone', async () => {
      await repository.update(withMetrics([
        new Metric('metric-1', 'Duration', 'Numeric'),
        subject.metrics[1],
      ]));

      expect((await stored('obs-2')).metrics.map(metric => [metric.id, metric.name]))
        .toEqual([['metric-3', 'Level']]);
    });
  });
});
