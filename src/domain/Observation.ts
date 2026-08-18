import {Entity} from './Entity';
import {Metric} from './Metric';
import {collidingNamePositions} from './nameIdentity';
import {Record} from './Record';

function requireDistinctMetricNames(names: string[]): void {
  if (collidingNamePositions(names).length > 0) {
    throw new Error('Metric names must be unique within an observation');
  }
}

export class Observation extends Entity<string> {
  public name: string;
  public description: string | null;
  public readonly createdAt: Date;
  private _metrics: Map<string, Metric>;

  constructor(
    id: string,
    name: string,
    metrics: Metric[] = [],
    description: string | null = null,
    createdAt: Date = new Date()
  ) {
    super(id);
    this.name = name;
    this.description = description;
    this.createdAt = createdAt;
    requireDistinctMetricNames(metrics.map(m => m.name));
    this._metrics = new Map(metrics.map(m => [m.id, m]));
  }

  public get metrics(): ReadonlyArray<Metric> {
    return Array.from(this._metrics.values());
  }

  public addMetric(metric: Metric): void {
    // Keyed by id, so a Metric replacing itself does not collide with the name
    // it replaces.
    const siblings = this.metrics.filter(m => m.id !== metric.id);
    requireDistinctMetricNames([...siblings.map(m => m.name), metric.name]);
    this._metrics.set(metric.id, metric);
  }

  public removeMetric(metricId: string): void {
    this._metrics.delete(metricId);
  }

  public validateValues(values: Map<string, any>): void {
    for (const [metricId, value] of values.entries()) {
      const metric = this._metrics.get(metricId);
      if (!metric) {
        throw new Error(`Metric ${metricId} is not defined in this observation.`);
      }
      if (!metric.validateValue(value)) {
        throw new Error(`Invalid value for metric ${metric.name}.`);
      }
    }
  }

  public createRecord(
    id: string,
    timestamp: Date,
    values: Map<string, any>,
    note: string | null = null
  ): Record {
    this.validateValues(values);
    return new Record(id, this.id, timestamp, new Map(values), note);
  }
}
