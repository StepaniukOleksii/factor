import {Entity} from './Entity';

export class Group extends Entity<string> {
  public name: string;
  private _observationIds: Set<string>;

  constructor(id: string, name: string, observationIds: string[] = []) {
    super(id);
    this.name = name;
    this._observationIds = new Set(observationIds);
  }

  public get observationIds(): ReadonlyArray<string> {
    return Array.from(this._observationIds);
  }

  public addObservation(observationId: string): void {
    this._observationIds.add(observationId);
  }

  public removeObservation(observationId: string): void {
    this._observationIds.delete(observationId);
  }
}
