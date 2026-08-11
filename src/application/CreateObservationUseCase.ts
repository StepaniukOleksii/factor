import * as Crypto from 'expo-crypto';
import {Observation} from '../domain/Observation';
import {Metric, MetricConstraint, MetricValueType, NumericConstraint} from '../domain/Metric';
import {ObservationRepository} from './ObservationRepository';
import {
  declaredEnumValues,
  firstErrorMessage,
  isDeclared,
  validateCreateObservation
} from './validateCreateObservation';

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
    /** The values a choice offers, as typed and in the order declared. */
    values?: string[];
  }[];
}

/**
 * The one constraint a Metric holds, its type deciding which is built - so a
 * range and a set of values can never both be built for one Metric. Reached
 * only once `validateCreateObservation` has passed, so it builds without
 * judging.
 *
 * A Numeric Metric given neither bound is left unconstrained rather than holding
 * `{}`, which would persist as a meaningless `"{}"` and read as "bounded" to
 * anything testing the field for presence.
 */
function toMetricConstraint(type: string, min?: string, max?: string, values?: string[]): MetricConstraint {
  if (type === 'Enum') {
    return {allowedValues: declaredEnumValues(values)};
  }

  const constraint: NumericConstraint = {};
  if (isDeclared(min)) {
    constraint.min = Number(min);
  }
  if (isDeclared(max)) {
    constraint.max = Number(max);
  }
  return constraint.min === undefined && constraint.max === undefined ? null : constraint;
}

function toStoredText(text?: string): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export class CreateObservationUseCase {
  constructor(private readonly observationRepository: ObservationRepository) {}

  public async execute(input: CreateObservationInput): Promise<void> {
    const stored = await this.observationRepository.findAll();

    const message = firstErrorMessage(validateCreateObservation(input, stored.map(o => o.name)));
    if (message !== undefined) {
      throw new Error(message);
    }

    const metrics = input.metrics.map(m => new Metric(
      Crypto.randomUUID(),
      m.name.trim(),
      m.type as MetricValueType,
      toMetricConstraint(m.type, m.min, m.max, m.values),
      toStoredText(m.description)
    ));

    const observation = new Observation(
      Crypto.randomUUID(),
      input.name.trim(),
      metrics,
      toStoredText(input.description)
    );

    await this.observationRepository.save(observation);
  }
}
