import {Entity} from './Entity';

export class Event extends Entity<string> {
  public name: string;
  public occurredAt: Date;
  public description: string | null;

  constructor(id: string, name: string, occurredAt: Date, description: string | null = null) {
    super(id);
    this.name = name;
    this.occurredAt = occurredAt;
    this.description = description;
  }
}
