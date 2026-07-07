import {RecordRepository} from './RecordRepository';
import {Record} from '../domain/Record';

export class GetRecordByIdUseCase {
  constructor(private readonly recordRepository: RecordRepository) {}

  async execute(id: string): Promise<Record | null> {
    return this.recordRepository.getById(id);
  }
}
