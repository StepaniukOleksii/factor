import {RecordRepository} from './RecordRepository';
import {Record} from '../domain/Record';

export class GetRecentRecordsUseCase {
  constructor(private readonly recordRepository: RecordRepository) {}

  async execute(observationId: string, limit: number = 3): Promise<Record[]> {
    return this.recordRepository.getRecentRecords(observationId, limit);
  }
}
