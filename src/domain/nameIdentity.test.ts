import {describe, expect, it} from 'vitest';
import {collidingNamePositions, nameKey} from './nameIdentity';

describe('nameKey', () => {
  it.each([
    ['case', 'Sleep', 'sleep'],
    ['surrounding whitespace', 'Sleep', '  Sleep  '],
    ['both at once', '  SLEEP', 'sleep  '],
  ])('equates two names differing only in %s', (_kind, one, other) => {
    expect(nameKey(one)).toBe(nameKey(other));
  });

  it.each([
    ['interior spacing', 'Sleep Quality', 'Sleep  Quality'],
    ['an accent', 'Resume', 'Résumé'],
  ])('separates two names differing in %s', (_kind, one, other) => {
    expect(nameKey(one)).not.toBe(nameKey(other));
  });
});

describe('collidingNamePositions', () => {
  it('reports nothing for a list of distinct names', () => {
    expect(collidingNamePositions(['Sleep', 'Mood', 'Energy'])).toEqual([]);
  });

  it('reports nothing for an empty list', () => {
    expect(collidingNamePositions([])).toEqual([]);
  });

  it('reports every position after the first of a group and not the first', () => {
    expect(collidingNamePositions(['Sleep', 'sleep', 'Mood', ' SLEEP '])).toEqual([1, 3]);
  });

  it('reports each group of collisions independently', () => {
    expect(collidingNamePositions(['Sleep', 'Mood', 'mood', 'sleep'])).toEqual([2, 3]);
  });

  it('skips blanks rather than colliding them with each other', () => {
    expect(collidingNamePositions(['', '   ', 'Sleep'])).toEqual([]);
  });
});
