import {RecordRepository} from './RecordRepository';

export class CountRecordsUseCase {
  constructor(private readonly recordRepository: RecordRepository) {}

  async execute(observationId: string): Promise<number> {
    return this.recordRepository.countByObservationId(observationId);
  }
}
