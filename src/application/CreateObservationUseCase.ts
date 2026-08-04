import * as Crypto from 'expo-crypto';
import {Observation} from '../domain/Observation';
import {Metric, MetricValueType, NumericConstraint} from '../domain/Metric';
import {
  METRIC_DESCRIPTION_MAX_LENGTH,
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
    description?: string;
    /** Lower bound, as typed; blank or absent leaves it unset. */
    min?: string;
    /** Upper bound, as typed; blank or absent leaves it unset. */
    max?: string;
  }[];
}

function parseBound(text: string): number {
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error('Metric bounds must be numbers');
  }
  return value;
}

/**
 * The bounds a Metric was declared with, or `null` when it was given none -
 * never `{}`, which would persist as a meaningless `"{}"` and read as "bounded"
 * to anything testing the field for presence.
 */
function toNumericConstraint(type: string, min?: string, max?: string): NumericConstraint | null {
  const hasMin = (min ?? '').trim() !== '';
  const hasMax = (max ?? '').trim() !== '';
  if (!hasMin && !hasMax) {
    return null;
  }
  // The screen never offers these fields for another type, so a bound arriving
  // on one is a caller bug rather than something to drop quietly.
  if (type !== 'Numeric') {
    throw new Error('Only a Numeric metric can have bounds');
  }

  const constraint: NumericConstraint = {};
  if (hasMin) {
    constraint.min = parseBound(min!);
  }
  if (hasMax) {
    constraint.max = parseBound(max!);
  }
  // An incoherent range makes `validateValue` reject every value, so it is
  // caught where the user's input enters the system.
  if (constraint.min !== undefined && constraint.max !== undefined && constraint.min > constraint.max) {
    throw new Error('Metric minimum cannot exceed its maximum');
  }
  return constraint;
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

      // `trim()` leaves interior newlines alone, so a per-value legend keeps the
      // line breaks the user typed.
      const trimmedMetricDescription = m.description?.trim() ?? '';
      if (trimmedMetricDescription.length > METRIC_DESCRIPTION_MAX_LENGTH) {
        throw new Error(`Metric description cannot exceed ${METRIC_DESCRIPTION_MAX_LENGTH} characters`);
      }

      return new Metric(
        Crypto.randomUUID(),
        trimmedMetricName,
        m.type as MetricValueType,
        toNumericConstraint(m.type, m.min, m.max),
        trimmedMetricDescription === '' ? null : trimmedMetricDescription
      );
    });

    const observation = new Observation(observationId, trimmedName, metrics, description);

    await this.observationRepository.save(observation);
  }
}
