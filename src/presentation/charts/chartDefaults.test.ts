import {describe, expect, it} from 'vitest';
import {
    DEFAULT_TIME_RANGE_PRESET,
    DEFAULT_TIME_RANGE_SELECTION,
    getAggregationForCustomRange,
    getAggregationForPreset,
    getAggregationForSelection,
    getTimeRangeForPreset,
    getTimeRangeForSelection,
    TIME_RANGE_PRESETS,
    type TimeRangePreset,
} from './chartDefaults';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';

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

const CUSTOM_RANGE_START = new Date('2026-07-01T00:00:00Z');

function customRangeOf(spanMs: number): TimeRange {
  return {start: CUSTOM_RANGE_START, end: new Date(CUSTOM_RANGE_START.getTime() + spanMs)};
}

describe('getAggregationForCustomRange', () => {
  it.each<[string, number, number]>([
    // A day is the shortest span the modal can produce: 24h/30 rounds up to the
    // one-hour floor rather than to 48 unusable minutes.
    ['one day', DAY_MS, HOUR_MS],
    ['four days', 4 * DAY_MS, 4 * HOUR_MS],
    ['a month', 30 * DAY_MS, 24 * HOUR_MS],
    ['a year', 365 * DAY_MS, 292 * HOUR_MS],
  ])('buckets %s into whole hours', (_span, spanMs, expectedBucketSizeMs) => {
    expect(getAggregationForCustomRange(customRangeOf(spanMs))).toEqual({
      bucketSizeMs: expectedBucketSizeMs,
    });
  });

  it.each([DAY_MS, 3 * DAY_MS, 4 * DAY_MS, 30 * DAY_MS, 200 * DAY_MS, 365 * DAY_MS])(
    'keeps a %dms span at or under the bucket target, so no window explodes into thousands',
    spanMs => {
      const {bucketSizeMs} = getAggregationForCustomRange(customRangeOf(spanMs));

      expect(Math.ceil(spanMs / bucketSizeMs)).toBeLessThanOrEqual(30);
    },
  );

  it('never buckets below an hour, however short the range', () => {
    expect(getAggregationForCustomRange(customRangeOf(HOUR_MS))).toEqual({bucketSizeMs: HOUR_MS});
  });
});

describe('getTimeRangeForSelection', () => {
  const now = new Date('2026-07-18T12:00:00Z');

  it('resolves a preset selection against the given moment', () => {
    expect(getTimeRangeForSelection({kind: 'preset', preset: '1W'}, now)).toEqual(
      getTimeRangeForPreset('1W', now),
    );
  });

  it('hands back a custom selection\'s range untouched, ignoring "now"', () => {
    const range = customRangeOf(4 * DAY_MS);

    expect(getTimeRangeForSelection({kind: 'custom', range}, now)).toBe(range);
  });
});

describe('getAggregationForSelection', () => {
  it('buckets a preset selection by that preset', () => {
    expect(getAggregationForSelection({kind: 'preset', preset: '1D'})).toEqual({
      bucketSizeMs: HOUR_MS,
    });
  });

  it("buckets a custom selection by its own span, not by any preset's", () => {
    expect(getAggregationForSelection({kind: 'custom', range: customRangeOf(4 * DAY_MS)})).toEqual({
      bucketSizeMs: 4 * HOUR_MS,
    });
  });
});

describe('DEFAULT_TIME_RANGE_SELECTION', () => {
  const now = new Date('2026-07-18T12:00:00Z');

  it('is the default preset rather than a custom range', () => {
    expect(DEFAULT_TIME_RANGE_SELECTION).toEqual({
      kind: 'preset',
      preset: DEFAULT_TIME_RANGE_PRESET,
    });
  });

  // Generalizing the selection must not move the window every user already
  // sees on load.
  it('resolves to exactly what the default preset resolved to on its own', () => {
    expect(getTimeRangeForSelection(DEFAULT_TIME_RANGE_SELECTION, now)).toEqual(
      getTimeRangeForPreset(DEFAULT_TIME_RANGE_PRESET, now),
    );
    expect(getAggregationForSelection(DEFAULT_TIME_RANGE_SELECTION)).toEqual(
      getAggregationForPreset(DEFAULT_TIME_RANGE_PRESET),
    );
  });
});
