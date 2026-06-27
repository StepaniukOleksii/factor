import {ObservationRepository} from '../application/ObservationRepository';
import {Observation} from '../domain/Observation';
import {Metric, MetricConstraint, MetricValueType} from '../domain/Metric';
import {getDatabase} from './Database';

interface ObservationRow {
  id: string;
  name: string;
  createdAt: number;
}

interface MetricRow {
  id: string;
  observationId: string;
  name: string;
  type: string;
  constraintJson: string | null;
}

export class SQLiteObservationRepository implements ObservationRepository {
  async save(observation: Observation): Promise<void> {
    const db = await getDatabase();
    
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO observations (id, name, createdAt) VALUES (?, ?, ?)',
        observation.id,
        observation.name,
        Date.now()
      );

      for (const metric of observation.metrics) {
        await db.runAsync(
          'INSERT INTO metrics (id, observationId, name, type, constraintJson) VALUES (?, ?, ?, ?, ?)',
          metric.id,
          observation.id,
          metric.name,
          metric.type,
          metric.constraint ? JSON.stringify(metric.constraint) : null
        );
      }
    });
  }

  async findAll(): Promise<Observation[]> {
    const db = await getDatabase();

    const observationRows = await db.getAllAsync<ObservationRow>(
      'SELECT id, name, createdAt FROM observations ORDER BY createdAt DESC'
    );

    if (observationRows.length === 0) {
      return [];
    }

    const metricRows = await db.getAllAsync<MetricRow>(
      'SELECT id, observationId, name, type, constraintJson FROM metrics'
    );

    const metricsByObservation = new Map<string, Metric[]>();
    for (const row of metricRows) {
      const constraint: MetricConstraint = row.constraintJson
        ? JSON.parse(row.constraintJson)
        : null;
      const metric = new Metric(row.id, row.name, row.type as MetricValueType, constraint);

      const existing = metricsByObservation.get(row.observationId) ?? [];
      existing.push(metric);
      metricsByObservation.set(row.observationId, existing);
    }

    return observationRows.map(row => {
      const metrics = metricsByObservation.get(row.id) ?? [];
      return new Observation(row.id, row.name, metrics);
    });
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
