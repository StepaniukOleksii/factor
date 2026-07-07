import {Record} from '../domain/Record';

export interface RecordRepository {
  save(record: Record): Promise<void>;
  getLastRecordTimestamps(observationIds: string[]): Promise<Map<string, Date>>;
  getRecentRecords(observationId: string, limit: number): Promise<Record[]>;
  deleteByObservationId(observationId: string): Promise<void>;
  deleteById(recordId: string): Promise<void>;
  getById(recordId: string): Promise<Record | null>;
  update(record: Record): Promise<void>;
}
