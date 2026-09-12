import {Event} from '../domain/Event';
import {TimeRange} from './GetMetricSeriesUseCase';

export interface EventRepository {
  save(event: Event): Promise<void>;
  /** Most recently occurred first. */
  findAll(): Promise<Event[]>;
  /** Most recently occurred first, at most `limit` of them. */
  findRecent(limit: number): Promise<Event[]>;
  /**
   * Events whose `occurredAt` falls in the half-open range `[range.start,
   * range.end)`, ordered ascending. Half-open and ascending to match
   * `RecordRepository.getByObservationId`, so one window means the same thing to
   * both and an Event on a boundary lands where a Record there would.
   */
  findByTimeRange(range: TimeRange): Promise<Event[]>;
  delete(id: string): Promise<void>;
}
