import {describe, expect, it} from 'vitest';
import {
  DEFAULT_TIME_RANGE_PRESET,
  getAggregationForPreset,
  getTimeRangeForPreset,
  TIME_RANGE_PRESETS,
  type TimeRangePreset,
} from './chartDefaults';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// The fixed window the trend chart shipped with before presets existed. The
// default preset has to keep reproducing it exactly, otherwise adding the
// selector silently changes the chart every user already sees.
const PREVIOUS_FIXED_WINDOW_MS = 30 * DAY_MS;
const PREVIOUS_FIXED_BUCKET_SIZE_MS = DAY_MS;

describe('getTimeRangeForPreset', () => {
  const now = new Date('2026-07-18T12:00:00Z');

  it.each<[TimeRangePreset, number]>([
    ['1D', DAY_MS],
    ['1W', 7 * DAY_MS],
    ['1M', 30 * DAY_MS],
    ['1Y', 365 * DAY_MS],
  ])('spans %s back from the given moment', (preset, expectedWindowMs) => {
    const range = getTimeRangeForPreset(preset, now);

    expect(range.end).toEqual(now);
    expect(range.end.getTime() - range.start.getTime()).toBe(expectedWindowMs);
  });

  it('ends now when no reference moment is given', () => {
    const before = Date.now();
    const range = getTimeRangeForPreset('1M');
    const after = Date.now();

    expect(range.end.getTime()).toBeGreaterThanOrEqual(before);
    expect(range.end.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('getAggregationForPreset', () => {
  it.each<[TimeRangePreset, number]>([
    ['1D', HOUR_MS],
    ['1W', DAY_MS],
    ['1M', DAY_MS],
    ['1Y', 30 * DAY_MS],
  ])('buckets %s by its own bucket size', (preset, expectedBucketSizeMs) => {
    expect(getAggregationForPreset(preset)).toEqual({bucketSizeMs: expectedBucketSizeMs});
  });
});

describe('DEFAULT_TIME_RANGE_PRESET', () => {
  it('is the one-month preset', () => {
    expect(DEFAULT_TIME_RANGE_PRESET).toBe('1M');
  });

  it('reproduces the fixed 30-day, one-day-bucket window the chart shipped with', () => {
    const {windowMs, bucketSizeMs} = TIME_RANGE_PRESETS[DEFAULT_TIME_RANGE_PRESET];

    expect(windowMs).toBe(PREVIOUS_FIXED_WINDOW_MS);
    expect(bucketSizeMs).toBe(PREVIOUS_FIXED_BUCKET_SIZE_MS);
  });
});
