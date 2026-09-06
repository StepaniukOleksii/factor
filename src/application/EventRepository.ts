import {Event} from '../domain/Event';

export interface EventRepository {
  save(event: Event): Promise<void>;
  /** Most recently occurred first. */
  findAll(): Promise<Event[]>;
  delete(id: string): Promise<void>;
}
