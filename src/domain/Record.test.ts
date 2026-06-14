import {describe, expect, it} from 'vitest';
import {Observation} from './Observation';
import {Metric} from './Metric';
import {Record} from './Record';

describe('Record', () => {
  it('should initialize with values', () => {
    const date = new Date();
    const record = new Record('r1', 'o1', date, new Map([['m1', 10]]));

    expect(record.id).toBe('r1');
    expect(record.observationId).toBe('o1');
    expect(record.timestamp).toBe(date);
    expect(record.values.get('m1')).toBe(10);
  });

  it('should allow getting and removing values', () => {
    const record = new Record('r1', 'o1', new Date(), new Map([['m1', 10]]));
    expect(record.getValue('m1')).toBe(10);
    
    record.removeValue('m1');
    expect(record.getValue('m1')).toBeUndefined();
  });

  describe('updateValues', () => {
    it('should update values when observation is valid and values are correct', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric');
      const obs = new Observation('o1', 'Sleep', [metric1]);
      
      const record = new Record('r1', 'o1', new Date(), new Map());
      const newValues = new Map<string, any>([['m1', 8]]);
      
      record.updateValues(newValues, obs);
      expect(record.getValue('m1')).toBe(8);
    });

    it('should throw an error if observation id does not match', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric');
      const obs = new Observation('o2', 'Sleep', [metric1]); // Notice o2 instead of o1
      
      const record = new Record('r1', 'o1', new Date(), new Map());
      
      expect(() => record.updateValues(new Map([['m1', 8]]), obs)).toThrow(/mismatch/);
    });

    it('should throw an error if values are invalid according to the observation', () => {
      const metric1 = new Metric('m1', 'Duration', 'Numeric');
      const obs = new Observation('o1', 'Sleep', [metric1]);
      
      const record = new Record('r1', 'o1', new Date(), new Map());
      const newValues = new Map<string, any>([['m1', 'invalid_string']]);
      
      expect(() => record.updateValues(newValues, obs)).toThrow(/Invalid value/);
    });
  });
});
