import {describe, expect, it} from 'vitest';
import {metricRemovalPrompt} from './metricRemovalPrompt';

const title = (names: string[]) => metricRemovalPrompt(names, 0).title;
const message = (names: string[], valueCount: number) =>
  metricRemovalPrompt(names, valueCount).message;

describe('metricRemovalPrompt', () => {
  describe('the title', () => {
    it('asks about one metric', () => {
      expect(title(['insufficient'])).toBe('Delete metric?');
    });

    it('asks about several', () => {
      expect(title(['insufficient', 'flag'])).toBe('Delete metrics?');
    });
  });

  describe('the message', () => {
    it('says nothing was recorded against the metric', () => {
      expect(message(['insufficient'], 0)).toBe(
        '“insufficient” will be removed. No record holds a value for it. '
        + 'This cannot be undone.');
    });

    it('counts a single stored value in the singular', () => {
      expect(message(['insufficient'], 1)).toBe(
        '“insufficient” will be removed, along with 1 recorded value. '
        + 'This cannot be undone.');
    });

    it('counts several stored values', () => {
      expect(message(['insufficient'], 45)).toBe(
        '“insufficient” will be removed, along with 45 recorded values. '
        + 'This cannot be undone.');
    });

    it('quotes two names and joins them with an and', () => {
      expect(message(['insufficient', 'flag'], 3)).toBe(
        '“insufficient” and “flag” will be removed, along with 3 recorded '
        + 'values. This cannot be undone.');
    });

    it('joins more than two by commas, the last with an and', () => {
      expect(message(['insufficient', 'flag', 'dense'], 3)).toBe(
        '“insufficient”, “flag” and “dense” will be removed, '
        + 'along with 3 recorded values. This cannot be undone.');
    });

    it('speaks of several metrics holding nothing as them', () => {
      expect(message(['insufficient', 'flag'], 0)).toBe(
        '“insufficient” and “flag” will be removed. No record holds a '
        + 'value for them. This cannot be undone.');
    });
  });
});
