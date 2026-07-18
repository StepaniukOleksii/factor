import {AggregationStrategy, TimeRange} from '../../application/GetMetricSeriesUseCase';

/** Message shown when a Numeric metric has fewer than two aggregated points. */
export const NUMERIC_TREND_INSUFFICIENT_MESSAGE = 'Not enough data yet';

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
 * Each preset's window paired with the bucket size it is aggregated into, so that
 * a year of Records reads as clearly as a day of them rather than collapsing into
 * an unreadable smear of points. Declared shortest window first — the order the
 * selector renders them in.
 */
export const TIME_RANGE_PRESETS: Record<TimeRangePreset, TimeRangePresetConfig> = {
  '1D': {windowMs: DAY_MS, bucketSizeMs: HOUR_MS},
  '1W': {windowMs: 7 * DAY_MS, bucketSizeMs: DAY_MS},
  '1M': {windowMs: 30 * DAY_MS, bucketSizeMs: DAY_MS},
  '1Y': {windowMs: 365 * DAY_MS, bucketSizeMs: 30 * DAY_MS},
};

/**
 * Selected when the Observation Details screen mounts. Its window and bucket size
 * are the fixed ones the trend chart shipped with before presets existed, so the
 * default selection reproduces exactly the chart users already see.
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
 * Bucket size for an arbitrary custom range: targets ~30 buckets across the
 * range's span, floored at 1 hour and always a whole number of hours, so a
 * short custom range doesn't collapse to too few buckets and a long one doesn't
 * explode into thousands of them. Independent of the day-level precision
 * Start/End are selected at — bucket size and input granularity are separate
 * concerns, same as they are for the four presets.
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
