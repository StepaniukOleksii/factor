import {AggregationStrategy, TimeRange} from '../../application/GetMetricSeriesUseCase';

/** Message shown when a metric has no aggregated points at all. */
export const TREND_INSUFFICIENT_MESSAGE = 'Not enough data yet';

/**
 * The largest count an aggregated point spells out. Past it the exact number
 * stops being worth the width - "a lot" is the whole message - so the label
 * stays three characters wide however many Records a bucket folds.
 */
export const AGGREGATION_COUNT_DISPLAY_CAP = 99;

/**
 * How an aggregated chart point's Record count is labelled: the count itself
 * while it fits, `"99+"` beyond the cap. Only points standing for more than one
 * Record are labelled, so this is never called with `1`.
 */
export function formatPointCount(recordCount: number): string {
  return recordCount > AGGREGATION_COUNT_DISPLAY_CAP
    ? `${AGGREGATION_COUNT_DISPLAY_CAP}+`
    : String(recordCount);
}

/** The time windows a user can choose between for an Observation's trend charts. */
export type TimeRangePreset = '1D' | '1W' | '1M' | '1Y';

interface TimeRangePresetConfig {
  /** How far back from now the window reaches. */
  windowMs: number;
  /** Width of the buckets the window is aggregated into. */
  bucketSizeMs: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The calendar day `date` falls on, as local midnight. Every window the user can
 * land on is built from whole days, so this and `startOfNextDay` are what pin
 * them to that grid - whether the days were picked in the range modal or taken
 * from the Records behind a zoomed chart point.
 */
export function floorToDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local midnight of the day after `date`'s - the exclusive end of that day. */
export function startOfNextDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

/**
 * The whole calendar days `from` and `to` fall within, as a half-open range. The
 * alignment only ever grows the window outwards, so a range built from an
 * aggregated point's first and last Record still contains both.
 *
 * A day is the narrowest window this can produce, which is what stops zoom going
 * further: a one-day window is bucketed by the hour (see
 * `getAggregationForCustomRange`), and every Record in such a bucket shares a
 * day, so aligning again returns the same window.
 */
export function getDayAlignedRange(from: Date, to: Date): TimeRange {
  return {start: floorToDay(from), end: startOfNextDay(to)};
}

/**
 * Each preset's window paired with its bucket size, so a year of Records reads as
 * clearly as a day of them. Declared shortest window first - the order the
 * selector renders them in.
 */
export const TIME_RANGE_PRESETS: Record<TimeRangePreset, TimeRangePresetConfig> = {
  '1D': {windowMs: DAY_MS, bucketSizeMs: HOUR_MS},
  '1W': {windowMs: 7 * DAY_MS, bucketSizeMs: DAY_MS},
  '1M': {windowMs: 30 * DAY_MS, bucketSizeMs: DAY_MS},
  '1Y': {windowMs: 365 * DAY_MS, bucketSizeMs: 30 * DAY_MS},
};

/**
 * Selected on mount. Its window and bucket size are pinned: changing either
 * silently moves the chart every existing user already sees.
 */
export const DEFAULT_TIME_RANGE_PRESET: TimeRangePreset = '1M';

export function getTimeRangeForPreset(preset: TimeRangePreset, now: Date = new Date()): TimeRange {
  return {
    start: new Date(now.getTime() - TIME_RANGE_PRESETS[preset].windowMs),
    end: now,
  };
}

export function getAggregationForPreset(preset: TimeRangePreset): AggregationStrategy {
  return {bucketSizeMs: TIME_RANGE_PRESETS[preset].bucketSizeMs};
}

/**
 * Which window the Trends section is currently scoped to: one of the four fixed
 * presets, or an arbitrary range the user entered. Wraps `TimeRangePreset`
 * rather than replacing it, since a preset is still the default and the common
 * case.
 */
export type TimeRangeSelection =
  | {kind: 'preset'; preset: TimeRangePreset}
  | {kind: 'custom'; range: TimeRange};

export const DEFAULT_TIME_RANGE_SELECTION: TimeRangeSelection = {
  kind: 'preset',
  preset: DEFAULT_TIME_RANGE_PRESET,
};

const CUSTOM_RANGE_TARGET_BUCKETS = 30;

/**
 * Bucket size for an arbitrary custom range: ~30 buckets across the span,
 * floored at 1 hour and always a whole number of hours, so a short range doesn't
 * collapse to too few buckets and a long one doesn't explode into thousands.
 *
 * Independent of the day-level precision Start/End are picked at - bucket size
 * and input granularity are separate concerns, as they are for the presets.
 */
export function getAggregationForCustomRange(range: TimeRange): AggregationStrategy {
  const spanMs = range.end.getTime() - range.start.getTime();
  const rawBucketMs = spanMs / CUSTOM_RANGE_TARGET_BUCKETS;
  const bucketSizeMs = Math.max(HOUR_MS, Math.ceil(rawBucketMs / HOUR_MS) * HOUR_MS);
  return {bucketSizeMs};
}

export function getTimeRangeForSelection(
  selection: TimeRangeSelection,
  now: Date = new Date(),
): TimeRange {
  return selection.kind === 'preset'
    ? getTimeRangeForPreset(selection.preset, now)
    : selection.range;
}

export function getAggregationForSelection(selection: TimeRangeSelection): AggregationStrategy {
  return selection.kind === 'preset'
    ? getAggregationForPreset(selection.preset)
    : getAggregationForCustomRange(selection.range);
}
