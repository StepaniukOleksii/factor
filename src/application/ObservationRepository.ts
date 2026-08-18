import {Observation} from '../domain/Observation';

export interface ObservationRepository {
  save(observation: Observation): Promise<void>;
  findAll(): Promise<Observation[]>;
  /**
   * Writes the Observation's own columns and no Metric of it: a Metric added,
   * removed or renamed on the aggregate handed here is dropped without a word
   * (ADR-6).
   */
  update(observation: Observation): Promise<void>;
  delete(id: string): Promise<void>;
}
