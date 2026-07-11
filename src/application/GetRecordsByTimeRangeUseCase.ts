import {RecordRepository} from './RecordRepository';
import {TimeRange} from './GetMetricSeriesUseCase';
import {Record} from '../domain/Record';

/**
 * Retrieves the Records for an Observation within a time window, for charting.
 *
 * Separate from `GetRecentRecordsUseCase` (which fetches the last N Records for
 * the "Recent Records" list): this use case scopes retrieval by a `TimeRange`
 * so trend charts read exactly the window they render.
 */
export class GetRecordsByTimeRangeUseCase {
  constructor(private readonly recordRepository: RecordRepository) {}

  async execute(observationId: string, range: TimeRange): Promise<Record[]> {
    return this.recordRepository.getByObservationId(observationId, range);
  }
}
