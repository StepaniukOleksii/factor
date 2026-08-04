import {Entity} from './Entity';
import {Observation} from './Observation';
import {RECORD_NOTE_MAX_LENGTH} from './validationLimits';

export class Record extends Entity<string> {
  public readonly observationId: string;
  public timestamp: Date;
  public note: string | null;
  private _values: Map<string, any>;

  /**
   * Internal constructor. Use Observation.createRecord to create records to enforce invariants.
   */
  constructor(
    id: string,
    observationId: string,
    timestamp: Date,
    values: Map<string, any>,
    note: string | null = null
  ) {
    super(id);
    this.observationId = observationId;
    this.timestamp = timestamp;
    this.note = note;
    this._values = new Map(values);
  }

  /**
   * Static rather than enforced in the constructor, which rebuilds stored
   * Records and must return what is held rather than reject or rewrite it.
   */
  public static normalizeNote(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? '';
    if (trimmed.length > RECORD_NOTE_MAX_LENGTH) {
      throw new Error(`Record note cannot exceed ${RECORD_NOTE_MAX_LENGTH} characters`);
    }
    return trimmed === '' ? null : trimmed;
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
