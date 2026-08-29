import {Record} from '../domain/Record';
import {TimeRange} from './GetMetricSeriesUseCase';

export interface RecordRepository {
  save(record: Record): Promise<void>;
  getLastRecordTimestamps(observationIds: string[]): Promise<Map<string, Date>>;
  getRecentRecords(observationId: string, limit: number): Promise<Record[]>;
  /**
   * Records for the given Observation whose `timestamp` falls in the half-open
   * range `[range.start, range.end)`, ordered ascending by timestamp.
   */
  getByObservationId(observationId: string, range: TimeRange): Promise<Record[]>;
  countByObservationId(observationId: string): Promise<number>;
  /**
   * The stored values held across those Metrics, one Record answering two of
   * them counting twice.
   */
  countValuesByMetricIds(metricIds: readonly string[]): Promise<number>;
  deleteByObservationId(observationId: string): Promise<void>;
  deleteById(recordId: string): Promise<void>;
  getById(recordId: string): Promise<Record | null>;
  update(record: Record): Promise<void>;
}
