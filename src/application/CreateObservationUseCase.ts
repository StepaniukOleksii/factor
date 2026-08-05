import * as Crypto from 'expo-crypto';
import {Observation} from '../domain/Observation';
import {EnumConstraint, Metric, MetricConstraint, MetricValueType, NumericConstraint} from '../domain/Metric';
import {
  METRIC_DESCRIPTION_MAX_LENGTH,
  METRIC_ENUM_MAX_VALUES,
  METRIC_ENUM_VALUE_MAX_LENGTH,
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
    /** The values a choice offers, as typed and in the order declared. */
    values?: string[];
  }[];
}

function parseBound(text: string): number {
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error('Metric bounds must be numbers');
  }
  return value;
}

function isDeclared(text?: string): boolean {
  return (text ?? '').trim() !== '';
}

function toNumericConstraint(min?: string, max?: string): NumericConstraint {
  const constraint: NumericConstraint = {};
  if (isDeclared(min)) {
    constraint.min = parseBound(min!);
  }
  if (isDeclared(max)) {
    constraint.max = parseBound(max!);
  }
  // An incoherent range makes `validateValue` reject every value, so it is
  // caught where the user's input enters the system.
  if (constraint.min !== undefined && constraint.max !== undefined && constraint.min > constraint.max) {
    throw new Error('Metric minimum cannot exceed its maximum');
  }
  return constraint;
}

/**
 * `values` are already trimmed and stripped of blanks. Every rule here is what
 * makes the type safe to offer: a Metric whose values are missing, or too few to
 * choose between, would refuse every value forever.
 */
function toEnumConstraint(values: string[]): EnumConstraint {
  if (values.length < 2) {
    throw new Error('A choice metric needs at least 2 values');
  }
  if (values.length > METRIC_ENUM_MAX_VALUES) {
    throw new Error(`A choice metric can have at most ${METRIC_ENUM_MAX_VALUES} values`);
  }
  if (values.some(value => value.length > METRIC_ENUM_VALUE_MAX_LENGTH)) {
    throw new Error(`A choice value cannot exceed ${METRIC_ENUM_VALUE_MAX_LENGTH} characters`);
  }
  // The segments are what the user tells the values apart by, and `Low` beside
  // `low` is a distinction the control cannot show. The casing that was typed is
  // still what gets stored.
  const distinct = new Set(values.map(value => value.toLowerCase()));
  if (distinct.size !== values.length) {
    throw new Error('Choice values must be unique');
  }
  return {allowedValues: values};
}

/**
 * The one constraint a Metric holds, its type deciding which rule set builds it -
 * so a range and a set of values can never both be built for one Metric.
 *
 * A Numeric Metric given neither bound is left unconstrained rather than holding
 * `{}`, which would persist as a meaningless `"{}"` and read as "bounded" to
 * anything testing the field for presence.
 */
function toMetricConstraint(type: string, min?: string, max?: string, values?: string[]): MetricConstraint {
  // A blank row is the value editor's own affordance rather than something the
  // user typed, so it is dropped before anything is counted.
  const declaredValues = (values ?? []).map(value => value.trim()).filter(value => value !== '');
  const bounded = isDeclared(min) || isDeclared(max);

  // The screen offers each of these for one type only, so either arriving on
  // another is a caller bug rather than something to drop quietly.
  if (bounded && type !== 'Numeric') {
    throw new Error('Only a Numeric metric can have bounds');
  }
  if (declaredValues.length > 0 && type !== 'Enum') {
    throw new Error('Only a choice metric can have values');
  }

  if (type === 'Enum') {
    return toEnumConstraint(declaredValues);
  }
  return bounded ? toNumericConstraint(min, max) : null;
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
        toMetricConstraint(m.type, m.min, m.max, m.values),
        trimmedMetricDescription === '' ? null : trimmedMetricDescription
      );
    });

    const observation = new Observation(observationId, trimmedName, metrics, description);

    await this.observationRepository.save(observation);
  }
}
