import {Event} from '../domain/Event';
import {EventRepository} from './EventRepository';

export interface EventPage {
  events: Event[];
  /** Whether the store holds more Events beyond the ones returned. */
  hasMore: boolean;
}

export class GetEventsUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  public async execute(limit: number): Promise<EventPage> {
    const events = await this.eventRepository.findRecent(limit + 1);

    return {events: events.slice(0, limit), hasMore: events.length > limit};
  }
}
