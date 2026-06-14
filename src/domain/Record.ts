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

  public updateValues(values: Map<string, any>, observation: Observation): void {
    if (this.observationId !== observation.id) {
      throw new Error("Observation ID mismatch.");
    }
    observation.validateValues(values);
    for (const [key, val] of values.entries()) {
      this._values.set(key, val);
    }
  }

  public removeValue(metricId: string): void {
    this._values.delete(metricId);
  }

  public getValue(metricId: string): any {
    return this._values.get(metricId);
  }
}
