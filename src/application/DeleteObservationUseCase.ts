import {ObservationRepository} from './ObservationRepository';
import {RecordRepository} from './RecordRepository';

export class DeleteObservationUseCase {
  constructor(
    private readonly observationRepository: ObservationRepository,
    private readonly recordRepository: RecordRepository,
  ) {}

  async execute(observationId: string): Promise<void> {
    await this.recordRepository.deleteByObservationId(observationId);
    await this.observationRepository.delete(observationId);
  }
}
