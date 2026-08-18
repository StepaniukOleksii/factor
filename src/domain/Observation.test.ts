import {describe, expect, it} from 'vitest';
import {Observation} from './Observation';
import {Metric} from './Metric';

describe('Observation', () => {
  it('should initialize with no metrics by default', () => {
    const obs = new Observation('o1', 'Sleep');
    expect(obs.metrics.length).toBe(0);
  });

  it('should default description to null', () => {
    const obs = new Observation('o1', 'Sleep');
    expect(obs.description).toBeNull();
  });

  it('should store a provided description', () => {
    const obs = new Observation('o1', 'Sleep', [], 'How well I slept');
    expect(obs.description).toBe('How well I slept');
  });

  describe('createdAt', () => {
    it('should default to the moment of construction', () => {
      const before = Date.now();
      const obs = new Observation('o1', 'Sleep');

      expect(obs.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(obs.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should keep a time it is given', () => {
      const created = new Date('2025-03-14T09:00:00.000Z');

      const obs = new Observation('o1', 'Sleep', [], null, created);

      expect(obs.createdAt).toEqual(created);
    });

    it('should not accept a new time once constructed', () => {
      const obs = new Observation('o1', 'Sleep');

      // @ts-expect-error the time an Observation was created cannot change
      obs.createdAt = new Date();
    });
  });

  it('should allow adding and removing metrics', () => {
    const obs = new Observation('o1', 'Sleep');
    const metric = new Metric('m1', 'Duration', 'Numeric');
    
    obs.addMetric(metric);
    expect(obs.metrics.length).toBe(1);
    expect(obs.metrics[0].id).toBe('m1');

    obs.removeMetric('m1');
    expect(obs.metrics.length).toBe(0);
  });

  describe('metric name uniqueness', () => {
    const numeric = (id: string, name: string) => new Metric(id, name, 'Numeric');

    it.each([
      ['case', 'Hours', 'hours'],
      ['surrounding whitespace', 'Hours', '  Hours  '],
    ])('should reject two metrics whose names differ only in %s', (_kind, one, other) => {
      expect(() => new Observation('o1', 'Sleep', [numeric('m1', one), numeric('m2', other)]))
        .toThrow('Metric names must be unique within an observation');
    });

    it('should accept metrics whose names are distinct', () => {
      const obs = new Observation('o1', 'Sleep', [numeric('m1', 'Hours'), numeric('m2', 'Quality')]);

      expect(obs.metrics).toHaveLength(2);
    });

    it('should reject a metric colliding with one already held', () => {
      const obs = new Observation('o1', 'Sleep', [numeric('m1', 'Hours')]);

      expect(() => obs.addMetric(numeric('m2', ' HOURS ')))
        .toThrow('Metric names must be unique within an observation');
      expect(obs.metrics).toHaveLength(1);
    });

    it('should accept a metric whose name none of those held share', () => {
      const obs = new Observation('o1', 'Sleep', [numeric('m1', 'Hours')]);

      obs.addMetric(numeric('m2', 'Quality'));

      expect(obs.metrics).toHaveLength(2);
    });

    // Both metrics carry m1, so the second takes the first's place rather than
    // colliding with the name it replaces.
    it('should let a metric replace itself under the name it already holds', () => {
      const obs = new Observation('o1', 'Sleep', [numeric('m1', 'Hours')]);

      obs.addMetric(new Metric('m1', 'Hours', 'Numeric', {min: 0}));

      expect(obs.metrics).toHaveLength(1);
      expect(obs.metrics[0].constraint).toEqual({min: 0});
    });
  });

  describe('createRecord', () => {
    it('should successfully create a record with valid values', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric', { min: 0 });
      const metric2 = new Metric('m2', 'Quality', 'Enum', { allowedValues: ['Good', 'Bad'] });
      const obs = new Observation('o1', 'Sleep', [metric1, metric2]);

      const values = new Map<string, any>([
        ['m1', 8],
        ['m2', 'Good']
      ]);

      const record = obs.createRecord('r1', new Date(), values);
      expect(record.observationId).toBe('o1');
      expect(record.values.get('m1')).toBe(8);
      expect(record.values.get('m2')).toBe('Good');
    });

    it('should pass a note through to the record it creates', () => {
      const obs = new Observation('o1', 'Sleep');

      const record = obs.createRecord('r1', new Date(), new Map(), 'the hotel bed');

      expect(record.note).toBe('the hotel bed');
    });

    it('should leave the record without a note when given none', () => {
      const obs = new Observation('o1', 'Sleep');

      expect(obs.createRecord('r1', new Date(), new Map()).note).toBeNull();
    });

    it('should throw an error if a metric is not defined in the observation', () => {
      const obs = new Observation('o1', 'Sleep');
      const values = new Map<string, any>([
        ['m1', 8] // m1 is not added to obs
      ]);

      expect(() => obs.createRecord('r1', new Date(), values)).toThrow(/is not defined/);
    });

    it('should throw an error if a value is invalid for a metric', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric', { min: 0 });
      const obs = new Observation('o1', 'Sleep', [metric1]);

      const values = new Map<string, any>([
        ['m1', -5] // -5 violates min: 0
      ]);

      expect(() => obs.createRecord('r1', new Date(), values)).toThrow(/Invalid value/);
    });
  });
});
