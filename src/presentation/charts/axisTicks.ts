import type {TimeRange} from '../../application/GetMetricSeriesUseCase';
import {formatShortDate} from '@shared/formatTimeRange';

/**
 * One label on a chart axis, positioned by how far along that axis it sits.
 *
 * `ratio` is deliberately unitless: the chart owns its pixel geometry, so the
 * same tick maps onto whatever plotting rectangle it ends up drawn into.
 */
export interface AxisTick {
  /** Fractional position along the axis, `0` at its start and `1` at its end. */
  ratio: number;
  /** The formatted text to draw at that position. */
  label: string;
}

/**
 * How coarse a chart's time labels read. Chosen from the window's span alone,
 * never from which preset produced it, so a custom range and a preset covering
 * the same amount of time are labelled identically.
 */
export type TimeAxisTier = 'hour' | 'week' | 'month' | 'year';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Roughly two months: past this, individual dates stop being worth naming. */
const MONTH_TIER_MAX_MS = 62 * DAY_MS;

const HOUR_TIER_SLICES = 8;
const WEEK_TIER_MAX_SLICES = 7;
const DATE_TIER_TICKS = 5;

export function getTimeAxisTier(spanMs: number): TimeAxisTier {
  if (spanMs <= DAY_MS) {
    return 'hour';
  }
  if (spanMs <= WEEK_TIER_MAX_SLICES * DAY_MS) {
    return 'week';
  }
  if (spanMs <= MONTH_TIER_MAX_MS) {
    return 'month';
  }
  return 'year';
}

/**
 * The time labels a chart drawn over `timeRange` shows along its bottom edge.
 *
 * The coarser tiers space ticks between the range's true endpoints, since a month
 * scale's first and last dates are both worth naming. The finer tiers instead
 * caption the middle of each equal slice, because those scales wrap: an hour
 * scale's 24th hour and a week's 8th day are its own first again, so a tick at
 * the exact end would just repeat the opening label.
 */
export function getTimeAxisTicks(timeRange: TimeRange): AxisTick[] {
  const startMs = timeRange.start.getTime();
  const spanMs = timeRange.end.getTime() - startMs;
  const tier = getTimeAxisTier(spanMs);

  const ratios =
    tier === 'hour' || tier === 'week'
      ? sliceCentreRatios(sliceCount(tier, spanMs))
      : endpointRatios(DATE_TIER_TICKS);

  return ratios.map(ratio => ({
    ratio,
    label: formatAxisTimeLabel(new Date(startMs + ratio * spanMs), tier),
  }));
}

/**
 * `tickCount` labels spread evenly across `[minValue, maxValue]`, the same
 * domain the curve itself is scaled against, so each one names the value its
 * gridline actually sits at.
 */
export function getValueAxisTicks(
  minValue: number,
  maxValue: number,
  tickCount: number,
): AxisTick[] {
  // A lone tick spans no interval, so clamping the divisor keeps that degenerate
  // count off a division by zero. A flat series needs no such guard: its zero
  // value span simply gives every tick the same label.
  const lastIndex = Math.max(tickCount - 1, 1);
  const ratios = Array.from({length: tickCount}, (_, index) => index / lastIndex);
  const values = ratios.map(ratio => minValue + ratio * (maxValue - minValue));
  // Chosen from the whole axis at once, never per label - see `chooseValueUnit`.
  const unit = chooseValueUnit(values);

  return ratios.map((ratio, index) => ({
    ratio,
    label: formatAxisValueLabel(values[index], unit),
  }));
}

/**
 * A factor an axis divides its values by before writing them, and the letter
 * that says it did.
 */
export interface ValueUnit {
  factor: number;
  /** Written after the scaled number; empty for the unscaled unit. */
  suffix: string;
}

/** Values written as they are. */
export const PLAIN_UNIT: ValueUnit = {factor: 1, suffix: ''};

/**
 * Largest first, so the first one a magnitude reaches is the smallest that
 * brings it under 1000 - which is what caps a scaled label at `999`, `99.9` or
 * `9.99` and its letter.
 *
 * Stops at `T`. Past 10^15 the scaled number grows digits again, which the
 * chart handles by dropping a label it cannot fit rather than drawing a clipped
 * one; a Metric counting in quadrillions is not what this app records.
 */
const SCALED_UNITS: ReadonlyArray<ValueUnit> = [
  {factor: 1e12, suffix: 'T'},
  {factor: 1e9, suffix: 'B'},
  {factor: 1e6, suffix: 'M'},
  {factor: 1e3, suffix: 'k'},
];

/**
 * How many characters of a plain label the gutter holds. At the axis size five
 * fit whatever they are - `99999` measures 24.4px and `-9999` 22.0px against the
 * 27px `LABEL_GUTTER` leaves - and a sixth digit overruns it: `999999` is 29.3px
 * and `-99999` 27.1px. A value label is right-aligned and never truncated, since
 * a truncated number is a different number, so an overrun would be drawn off the
 * canvas, silently losing its leading digits and reading as a smaller value.
 *
 * Scaling rather than widening: the gutter is one width for every chart so that
 * a column of them puts the same moment at the same pixel, so a Numeric chart
 * cannot buy room by taking more of it.
 */
const PLAIN_LABEL_MAX_CHARS = 5;

/**
 * The unit a whole axis writes its labels in: none while the plain numbers fit
 * the gutter, otherwise the smallest that brings its widest value under 1000.
 *
 * One unit for the axis, not one per label. A label picking its own would put
 * `99000` beside `105k` on the same five gridlines, which reads as two scales
 * rather than one.
 *
 * Chosen by formatting the labels rather than from a threshold on the range,
 * because what decides this is whether the widest one fits, and how wide a value
 * writes depends on its sign and its decimals as much as on its size.
 */
export function chooseValueUnit(values: ReadonlyArray<number>): ValueUnit {
  const widestPlain = values.reduce(
    (widest, value) => Math.max(widest, formatAxisValueLabel(value).length),
    0,
  );
  if (widestPlain <= PLAIN_LABEL_MAX_CHARS) {
    return PLAIN_UNIT;
  }
  const magnitude = values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  return SCALED_UNITS.find(unit => magnitude >= unit.factor) ?? PLAIN_UNIT;
}

/**
 * A tick's own moment, said as briefly as its tier allows: the hour alone
 * within a day, the weekday's initial within a week, a short date within a
 * couple of months, and a month with a two-digit year beyond that - never the
 * full four-digit year, which costs two characters to say what one glance at
 * the neighbouring ticks already tells you.
 */
export function formatAxisTimeLabel(date: Date, tier: TimeAxisTier): string {
  switch (tier) {
    case 'hour':
      return String(date.getHours());
    case 'week':
      return date.toLocaleDateString([], {weekday: 'narrow'}).charAt(0).toUpperCase();
    case 'month':
      return formatShortDate(date);
    case 'year':
      return `${date.toLocaleDateString([], {month: 'short'})} '${twoDigitYear(date)}`;
  }
}

/**
 * A value as a short axis label: precise enough to tell neighbouring gridlines
 * apart, without the decimal noise averaging a bucket leaves behind (a bucket
 * mean of `12.333333333333334` reads as `12.3`). Trailing zeros are dropped, so
 * a whole number stays a whole number.
 *
 * `unit` belongs to the axis rather than to this value, and defaults to none -
 * the same decimals rule then applies to the scaled number, so `123456` under
 * `k` reads `123k` and `1234` reads `1.23k`. Zero is written bare whatever the
 * unit, since `0k` says nothing `0` does not.
 */
export function formatAxisValueLabel(value: number, unit: ValueUnit = PLAIN_UNIT): string {
  const scaled = value / unit.factor;
  const magnitude = Math.abs(scaled);
  const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
  const written = String(Number(scaled.toFixed(decimals)));
  return written === '0' ? written : written + unit.suffix;
}

/**
 * How many equal slices a divided tier cuts its range into: a fixed eight for
 * the hour tier, and one per calendar day the range covers - capped at a full
 * week - for the week tier, so a five-day custom range reads as five days
 * rather than being stretched to seven.
 */
function sliceCount(tier: 'hour' | 'week', spanMs: number): number {
  if (tier === 'hour') {
    return HOUR_TIER_SLICES;
  }
  const days = Math.round(spanMs / DAY_MS);
  return Math.min(Math.max(days, 1), WEEK_TIER_MAX_SLICES);
}

/** The centre of each of `count` equal slices, so no ratio reaches `0` or `1`. */
function sliceCentreRatios(count: number): number[] {
  return Array.from({length: count}, (_, index) => (index + 0.5) / count);
}

/** `count` ratios spanning the axis end to end, the first `0` and the last `1`. */
function endpointRatios(count: number): number[] {
  return Array.from({length: count}, (_, index) => index / (count - 1));
}

function twoDigitYear(date: Date): string {
  return String(date.getFullYear() % 100).padStart(2, '0');
}
