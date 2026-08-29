import {Observation} from '../domain/Observation';

export interface ObservationRepository {
  save(observation: Observation): Promise<void>;
  findAll(): Promise<Observation[]>;
  /**
   * Destructive: a Metric the aggregate no longer holds is deleted along with
   * every value stored against it, so the user's intent is established before
   * the call and nowhere else (ADR-6).
   */
  update(observation: Observation): Promise<void>;
  delete(id: string): Promise<void>;
}
