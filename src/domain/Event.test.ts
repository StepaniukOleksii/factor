import {describe, expect, it} from 'vitest';
import {Event} from './Event';

describe('Event', () => {
  it('should initialize and sort timestamps', () => {
    const d1 = new Date('2023-01-02');
    const d2 = new Date('2023-01-01');
    const event = new Event('e1', 'Vacation', [d1, d2]);
    
    expect(event.timestamps[0]).toBe(d2);
    expect(event.timestamps[1]).toBe(d1);
  });

  it('should add an occurrence and maintain sorted order', () => {
    const d1 = new Date('2023-01-01');
    const d3 = new Date('2023-01-03');
    const event = new Event('e1', 'Vacation', [d1, d3]);
    
    const d2 = new Date('2023-01-02');
    event.recordOccurrence(d2);
    
    expect(event.timestamps[0]).toBe(d1);
    expect(event.timestamps[1]).toBe(d2);
    expect(event.timestamps[2]).toBe(d3);
  });

  it('should remove an occurrence based on timestamp', () => {
    const d1 = new Date('2023-01-01');
    const d2 = new Date('2023-01-02');
    const event = new Event('e1', 'Vacation', [d1, d2]);
    
    event.removeOccurrence(d1);
    expect(event.timestamps.length).toBe(1);
    expect(event.timestamps[0]).toBe(d2);
  });
});
