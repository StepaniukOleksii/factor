import {describe, expect, it} from 'vitest';
import {
    firstErrorMessage,
    hasErrors,
    validateCreateObservation,
    validateObservationIdentity,
    validateUpdateObservation,
} from './validateCreateObservation';
import type {CreateObservationInput} from './CreateObservationUseCase';
import type {UpdateObservationInput} from './UpdateObservationUseCase';

/** A sound draft, so each case spoils only the field it is about. */
function draft(overrides: Partial<CreateObservationInput> = {}): CreateObservationInput {
  return {name: 'Sleep', metrics: [{name: 'Hours', type: 'Numeric'}], ...overrides};
}

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

  describe('a Metric unit', () => {
    it('accepts one at the limit', () => {
      const metrics = [{name: 'Hours', type: 'Numeric', unit: 'kcal/d'}];

      expect(hasErrors(validateCreateObservation(draft({metrics}), NOTHING_TAKEN))).toBe(false);
    });

    it('accepts one padded past the limit that trims back within it', () => {
      const metrics = [{name: 'Hours', type: 'Numeric', unit: '   kcal/d   '}];

      expect(hasErrors(validateCreateObservation(draft({metrics}), NOTHING_TAKEN))).toBe(false);
    });

    it('refuses one past the limit', () => {
      const metrics = [{name: 'Hours', type: 'Numeric', unit: 'kcal/day'}];

      expect(validateCreateObservation(draft({metrics}), NOTHING_TAKEN).perMetric[0].unit)
        .toBe('Metric unit cannot exceed 6 characters');
    });

    // No field renders it: the card offers no unit off Numeric, so this only
    // catches a caller that submitted one anyway.
    it.each(['Text', 'Boolean', 'Enum'])('refuses one on a %s Metric', (type) => {
      const metrics = [{name: 'Hours', type, unit: 'kg', values: ['a', 'b']}];

      expect(validateCreateObservation(draft({metrics}), NOTHING_TAKEN).perMetric[0].constraint)
        .toBe('Only a Numeric metric can have a unit');
    });

    it('passes over a unit of nothing but whitespace on a Metric that could not hold one', () => {
      const metrics = [{name: 'Hours', type: 'Text', unit: '   '}];

      expect(hasErrors(validateCreateObservation(draft({metrics}), NOTHING_TAKEN))).toBe(false);
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

    // The order the fields sit in on the card, so the message names the earliest
    // thing on screen to put right.
    it("gives a Metric's description before its unit", () => {
      const metrics = [{
        name: 'Hours',
        type: 'Numeric',
        description: 'a'.repeat(501),
        unit: 'kcal/day',
      }];

      const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

      expect(firstErrorMessage(errors)).toBe('Metric description cannot exceed 500 characters');
    });

    it("gives a Metric's unit before its constraint", () => {
      const metrics = [{name: 'Hours', type: 'Text', unit: 'kcal/day'}];

      const errors = validateCreateObservation(draft({metrics}), NOTHING_TAKEN);

      expect(firstErrorMessage(errors)).toBe('Metric unit cannot exceed 6 characters');
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

describe('validateObservationIdentity', () => {
  it('finds nothing wrong with a name absent from the list it was given', () => {
    expect(validateObservationIdentity('Sleep', 'How I slept', ['Mood'])).toEqual({});
  });

  it('rejects an empty name', () => {
    expect(validateObservationIdentity('   ', undefined, NOTHING_TAKEN).name)
      .toBe('Observation name cannot be empty');
  });

  it('rejects a name past 30 characters', () => {
    expect(validateObservationIdentity('a'.repeat(31), undefined, NOTHING_TAKEN).name)
      .toBe('Observation name cannot exceed 30 characters');
  });

  it('rejects a name a passed name holds under name identity', () => {
    expect(validateObservationIdentity('Sleep', undefined, ['Mood', '  sleep  ']).name)
      .toBe('An observation with this name already exists');
  });

  it('rejects a description past 150 characters', () => {
    expect(validateObservationIdentity('Sleep', 'a'.repeat(151), NOTHING_TAKEN).description)
      .toBe('Observation description cannot exceed 150 characters');
  });
});

describe('validateUpdateObservation', () => {
  /** An edit to an Observation holding one stored Metric, sound unless a case spoils it. */
  function edit(overrides: Partial<UpdateObservationInput> = {}): UpdateObservationInput {
    return {
      observationId: 'obs-1',
      name: 'Sleep',
      metrics: [{id: 'metric-1', name: 'Hours', type: 'Numeric'}],
      ...overrides,
    };
  }

  it('finds nothing wrong with a sound edit', () => {
    expect(hasErrors(validateUpdateObservation(edit(), NOTHING_TAKEN))).toBe(false);
  });

  it('judges the Observation\'s own fields as creation judges them', () => {
    expect(validateUpdateObservation(edit({name: '   '}), NOTHING_TAKEN).name)
      .toBe('Observation name cannot be empty');
  });

  describe('a stored Metric', () => {
    it('is refused an empty name', () => {
      const metrics = [{id: 'metric-1', name: '  ', type: 'Numeric'}];

      expect(validateUpdateObservation(edit({metrics}), NOTHING_TAKEN).perMetric[0].name)
        .toBe('Metric name cannot be empty');
    });

    it('is refused a description past 500 characters', () => {
      const metrics = [{id: 'metric-1', name: 'Hours', type: 'Numeric', description: 'a'.repeat(501)}];

      expect(validateUpdateObservation(edit({metrics}), NOTHING_TAKEN).perMetric[0].description)
        .toBe('Metric description cannot exceed 500 characters');
    });

    it('is refused a unit past 6 characters', () => {
      const metrics = [{id: 'metric-1', name: 'Hours', type: 'Numeric', unit: 'kcal/day'}];

      expect(validateUpdateObservation(edit({metrics}), NOTHING_TAKEN).perMetric[0].unit)
        .toBe('Metric unit cannot exceed 6 characters');
    });

    // Its constraint is stated rather than offered, so nothing submits one to
    // judge.
    it('is not judged on the bounds submitted with it', () => {
      const metrics = [{id: 'metric-1', name: 'Hours', type: 'Numeric', min: '9', max: '5'}];

      expect(hasErrors(validateUpdateObservation(edit({metrics}), NOTHING_TAKEN))).toBe(false);
    });

    it('is not judged on values submitted against a type that could not hold them', () => {
      const metrics = [{id: 'metric-1', name: 'Hours', type: 'Numeric', values: ['a', 'b']}];

      expect(hasErrors(validateUpdateObservation(edit({metrics}), NOTHING_TAKEN))).toBe(false);
    });
  });

  describe('a Metric being added', () => {
    it('is judged on its constraint exactly as creation judges one', () => {
      const metrics = [
        {id: 'metric-1', name: 'Hours', type: 'Numeric'},
        {name: 'Caffeine', type: 'Numeric', min: '9', max: '5'},
      ];

      expect(validateUpdateObservation(edit({metrics}), NOTHING_TAKEN).perMetric[1].range)
        .toBe('Metric minimum cannot exceed its maximum');
    });

    it('is refused a Choice short of values', () => {
      const metrics = [
        {id: 'metric-1', name: 'Hours', type: 'Numeric'},
        {name: 'Weather', type: 'Enum', values: ['sunny', '']},
      ];

      expect(validateUpdateObservation(edit({metrics}), NOTHING_TAKEN).perMetric[1].values)
        .toBe('A choice metric needs at least 2 values');
    });
  });

  // Stored Metrics come first on the form, so the added one is the second of the
  // pair and the one marked - creation's rule, over a mixed list.
  it('marks the added Metric of a colliding pair, not the stored one', () => {
    const metrics = [
      {id: 'metric-1', name: 'Hours', type: 'Numeric'},
      {name: 'hours', type: 'Numeric'},
    ];

    const errors = validateUpdateObservation(edit({metrics}), NOTHING_TAKEN);

    expect(errors.perMetric[0].name).toBeUndefined();
    expect(errors.perMetric[1].name).toBe('Metric names must be unique');
  });

  it('accepts a stored Metric keeping its own name', () => {
    const metrics = [{id: 'metric-1', name: '  HOURS  ', type: 'Numeric'}];

    expect(hasErrors(validateUpdateObservation(edit({metrics}), NOTHING_TAKEN))).toBe(false);
  });
});
