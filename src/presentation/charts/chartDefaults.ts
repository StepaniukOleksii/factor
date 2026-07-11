import {AggregationStrategy, TimeRange} from '../../application/GetMetricSeriesUseCase';

/**
 * Fixed, non-configurable defaults for the Numeric metric trend charts shown on
 * the Observation Details screen: the last 30 days, aggregated into one-day
 * buckets. Centralised here so the data fetch and the chart series share one
 * window definition.
 */
export const NUMERIC_TREND_WINDOW_DAYS = 30;
export const NUMERIC_TREND_BUCKET_SIZE_MS = 24 * 60 * 60 * 1000; // one day

/** Message shown when a Numeric metric has fewer than two aggregated points. */
export const NUMERIC_TREND_INSUFFICIENT_MESSAGE = 'Not enough data yet';

export function getDefaultNumericTrendRange(now: Date = new Date()): TimeRange {
  return {
    start: new Date(now.getTime() - NUMERIC_TREND_WINDOW_DAYS * NUMERIC_TREND_BUCKET_SIZE_MS),
    end: now,
  };
}

export const defaultNumericAggregation: AggregationStrategy = {
  bucketSizeMs: NUMERIC_TREND_BUCKET_SIZE_MS,
};
