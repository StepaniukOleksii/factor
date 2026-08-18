import {describe, expect, it} from 'vitest';
import {nearestPointIndex} from './chartHitTest';

// x alone, which is all the helper reads - and all a swimlane column has, its
// target running the whole height of the plot.
const CANDIDATES = [{x: 0}, {x: 40}, {x: 100}];

describe('nearestPointIndex', () => {
  it('reports the candidate a position falls closest to', () => {
    expect(nearestPointIndex(CANDIDATES, 45)).toBe(1);
    expect(nearestPointIndex(CANDIDATES, 90)).toBe(2);
  });

  it('reports the sole candidate of a one-mark chart, however far off the position is', () => {
    expect(nearestPointIndex([{x: 100}], 0)).toBe(0);
  });

  it('resolves a position beyond either end of the list to the candidate at that end', () => {
    expect(nearestPointIndex(CANDIDATES, -500)).toBe(0);
    expect(nearestPointIndex(CANDIDATES, 500)).toBe(2);
  });

  it('keeps the earlier of two candidates a position sits exactly between', () => {
    expect(nearestPointIndex(CANDIDATES, 20)).toBe(0);
  });

  it('keeps the earlier of two candidates drawn on top of each other', () => {
    expect(nearestPointIndex([{x: 50}, {x: 50}], 50)).toBe(0);
  });
});
