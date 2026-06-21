import * as Crypto from 'expo-crypto';
import {RecordRepository} from './RecordRepository';
import {ObservationRepository} from './ObservationRepository';
import {Record} from '../domain/Record';

export interface CreateRecordCommand {
  observationId: string;
  values: { metricId: string; value: any }[];
}

export class CreateRecordUseCase {
  constructor(
    private readonly recordRepository: RecordRepository,
    private readonly observationRepository: ObservationRepository
  ) {}

  async execute(command: CreateRecordCommand): Promise<Record> {
    const observations = await this.observationRepository.findAll();
    const observation = observations.find(obs => obs.id === command.observationId);

    if (!observation) {
      throw new Error(`Observation with id ${command.observationId} not found`);
    }

    const valueMap = new Map<string, any>();
    for (const v of command.values) {
      valueMap.set(v.metricId, v.value);
    }

    const id = Crypto.randomUUID();
    const timestamp = new Date();

    const record = observation.createRecord(id, timestamp, valueMap);

    await this.recordRepository.save(record);

    return record;
  }
}
