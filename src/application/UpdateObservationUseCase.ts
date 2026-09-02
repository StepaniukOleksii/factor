import * as Crypto from 'expo-crypto';
import {Metric, MetricValueType} from '../domain/Metric';
import {Observation} from '../domain/Observation';
import {ObservationRepository} from './ObservationRepository';
import {MetricInput, toMetricConstraint, toStoredText} from './CreateObservationUseCase';
import {firstErrorMessage, validateUpdateObservation} from './validateCreateObservation';

export interface UpdateMetricInput extends MetricInput {
  /**
   * The stored Metric this stands for, absent on one being added. A Metric's
   * stored values are keyed by it, so it is what keeps them attached across a
   * rename.
   */
  id?: string;
}

export interface UpdateObservationInput {
  observationId: string;
  name: string;
  description?: string;
  /** Every Metric the Observation is to hold, the stored ones included. */
  metrics: UpdateMetricInput[];
}

export class UpdateObservationUseCase {
  constructor(private readonly observationRepository: ObservationRepository) {}

  public async execute(input: UpdateObservationInput): Promise<void> {
    const stored = await this.observationRepository.findAll();
    const observation = stored.find(candidate => candidate.id === input.observationId);
    if (!observation) {
      throw new Error('Observation not found');
    }

    // Excluded by id rather than by name, so a correction to the subject's own
    // casing is not refused against the spelling it replaces.
    const takenNames = stored
      .filter(candidate => candidate.id !== input.observationId)
      .map(candidate => candidate.name);

    const message = firstErrorMessage(validateUpdateObservation(input, takenNames));
    if (message !== undefined) {
      throw new Error(message);
    }

    const storedMetrics = new Map(observation.metrics.map(metric => [metric.id, metric]));
    const metrics = input.metrics.map(submitted => this.toMetric(submitted, storedMetrics));

    // A whole new aggregate rather than the loaded one edited in place: the
    // constructor judges the final set of names at once, where a Metric at a
    // time would refuse a pair exchanging names on the first of the two.
    const updated = new Observation(
      observation.id,
      input.name.trim(),
      metrics,
      toStoredText(input.description),
      observation.createdAt
    );

    await this.observationRepository.update(updated);
  }

  /**
   * A stored Metric keeps its id, its type and its constraint whatever was
   * submitted beside them, so this path cannot narrow a bound or drop a Choice
   * value. Its name, description and unit are the submitted ones: none of the
   * three can strand a value recorded against it.
   */
  private toMetric(submitted: UpdateMetricInput, stored: Map<string, Metric>): Metric {
    if (submitted.id === undefined) {
      return new Metric(
        Crypto.randomUUID(),
        submitted.name.trim(),
        submitted.type as MetricValueType,
        toMetricConstraint(submitted.type, submitted.min, submitted.max, submitted.values),
        toStoredText(submitted.description),
        toStoredText(submitted.unit)
      );
    }

    const existing = stored.get(submitted.id);
    if (!existing) {
      throw new Error('Metric not found');
    }

    return new Metric(
      existing.id,
      submitted.name.trim(),
      existing.type,
      existing.constraint,
      toStoredText(submitted.description),
      toStoredText(submitted.unit)
    );
  }
}
