import type * as SQLite from 'expo-sqlite';
import {ObservationRepository} from '../application/ObservationRepository';
import {Observation} from '../domain/Observation';
import {Metric, MetricConstraint, MetricValueType} from '../domain/Metric';
import {getDatabase} from './Database';

interface ObservationRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
}

interface MetricRow {
  id: string;
  observationId: string;
  name: string;
  type: string;
  constraintJson: string | null;
  description: string | null;
}

export class SQLiteObservationRepository implements ObservationRepository {
  async save(observation: Observation): Promise<void> {
    const db = await getDatabase();
    
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO observations (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
        observation.id,
        observation.name,
        observation.description,
        observation.createdAt.getTime()
      );

      for (const metric of observation.metrics) {
        await db.runAsync(
          'INSERT INTO metrics (id, observationId, name, type, constraintJson, description) VALUES (?, ?, ?, ?, ?, ?)',
          metric.id,
          observation.id,
          metric.name,
          metric.type,
          metric.constraint ? JSON.stringify(metric.constraint) : null,
          metric.description
        );
      }
    });
  }

  async findAll(): Promise<Observation[]> {
    const db = await getDatabase();

    const observationRows = await db.getAllAsync<ObservationRow>(
      'SELECT id, name, description, createdAt FROM observations ORDER BY createdAt DESC'
    );

    if (observationRows.length === 0) {
      return [];
    }

    // Declaration order is what every screen renders in, and `rowid` is the
    // only record of it: `metrics` carries no position column.
    const metricRows = await db.getAllAsync<MetricRow>(
      'SELECT id, observationId, name, type, constraintJson, description FROM metrics ORDER BY rowid'
    );

    const metricsByObservation = new Map<string, Metric[]>();
    for (const row of metricRows) {
      const constraint: MetricConstraint = row.constraintJson
        ? JSON.parse(row.constraintJson)
        : null;
      const metric = new Metric(
        row.id,
        row.name,
        row.type as MetricValueType,
        constraint,
        row.description
      );

      const existing = metricsByObservation.get(row.observationId) ?? [];
      existing.push(metric);
      metricsByObservation.set(row.observationId, existing);
    }

    return observationRows.map(row => {
      const metrics = metricsByObservation.get(row.id) ?? [];
      return new Observation(row.id, row.name, metrics, row.description, new Date(row.createdAt));
    });
  }

  // `createdAt` is deliberately absent from the SET list: it is what orders the
  // list, and a rename is not a re-creation. A row that is gone updates nothing
  // - the use case has already established the Observation exists.
  async update(observation: Observation): Promise<void> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await this.deleteRemovedMetrics(db, observation);

      await db.runAsync(
        'UPDATE observations SET name = ?, description = ? WHERE id = ?',
        observation.name,
        observation.description,
        observation.id
      );

      // SQLite checks the name index as each statement runs, so two Metrics
      // exchanging names would collide on the first of the two. Parking every
      // name on its own id clears the way: ids are unique, and none can be a
      // name a user typed.
      await db.runAsync('UPDATE metrics SET name = id WHERE observationId = ?', observation.id);

      for (const metric of observation.metrics) {
        await db.runAsync(
          `INSERT INTO metrics (id, observationId, name, type, constraintJson, description)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             type = excluded.type,
             constraintJson = excluded.constraintJson,
             description = excluded.description`,
          metric.id,
          observation.id,
          metric.name,
          metric.type,
          metric.constraint ? JSON.stringify(metric.constraint) : null,
          metric.description
        );
      }
    });
  }

  /**
   * The aggregate is the whole statement of what the Observation holds, so a
   * Metric absent from it is gone - its `record_values` with it, through the
   * schema's own cascade (ADR-6).
   */
  private async deleteRemovedMetrics(
    db: SQLite.SQLiteDatabase,
    observation: Observation
  ): Promise<void> {
    const held = observation.metrics.map(metric => metric.id);
    const placeholders = held.map(() => '?').join(',');

    await db.runAsync(
      `DELETE FROM metrics WHERE observationId = ? AND id NOT IN (${placeholders})`,
      observation.id,
      ...held
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'DELETE FROM observations WHERE id = ?',
        id
      );
    });
  }
}
