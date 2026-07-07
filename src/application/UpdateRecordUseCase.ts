import {RecordRepository} from './RecordRepository';
import {ObservationRepository} from './ObservationRepository';
import {Record} from '../domain/Record';

export interface UpdateRecordCommand {
  recordId: string;
  observationId: string;
  values: { metricId: string; value: any }[];
}

export class UpdateRecordUseCase {
  constructor(
    private readonly recordRepository: RecordRepository,
    private readonly observationRepository: ObservationRepository
  ) {}

  async execute(command: UpdateRecordCommand): Promise<Record> {
    const observations = await this.observationRepository.findAll();
    const observation = observations.find(obs => obs.id === command.observationId);

    if (!observation) {
      throw new Error(`Observation with id ${command.observationId} not found`);
    }

    const record = await this.recordRepository.getById(command.recordId);

    if (!record) {
      throw new Error(`Record with id ${command.recordId} not found`);
    }

    const valueMap = new Map<string, any>();
    for (const v of command.values) {
      valueMap.set(v.metricId, v.value);
    }

    record.updateValues(valueMap, observation);

    await this.recordRepository.update(record);

    return record;
  }
}
