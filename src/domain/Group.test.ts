import {describe, expect, it} from 'vitest';
import {Group} from './Group';

describe('Group', () => {
  it('should initialize with correct properties', () => {
    const group = new Group('g1', 'Health Group', ['o1', 'o2']);
    expect(group.id).toBe('g1');
    expect(group.name).toBe('Health Group');
    expect(group.observationIds).toEqual(['o1', 'o2']);
  });

  it('should allow adding an observation id', () => {
    const group = new Group('g1', 'Health Group');
    group.addObservation('o1');
    expect(group.observationIds).toContain('o1');
  });

  it('should avoid duplicates when adding an observation id', () => {
    const group = new Group('g1', 'Health Group', ['o1']);
    group.addObservation('o1');
    expect(group.observationIds.length).toBe(1);
  });

  it('should allow removing an observation id', () => {
    const group = new Group('g1', 'Health Group', ['o1', 'o2']);
    group.removeObservation('o1');
    expect(group.observationIds).toEqual(['o2']);
  });
});
