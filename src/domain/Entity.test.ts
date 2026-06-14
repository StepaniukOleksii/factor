import {describe, expect, it} from 'vitest';
import {Entity} from './Entity';

class TestEntity extends Entity<string> {
  constructor(id: string) {
    super(id);
  }
}

describe('Entity', () => {
  it('should be equal to another entity with the same id', () => {
    const e1 = new TestEntity('123');
    const e2 = new TestEntity('123');
    expect(e1.equals(e2)).toBe(true);
  });

  it('should not be equal to an entity with a different id', () => {
    const e1 = new TestEntity('123');
    const e2 = new TestEntity('456');
    expect(e1.equals(e2)).toBe(false);
  });

  it('should be equal to itself', () => {
    const e1 = new TestEntity('123');
    expect(e1.equals(e1)).toBe(true);
  });

  it('should not be equal to null or undefined', () => {
    const e1 = new TestEntity('123');
    expect(e1.equals(undefined)).toBe(false);
    expect(e1.equals(null as any)).toBe(false);
  });
});
