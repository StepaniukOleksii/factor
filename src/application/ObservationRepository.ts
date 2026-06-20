import {Observation} from '../domain/Observation';

export interface ObservationRepository {
  save(observation: Observation): Promise<void>;
  findAll(): Promise<Observation[]>;
}
