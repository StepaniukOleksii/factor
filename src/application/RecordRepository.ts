import {Record} from '../domain/Record';

export interface RecordRepository {
  save(record: Record): Promise<void>;
  getLastRecordTimestamps(observationIds: string[]): Promise<Map<string, Date>>;
}
