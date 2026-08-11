import {describe, expect, it} from 'vitest';
import {firstErrorMessage, hasErrors, validateCreateObservation} from './validateCreateObservation';
import type {CreateObservationInput} from './CreateObservationUseCase';

/** A sound draft, so each case spoils only the field it is about. */
function draft(overrides: Partial<CreateObservationInput> = {}): CreateObservationInput {
  return {name: 'Sleep', metrics: [{name: 'Hours', type: 'Numeric'}], ...overrides};
}

/** Nothing stored yet, which is what every case but the collisions is about. */
const NOTHING_TAKEN: string[] = [];

describe('validateCreateObservation', () => {
  it('finds nothing wrong with a sound draft', () => {
    expect(hasErrors(validateCreateObservation(draft(), NOTHING_TAKEN))).toBe(false);
  });

  describe('the field a message lands on', () => {
    it('reports an empty name against the Observation name', () => {
      expect(validateCreateObservation(draft({name: '   '}), NOTHING_TAKEN).name)
        .toBe('Observation name cannot be empty');
    });

    it('reports an over-long description against the Observation description', () => {
      expect(validateCreateObservation(draft({description: 'a'.repeat(151)}), NOTHING_TAKEN).description)
        .toBe('Observation description cannot exceed 150 characters');
    });

    it('reports an empty Metric name against that Metric', () => {
      const errors = validateCreateObservation(draft({metrics: [{name: '   ', type: 'Numeric'}]}), NOTHING_TAKEN);

      expect(errors.perMetric[0].name).toBe('Metric name cannot be empty');
    });

    it('reports an unreadable bound against the bound that could not be read', () => {
      const metrics = [{name: 'Hours', type: 'Numeric', min: '1', max: 'ten'}];

      const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

      expect(errors.perMetric[0].max).toBe('Metric bounds must be numbers');
      expect(errors.perMetric[0].min).toBeUndefined();
    });

    // Each bound reads fine on its own; only the pair is wrong.
    it('reports an inverted range against neither bound', () => {
      const metrics = [{name: 'Hours', type: 'Numeric', min: '5', max: '1'}];

      const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

      expect(errors.perMetric[0].range).toBe('Metric minimum cannot exceed its maximum');
      expect(errors.perMetric[0].min).toBeUndefined();
      expect(errors.perMetric[0].max).toBeUndefined();
    });

    // The blank row survives as far as the value set, which is what counts them.
    it('reports too few choice values against the value set', () => {
      const metrics = [{name: 'level', type: 'Enum', values: ['low', '   ']}];

      const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

      expect(errors.perMetric[0].values).toBe('A choice metric needs at least 2 values');
    });
  });

  it('reports every unmet field across the Observation and its Metrics at once', () => {
    const errors = validateCreateObservation({
      name: '',
      metrics: [{name: '', type: 'Numeric'}, {name: '', type: 'Enum', values: []}],
    }, NOTHING_TAKEN);

    expect(errors.name).toBe('Observation name cannot be empty');
    expect(errors.perMetric[0].name).toBe('Metric name cannot be empty');
    expect(errors.perMetric[1].name).toBe('Metric name cannot be empty');
    expect(errors.perMetric[1].values).toBe('A choice metric needs at least 2 values');
  });

  it('keeps each Metric to its own errors', () => {
    const metrics = [{name: 'Hours', type: 'Numeric'}, {name: '', type: 'Numeric'}];

    const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

    expect(errors.perMetric[0]).toEqual({});
    expect(errors.perMetric[1].name).toBe('Metric name cannot be empty');
  });

  describe('the Observation name against the names already taken', () => {
    it.each([
      ['case', 'sleep'],
      ['surrounding whitespace', '  Sleep  '],
    ])('reports a collision with a taken name differing only in %s', (_kind, taken) => {
      expect(validateCreateObservation(draft(), ['Mood', taken]).name)
        .toBe('An observation with this name already exists');
    });

    it('reports nothing against taken names it is distinct from', () => {
      expect(validateCreateObservation(draft(), ['Mood', 'Sleep Quality']).name).toBeUndefined();
    });

    it('leaves a blank name to the empty-name rule rather than comparing it', () => {
      expect(validateCreateObservation(draft({name: '   '}), ['   ']).name)
        .toBe('Observation name cannot be empty');
    });

    it('leaves an over-long name its own message', () => {
      const name = 'a'.repeat(31);

      expect(validateCreateObservation(draft({name}), [name]).name)
        .toBe('Observation name cannot exceed 30 characters');
    });
  });

  describe("the Metric names against each other", () => {
    /** Three spellings of one name, so the first is kept and both others fault. */
    const collidingMetrics = [
      {name: 'Hours', type: 'Numeric'},
      {name: 'hours', type: 'Numeric'},
      {name: '  HOURS  ', type: 'Numeric'},
    ];

    it('marks every Metric after the first of a colliding group and not the first', () => {
      const errors = validateCreateObservation(draft({metrics: collidingMetrics}), NOTHING_TAKEN);

      expect(errors.perMetric[0].name).toBeUndefined();
      expect(errors.perMetric[1].name).toBe('Metric names must be unique');
      expect(errors.perMetric[2].name).toBe('Metric names must be unique');
    });

    it('marks neither of two distinct Metric names', () => {
      const metrics = [{name: 'Hours', type: 'Numeric'}, {name: 'Hours slept', type: 'Numeric'}];

      const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

      expect(errors.perMetric[0].name).toBeUndefined();
      expect(errors.perMetric[1].name).toBeUndefined();
    });

    it('leaves an existing Metric-name error in place', () => {
      const tooLong = 'a'.repeat(16);
      const metrics = [{name: tooLong, type: 'Numeric'}, {name: tooLong, type: 'Numeric'}];

      const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

      expect(errors.perMetric[1].name).toBe('Metric name cannot exceed 15 characters');
    });
  });

  describe('firstErrorMessage', () => {
    it('is undefined for a sound draft', () => {
      expect(firstErrorMessage(validateCreateObservation(draft(), NOTHING_TAKEN))).toBeUndefined();
    });

    it('gives the Observation before any of its Metrics', () => {
      const errors = validateCreateObservation({name: '', metrics: [{name: '', type: 'Numeric'}]}, NOTHING_TAKEN);

      expect(firstErrorMessage(errors)).toBe('Observation name cannot be empty');
    });

    it('gives the earlier of two unsound Metrics', () => {
      const metrics = [{name: '', type: 'Numeric'}, {name: 'level', type: 'Enum', values: []}];

      const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

      expect(firstErrorMessage(errors)).toBe('Metric name cannot be empty');
    });

    it("gives a Metric's own name before the constraint it carries", () => {
      const errors = validateCreateObservation(draft({metrics: [{name: '', type: 'Enum', values: []}]}), NOTHING_TAKEN);

      expect(firstErrorMessage(errors)).toBe('Metric name cannot be empty');
    });

    it('gives a taken Observation name before a colliding pair of Metrics', () => {
      const metrics = [{name: 'Hours', type: 'Numeric'}, {name: 'hours', type: 'Numeric'}];

      const errors = validateCreateObservation(draft({metrics}), ['Sleep']);

      expect(firstErrorMessage(errors)).toBe('An observation with this name already exists');
    });

    it('gives a colliding pair of Metrics once the Observation itself is sound', () => {
      const metrics = [{name: 'Hours', type: 'Numeric'}, {name: 'hours', type: 'Numeric'}];

      const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

      expect(firstErrorMessage(errors)).toBe('Metric names must be unique');
    });
  });
});
