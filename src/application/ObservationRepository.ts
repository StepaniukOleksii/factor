import {Observation} from '../domain/Observation';

export interface ObservationRepository {
  save(observation: Observation): Promise<void>;
  findAll(): Promise<Observation[]>;
  /**
   * Cannot remove a Metric: an aggregate that has lost one the table still holds
   * is refused rather than written (ADR-6).
   */
  update(observation: Observation): Promise<void>;
  delete(id: string): Promise<void>;
}
