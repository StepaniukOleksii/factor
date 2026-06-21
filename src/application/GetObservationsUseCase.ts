import {Observation} from '../domain/Observation';
import {ObservationRepository} from './ObservationRepository';
import {RecordRepository} from './RecordRepository';

export interface ObservationListItem {
  observation: Observation;
  lastRecordAt: Date | null;
}

export class GetObservationsUseCase {
  constructor(
    private readonly observationRepository: ObservationRepository,
    private readonly recordRepository: RecordRepository
  ) {}

  public async execute(): Promise<ObservationListItem[]> {
    const observations = await this.observationRepository.findAll();
    const observationIds = observations.map(o => o.id);
    const lastRecordTimestamps = await this.recordRepository.getLastRecordTimestamps(observationIds);

    return observations.map(obs => ({
      observation: obs,
      lastRecordAt: lastRecordTimestamps.get(obs.id) || null
    }));
  }
}
