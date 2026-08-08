import {describe, expect, it} from 'vitest';
import {firstErrorMessage, hasErrors, validateCreateObservation} from './validateCreateObservation';
import type {CreateObservationInput} from './CreateObservationUseCase';

/** A sound draft, so each case spoils only the field it is about. */
function draft(overrides: Partial<CreateObservationInput> = {}): CreateObservationInput {
  return {name: 'Sleep', metrics: [{name: 'Hours', type: 'Numeric'}], ...overrides};
}

describe('validateCreateObservation', () => {
  it('finds nothing wrong with a sound draft', () => {
    expect(hasErrors(validateCreateObservation(draft()))).toBe(false);
  });

  describe('the field a message lands on', () => {
    it('reports an empty name against the Observation name', () => {
      expect(validateCreateObservation(draft({name: '   '})).name)
        .toBe('Observation name cannot be empty');
    });

    it('reports an over-long description against the Observation description', () => {
      expect(validateCreateObservation(draft({description: 'a'.repeat(151)})).description)
        .toBe('Observation description cannot exceed 150 characters');
    });

    it('reports an empty Metric name against that Metric', () => {
      const errors = validateCreateObservation(draft({metrics: [{name: '   ', type: 'Numeric'}]}));

      expect(errors.perMetric[0].name).toBe('Metric name cannot be empty');
    });

    it('reports an unreadable bound against the bound that could not be read', () => {
      const metrics = [{name: 'Hours', type: 'Numeric', min: '1', max: 'ten'}];

      const errors = validateCreateObservation(draft({metrics}));

      expect(errors.perMetric[0].max).toBe('Metric bounds must be numbers');
      expect(errors.perMetric[0].min).toBeUndefined();
    });

    // Each bound reads fine on its own; only the pair is wrong.
    it('reports an inverted range against neither bound', () => {
      const metrics = [{name: 'Hours', type: 'Numeric', min: '5', max: '1'}];

      const errors = validateCreateObservation(draft({metrics}));

      expect(errors.perMetric[0].range).toBe('Metric minimum cannot exceed its maximum');
      expect(errors.perMetric[0].min).toBeUndefined();
      expect(errors.perMetric[0].max).toBeUndefined();
    });

    // The blank row survives as far as the value set, which is what counts them.
    it('reports too few choice values against the value set', () => {
      const metrics = [{name: 'level', type: 'Enum', values: ['low', '   ']}];

      const errors = validateCreateObservation(draft({metrics}));

      expect(errors.perMetric[0].values).toBe('A choice metric needs at least 2 values');
    });
  });

  it('reports every unmet field across the Observation and its Metrics at once', () => {
    const errors = validateCreateObservation({
      name: '',
      metrics: [{name: '', type: 'Numeric'}, {name: '', type: 'Enum', values: []}],
    });

    expect(errors.name).toBe('Observation name cannot be empty');
    expect(errors.perMetric[0].name).toBe('Metric name cannot be empty');
    expect(errors.perMetric[1].name).toBe('Metric name cannot be empty');
    expect(errors.perMetric[1].values).toBe('A choice metric needs at least 2 values');
  });

  it('keeps each Metric to its own errors', () => {
    const metrics = [{name: 'Hours', type: 'Numeric'}, {name: '', type: 'Numeric'}];

    const errors = validateCreateObservation(draft({metrics}));

    expect(errors.perMetric[0]).toEqual({});
    expect(errors.perMetric[1].name).toBe('Metric name cannot be empty');
  });

  describe('firstErrorMessage', () => {
    it('is undefined for a sound draft', () => {
      expect(firstErrorMessage(validateCreateObservation(draft()))).toBeUndefined();
    });

    it('gives the Observation before any of its Metrics', () => {
      const errors = validateCreateObservation({name: '', metrics: [{name: '', type: 'Numeric'}]});

      expect(firstErrorMessage(errors)).toBe('Observation name cannot be empty');
    });

    it('gives the earlier of two unsound Metrics', () => {
      const metrics = [{name: '', type: 'Numeric'}, {name: 'level', type: 'Enum', values: []}];

      const errors = validateCreateObservation(draft({metrics}));

      expect(firstErrorMessage(errors)).toBe('Metric name cannot be empty');
    });

    it("gives a Metric's own name before the constraint it carries", () => {
      const errors = validateCreateObservation(draft({metrics: [{name: '', type: 'Enum', values: []}]}));

      expect(firstErrorMessage(errors)).toBe('Metric name cannot be empty');
    });
  });
});
