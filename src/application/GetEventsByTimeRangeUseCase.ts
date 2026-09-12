import {Event} from '../domain/Event';
import {EventRepository} from './EventRepository';
import {TimeRange} from './GetMetricSeriesUseCase';

/**
 * Retrieves the Events inside a time window, for drawing over an Observation's
 * trend charts.
 *
 * Takes no Observation id, because an Event is owned by none: every
 * Observation's charts draw the same set, so no caller has to decide which
 * Events are "its".
 */
export class GetEventsByTimeRangeUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(range: TimeRange): Promise<Event[]> {
    return this.eventRepository.findByTimeRange(range);
  }
}
