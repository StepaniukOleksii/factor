import {ObservationRepository} from './ObservationRepository';
import {Observation} from '../domain/Observation';

export class GetObservationByIdUseCase {
  constructor(private readonly repository: ObservationRepository) {}

  async execute(id: string): Promise<Observation | null> {
    const observations = await this.repository.findAll();
    return observations.find(obs => obs.id === id) || null;
  }
}
