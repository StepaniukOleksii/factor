import {Observation} from '../domain/Observation';
import {ObservationRepository} from './ObservationRepository';

export class GetObservationsUseCase {
  constructor(private readonly observationRepository: ObservationRepository) {}

  public async execute(): Promise<Observation[]> {
    return this.observationRepository.findAll();
  }
}
