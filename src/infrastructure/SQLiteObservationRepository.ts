import {ObservationRepository} from '../application/ObservationRepository';
import {Observation} from '../domain/Observation';
import {getDatabase} from './Database';

export class SQLiteObservationRepository implements ObservationRepository {
  async save(observation: Observation): Promise<void> {
    const db = await getDatabase();
    
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO observations (id, name, createdAt) VALUES (?, ?, ?)',
        [observation.id, observation.name, Date.now()]
      );

      for (const metric of observation.metrics) {
        await db.runAsync(
          'INSERT INTO metrics (id, observationId, name, type, constraintJson) VALUES (?, ?, ?, ?, ?)',
          [
            metric.id,
            observation.id,
            metric.name,
            metric.type,
            metric.constraint ? JSON.stringify(metric.constraint) : null
          ]
        );
      }
    });
  }
}
