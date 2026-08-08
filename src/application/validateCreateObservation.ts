import {
  METRIC_DESCRIPTION_MAX_LENGTH,
  METRIC_ENUM_MAX_VALUES,
  METRIC_ENUM_VALUE_MAX_LENGTH,
  METRIC_NAME_MAX_LENGTH,
  OBSERVATION_DESCRIPTION_MAX_LENGTH,
  OBSERVATION_NAME_MAX_LENGTH,
} from '../domain/validationLimits';
import type {CreateObservationInput} from './CreateObservationUseCase';

/**
 * What is wrong with one submitted Metric, a message per field of the editor
 * that produced it, so a screen can mark the field rather than report the
 * Observation as a whole.
 */
export interface MetricErrors {
  /** The Metric's name. */
  name?: string;
  /** The Metric's own description. */
  description?: string;
  /** The lower bound alone. */
  min?: string;
  /** The upper bound alone. */
  max?: string;
  /** The two bounds against each other, which belongs to neither field. */
  range?: string;
  /** The value set as a whole - too few, too many, too long, or not distinct. */
  values?: string;
  /**
   * The Metric's type and the constraint it carries disagree. Each editor is
   * offered for one type only and is cleared when the type changes, so this is
   * a caller bug rather than anything a user can enter: no field renders it.
   */
  constraint?: string;
}

/** What is wrong with a submitted Observation, addressed the same way. */
export interface CreateObservationErrors {
  /** The Observation's name. */
  name?: string;
  /** The Observation's description. */
  description?: string;
  /** The Metric list itself rather than any Metric in it. */
  metrics?: string;
  /** One entry per submitted Metric, in the order given; empty where it is sound. */
  perMetric: MetricErrors[];
}

/** Whether `text` holds anything the user typed, rather than nothing or spacing. */
export function isDeclared(text?: string): boolean {
  return (text ?? '').trim() !== '';
}

/**
 * The values a choice Metric actually offers. A blank row is the value editor's
 * own affordance rather than something the user typed, so it is dropped before
 * anything is counted.
 */
export function declaredEnumValues(values?: string[]): string[] {
  return (values ?? []).map(value => value.trim()).filter(value => value !== '');
}

/**
 * Every rule here is what makes the type safe to offer: a Metric whose values
 * are missing, or too few to choose between, would refuse every value forever.
 */
function enumValuesError(values: string[]): string | undefined {
  if (values.length < 2) {
    return 'A choice metric needs at least 2 values';
  }
  if (values.length > METRIC_ENUM_MAX_VALUES) {
    return `A choice metric can have at most ${METRIC_ENUM_MAX_VALUES} values`;
  }
  if (values.some(value => value.length > METRIC_ENUM_VALUE_MAX_LENGTH)) {
    return `A choice value cannot exceed ${METRIC_ENUM_VALUE_MAX_LENGTH} characters`;
  }
  // The segments are what the user tells the values apart by, and `Low` beside
  // `low` is a distinction the control cannot show.
  if (new Set(values.map(value => value.toLowerCase())).size !== values.length) {
    return 'Choice values must be unique';
  }
  return undefined;
}

/**
 * An incoherent range makes `validateValue` reject every value, so it is caught
 * where the user's input enters the system. Compared only once both bounds are
 * numbers, so unreadable text is reported as itself rather than as a range.
 */
function boundErrors(min?: string, max?: string): MetricErrors {
  const errors: MetricErrors = {};
  if (isDeclared(min) && !Number.isFinite(Number(min))) {
    errors.min = 'Metric bounds must be numbers';
  }
  if (isDeclared(max) && !Number.isFinite(Number(max))) {
    errors.max = 'Metric bounds must be numbers';
  }
  if (errors.min === undefined && errors.max === undefined
    && isDeclared(min) && isDeclared(max) && Number(min) > Number(max)) {
    errors.range = 'Metric minimum cannot exceed its maximum';
  }
  return errors;
}

/** The one constraint a Metric holds, its type deciding which rule set judges it. */
function constraintErrors(metric: CreateObservationInput['metrics'][number]): MetricErrors {
  const values = declaredEnumValues(metric.values);
  const bounded = isDeclared(metric.min) || isDeclared(metric.max);

  if (bounded && metric.type !== 'Numeric') {
    return {constraint: 'Only a Numeric metric can have bounds'};
  }
  if (values.length > 0 && metric.type !== 'Enum') {
    return {constraint: 'Only a choice metric can have values'};
  }
  if (metric.type === 'Enum') {
    const message = enumValuesError(values);
    return message === undefined ? {} : {values: message};
  }
  return bounded ? boundErrors(metric.min, metric.max) : {};
}

function metricErrors(metric: CreateObservationInput['metrics'][number]): MetricErrors {
  const errors: MetricErrors = constraintErrors(metric);

  const name = metric.name?.trim() ?? '';
  if (name === '') {
    errors.name = 'Metric name cannot be empty';
  } else if (name.length > METRIC_NAME_MAX_LENGTH) {
    errors.name = `Metric name cannot exceed ${METRIC_NAME_MAX_LENGTH} characters`;
  }

  // `trim()` leaves interior newlines alone, so a per-value legend keeps the
  // line breaks the user typed.
  if ((metric.description?.trim() ?? '').length > METRIC_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Metric description cannot exceed ${METRIC_DESCRIPTION_MAX_LENGTH} characters`;
  }

  return errors;
}

/**
 * Everything wrong with `input` at once, so a form can mark every field that
 * needs attention instead of surfacing one reason per attempt.
 *
 * Returns the rules alone; refusing the save is `firstErrorMessage`'s job and
 * marking the fields is the screen's.
 */
export function validateCreateObservation(input: CreateObservationInput): CreateObservationErrors {
  const errors: CreateObservationErrors = {perMetric: (input.metrics ?? []).map(metricErrors)};

  const name = input.name?.trim() ?? '';
  if (name === '') {
    errors.name = 'Observation name cannot be empty';
  } else if (name.length > OBSERVATION_NAME_MAX_LENGTH) {
    errors.name = `Observation name cannot exceed ${OBSERVATION_NAME_MAX_LENGTH} characters`;
  }

  if (!input.metrics || input.metrics.length === 0) {
    errors.metrics = 'At least one metric is required';
  }

  if ((input.description?.trim() ?? '').length > OBSERVATION_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Observation description cannot exceed ${OBSERVATION_DESCRIPTION_MAX_LENGTH} characters`;
  }

  return errors;
}

/**
 * The single reason a save is refused with, for a caller that can only report
 * one - the Observation before its Metrics, and within a Metric its identity
 * before the constraint it carries, so the reason given is the earliest thing
 * the user has to put right.
 */
export function firstErrorMessage(errors: CreateObservationErrors): string | undefined {
  const observationLevel = errors.name ?? errors.metrics ?? errors.description;
  if (observationLevel !== undefined) {
    return observationLevel;
  }
  for (const metric of errors.perMetric) {
    const message = metric.name ?? metric.description ?? metric.constraint
      ?? metric.values ?? metric.min ?? metric.max ?? metric.range;
    if (message !== undefined) {
      return message;
    }
  }
  return undefined;
}

/** Whether anything at all is wrong, for a caller deciding whether to submit. */
export function hasErrors(errors: CreateObservationErrors): boolean {
  return firstErrorMessage(errors) !== undefined;
}
