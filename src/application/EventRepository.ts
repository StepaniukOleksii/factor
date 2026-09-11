import {Event} from '../domain/Event';

export interface EventRepository {
  save(event: Event): Promise<void>;
  /** Most recently occurred first. */
  findAll(): Promise<Event[]>;
  /** Most recently occurred first, at most `limit` of them. */
  findRecent(limit: number): Promise<Event[]>;
  delete(id: string): Promise<void>;
}
