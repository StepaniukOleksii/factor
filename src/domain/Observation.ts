import {Entity} from './Entity';
import {Metric} from './Metric';
import {Record} from './Record';

export class Observation extends Entity<string> {
  public name: string;
  public description: string | null;
  private _metrics: Map<string, Metric>;

  constructor(id: string, name: string, metrics: Metric[] = [], description: string | null = null) {
    super(id);
    this.name = name;
    this.description = description;
    this._metrics = new Map(metrics.map(m => [m.id, m]));
  }

  public get metrics(): ReadonlyArray<Metric> {
    return Array.from(this._metrics.values());
  }

  public addMetric(metric: Metric): void {
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

  public createRecord(id: string, timestamp: Date, values: Map<string, any>): Record {
    this.validateValues(values);
    return new Record(id, this.id, timestamp, new Map(values));
  }
}
