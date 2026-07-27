import {Entity} from './Entity';
import {Observation} from './Observation';

export class Record extends Entity<string> {
  public readonly observationId: string;
  public timestamp: Date;
  private _values: Map<string, any>;

  /**
   * Internal constructor. Use Observation.createRecord to create records to enforce invariants.
   */
  constructor(id: string, observationId: string, timestamp: Date, values: Map<string, any>) {
    super(id);
    this.observationId = observationId;
    this.timestamp = timestamp;
    this._values = new Map(values);
  }

  public get values(): ReadonlyMap<string, any> {
    return this._values;
  }

  /** Replaces the values: a Metric absent from `values` is cleared, not left as it was. */
  public updateValues(values: Map<string, any>, observation: Observation): void {
    if (this.observationId !== observation.id) {
      throw new Error("Observation ID mismatch.");
    }
    observation.validateValues(values);
    this._values = new Map(values);
  }

  public removeValue(metricId: string): void {
    this._values.delete(metricId);
  }

  public getValue(metricId: string): any {
    return this._values.get(metricId);
  }
}
