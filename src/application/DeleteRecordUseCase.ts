import {RecordRepository} from './RecordRepository';

export class DeleteRecordUseCase {
  constructor(private readonly recordRepository: RecordRepository) {}

  async execute(recordId: string): Promise<void> {
    await this.recordRepository.deleteById(recordId);
  }
}
