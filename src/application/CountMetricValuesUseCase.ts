import {RecordRepository} from './RecordRepository';

export class CountMetricValuesUseCase {
  constructor(private readonly recordRepository: RecordRepository) {}

  async execute(metricIds: readonly string[]): Promise<number> {
    return this.recordRepository.countValuesByMetricIds(metricIds);
  }
}
