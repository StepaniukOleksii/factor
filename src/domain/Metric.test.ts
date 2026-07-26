import {describe, expect, it} from 'vitest';
import {Metric} from './Metric';

describe('Metric', () => {
  describe('Numeric constraint validation', () => {
    it('should validate numeric values without constraints', () => {
      const metric = new Metric('m1', 'Duration', 'Numeric');
      expect(metric.validateValue(10)).toBe(true);
      expect(metric.validateValue(-5)).toBe(true);
      expect(metric.validateValue('10')).toBe(false);
      expect(metric.validateValue(null)).toBe(false);
    });

    it('should validate numeric values with min constraint', () => {
      const metric = new Metric('m1', 'Duration', 'Numeric', { min: 0 });
      expect(metric.validateValue(0)).toBe(true);
      expect(metric.validateValue(10)).toBe(true);
      expect(metric.validateValue(-1)).toBe(false);
    });

    it('should validate numeric values with max constraint', () => {
      const metric = new Metric('m1', 'Duration', 'Numeric', { max: 10 });
      expect(metric.validateValue(10)).toBe(true);
      expect(metric.validateValue(0)).toBe(true);
      expect(metric.validateValue(11)).toBe(false);
    });

    it('should validate numeric values with min and max constraints', () => {
      const metric = new Metric('m1', 'Duration', 'Numeric', { min: 1, max: 10 });
      expect(metric.validateValue(5)).toBe(true);
      expect(metric.validateValue(0)).toBe(false);
      expect(metric.validateValue(11)).toBe(false);
    });
  });

  describe('Boolean validation', () => {
    it('should validate boolean values', () => {
      const metric = new Metric('m2', 'Is Good', 'Boolean');
      expect(metric.validateValue(true)).toBe(true);
      expect(metric.validateValue(false)).toBe(true);
      expect(metric.validateValue(1)).toBe(false);
      expect(metric.validateValue('true')).toBe(false);
    });
  });

  describe('Enum constraint validation', () => {
    it('should validate enum values correctly', () => {
      const metric = new Metric('m3', 'Mood', 'Enum', { allowedValues: ['Happy', 'Sad'] });
      expect(metric.validateValue('Happy')).toBe(true);
      expect(metric.validateValue('Sad')).toBe(true);
      expect(metric.validateValue('Angry')).toBe(false);
      expect(metric.validateValue(123)).toBe(false);
    });

    it('should fail if no constraints are provided for enum', () => {
      const metric = new Metric('m3', 'Mood', 'Enum');
      expect(metric.validateValue('Happy')).toBe(false);
    });
  });

  describe('description', () => {
    it('should default to null', () => {
      expect(new Metric('m1', 'Duration', 'Numeric').description).toBeNull();
      expect(new Metric('m1', 'Duration', 'Numeric', { min: 0 }).description).toBeNull();
    });

    it('should carry the description it is given, newlines included', () => {
      const metric = new Metric('m1', 'Mood', 'Numeric', { min: 1, max: 5 }, '1 = low\n5 = great');
      expect(metric.description).toBe('1 = low\n5 = great');
    });

    // Guidance for whoever enters a value, not a rule about the value itself.
    it('should not affect value validation', () => {
      const metric = new Metric('m1', 'Duration', 'Numeric', { min: 0 }, 'Minutes of actual sleep.');
      expect(metric.validateValue(10)).toBe(true);
      expect(metric.validateValue(-1)).toBe(false);
    });
  });
});
