import {RecordRepository} from '../application/RecordRepository';
import {Record} from '../domain/Record';
import {getDatabase} from './Database';

export class SQLiteRecordRepository implements RecordRepository {
  async save(record: Record): Promise<void> {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO records (id, observationId, timestamp) VALUES (?, ?, ?)',
        [record.id, record.observationId, record.timestamp.getTime()]
      );

      for (const [metricId, value] of record.values.entries()) {
        await db.runAsync(
          'INSERT INTO record_values (recordId, metricId, valueJson) VALUES (?, ?, ?)',
          [record.id, metricId, JSON.stringify(value)]
        );
      }
    });
  }

  async getLastRecordTimestamps(observationIds: string[]): Promise<Map<string, Date>> {
    const db = await getDatabase();
    const map = new Map<string, Date>();
    
    if (observationIds.length === 0) return map;

    const placeholders = observationIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<{observationId: string, maxTimestamp: number}>(
      `SELECT observationId, MAX(timestamp) as maxTimestamp FROM records WHERE observationId IN (${placeholders}) GROUP BY observationId`,
      ...observationIds
    );

    for (const row of rows) {
      map.set(row.observationId, new Date(row.maxTimestamp));
    }

    return map;
  }
  async getRecentRecords(observationId: string, limit: number): Promise<Record[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ id: string, timestamp: number }>(
      'SELECT id, timestamp FROM records WHERE observationId = ? ORDER BY timestamp DESC LIMIT ?',
      observationId,
      limit
    );

    const records: Record[] = [];
    for (const row of rows) {
      const record = new Record(
        row.id,
        observationId,
        new Date(row.timestamp),
        new Map()
      );

      const valueRows = await db.getAllAsync<{ metricId: string, valueJson: string }>(
        'SELECT metricId, valueJson FROM record_values WHERE recordId = ?',
        [row.id]
      );

      for (const valueRow of valueRows) {
        record.values.set(valueRow.metricId, JSON.parse(valueRow.valueJson));
      }

      records.push(record);
    }

    return records;
  }
}
