import * as Crypto from 'expo-crypto';
import {Observation} from '../domain/Observation';
import {Metric, MetricValueType} from '../domain/Metric';
import {
  METRIC_NAME_MAX_LENGTH,
  OBSERVATION_DESCRIPTION_MAX_LENGTH,
  OBSERVATION_NAME_MAX_LENGTH,
} from '../domain/validationLimits';
import {ObservationRepository} from './ObservationRepository';

export interface CreateObservationInput {
  name: string;
  description?: string;
  metrics: {
    name: string;
    type: string;
  }[];
}

export class CreateObservationUseCase {
  constructor(private readonly observationRepository: ObservationRepository) {}

  public async execute(input: CreateObservationInput): Promise<void> {
    const trimmedName = input.name?.trim() ?? '';
    if (trimmedName === '') {
      throw new Error('Observation name cannot be empty');
    }
    if (trimmedName.length > OBSERVATION_NAME_MAX_LENGTH) {
      throw new Error(`Observation name cannot exceed ${OBSERVATION_NAME_MAX_LENGTH} characters`);
    }

    if (!input.metrics || input.metrics.length === 0) {
      throw new Error('At least one metric is required');
    }

    const trimmedDescription = input.description?.trim() ?? '';
    if (trimmedDescription.length > OBSERVATION_DESCRIPTION_MAX_LENGTH) {
      throw new Error(`Observation description cannot exceed ${OBSERVATION_DESCRIPTION_MAX_LENGTH} characters`);
    }
    const description = trimmedDescription === '' ? null : trimmedDescription;

    const observationId = Crypto.randomUUID();
    const metrics = input.metrics.map(m => {
      const trimmedMetricName = m.name?.trim() ?? '';
      if (trimmedMetricName === '') {
        throw new Error('Metric name cannot be empty');
      }
      if (trimmedMetricName.length > METRIC_NAME_MAX_LENGTH) {
        throw new Error(`Metric name cannot exceed ${METRIC_NAME_MAX_LENGTH} characters`);
      }
      return new Metric(
        Crypto.randomUUID(),
        trimmedMetricName,
        m.type as MetricValueType
      );
    });

    const observation = new Observation(observationId, trimmedName, metrics, description);

    await this.observationRepository.save(observation);
  }
}
