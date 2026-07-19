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
 * The two coarser tiers space their ticks between the range's true endpoints,
 * since a month scale's first and last dates are two different days both worth
 * naming. The two finer tiers instead divide the range into equal slices — an
 * hour, or a calendar day — and caption each slice from its middle, because
 * those scales wrap: an hour scale's 24th hour and a week's 8th day are its own
 * first hour and first day again, so a tick at the range's exact end would
 * repeat the opening label rather than say anything new.
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
  return Array.from({length: tickCount}, (_, index) => {
    const ratio = index / lastIndex;
    return {ratio, label: formatAxisValueLabel(minValue + ratio * (maxValue - minValue))};
  });
}

/**
 * A tick's own moment, said as briefly as its tier allows: the hour alone
 * within a day, the weekday's initial within a week, a short date within a
 * couple of months, and a month with a two-digit year beyond that — never the
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
 */
export function formatAxisValueLabel(value: number): string {
  const magnitude = Math.abs(value);
  const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
  return String(Number(value.toFixed(decimals)));
}

/**
 * How many equal slices a divided tier cuts its range into: a fixed eight for
 * the hour tier, and one per calendar day the range covers — capped at a full
 * week — for the week tier, so a five-day custom range reads as five days
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
