import * as Crypto from 'expo-crypto';
import {Observation} from '../domain/Observation';
import {Metric, MetricValueType} from '../domain/Metric';
import {ObservationRepository} from './ObservationRepository';

export interface CreateObservationInput {
  name: string;
  metrics: {
    name: string;
    type: string;
  }[];
}

export class CreateObservationUseCase {
  constructor(private readonly observationRepository: ObservationRepository) {}

  public async execute(input: CreateObservationInput): Promise<void> {
    if (!input.name || input.name.trim() === '') {
      throw new Error('Observation name cannot be empty');
    }

    if (!input.metrics || input.metrics.length === 0) {
      throw new Error('At least one metric is required');
    }

    const observationId = Crypto.randomUUID();
    const metrics = input.metrics.map(m => {
      if (!m.name || m.name.trim() === '') {
        throw new Error('Metric name cannot be empty');
      }
      return new Metric(
        Crypto.randomUUID(),
        m.name.trim(),
        m.type as MetricValueType
      );
    });

    const observation = new Observation(observationId, input.name.trim(), metrics);

    await this.observationRepository.save(observation);
  }
}
