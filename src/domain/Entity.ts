export abstract class Entity<TId> {
  public readonly id: TId;

  protected constructor(id: TId) {
    this.id = id;
  }

  public equals(other?: Entity<TId>): boolean {
    if (other == null) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this.id === other.id;
  }
}
