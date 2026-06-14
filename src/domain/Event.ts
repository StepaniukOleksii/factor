import {Entity} from './Entity';

export class Event extends Entity<string> {
  public name: string;
  private _timestamps: Date[];

  constructor(id: string, name: string, timestamps: Date[] = []) {
    super(id);
    this.name = name;
    this._timestamps = [...timestamps].sort((a, b) => a.getTime() - b.getTime());
  }

  public get timestamps(): ReadonlyArray<Date> {
    return this._timestamps;
  }

  public recordOccurrence(timestamp: Date): void {
    this._timestamps.push(timestamp);
    this._timestamps.sort((a, b) => a.getTime() - b.getTime());
  }

  public removeOccurrence(timestamp: Date): void {
    this._timestamps = this._timestamps.filter(t => t.getTime() !== timestamp.getTime());
  }
}
