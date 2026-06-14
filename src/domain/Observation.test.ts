import {describe, expect, it} from 'vitest';
import {Observation} from './Observation';
import {Metric} from './Metric';

describe('Observation', () => {
  it('should initialize with no metrics by default', () => {
    const obs = new Observation('o1', 'Sleep');
    expect(obs.metrics.length).toBe(0);
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
