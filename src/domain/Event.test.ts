import {describe, expect, it} from 'vitest';
import {Event} from './Event';

describe('Event', () => {
  it('should keep the moment it is given', () => {
    const occurredAt = new Date('2026-03-14T09:00:00Z');

    const event = new Event('e1', 'Vacation', occurredAt);

    expect(event.occurredAt).toBe(occurredAt);
  });

  it('should default to no description', () => {
    const event = new Event('e1', 'Vacation', new Date());

    expect(event.description).toBeNull();
  });

  it('should keep a description it is given', () => {
    const event = new Event('e1', 'Vacation', new Date(), 'Two weeks away from a desk.');

    expect(event.description).toBe('Two weeks away from a desk.');
  });

  it('should equal another Event by id alone', () => {
    const event = new Event('e1', 'Vacation', new Date('2026-01-01'));
    const sameId = new Event('e1', 'Illness', new Date('2026-06-01'));

    expect(event.equals(sameId)).toBe(true);
  });

  it('should differ from an Event carrying the same name', () => {
    const event = new Event('e1', 'Flu', new Date('2026-01-01'));
    const namesake = new Event('e2', 'Flu', new Date('2026-06-01'));

    expect(event.equals(namesake)).toBe(false);
  });
});
