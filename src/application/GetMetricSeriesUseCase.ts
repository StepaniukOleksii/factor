import {Metric} from '../domain/Metric';
import {Record} from '../domain/Record';

/**
 * A half-open time window `[start, end)` used to scope which Records are
 * included in a metric series query.
 *
 * Co-located with the use case rather than placed in `src/domain/`: it
 * describes a query over Records, not an intrinsic domain rule.
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * How Records are grouped along the time axis before each group is reduced to a
 * single series point. Buckets are fixed-width and anchored at `TimeRange.start`.
 */
export interface AggregationStrategy {
  /** Width of each aggregation bucket, in milliseconds. Must be positive. */
  bucketSizeMs: number;
}

/**
 * A single point on a metric's chart series. `recordId` links the point back to
 * a representative Record for tap-to-detail — the earliest Record in the bucket
 * when several are aggregated.
 */
export interface MetricSeriesPoint {
  x: number;
  y: number;
  recordId: string;
}

/**
 * Turns a Metric's Records into a chart-ready series for a given time range and
 * aggregation strategy.
 *
 * Records outside the range (or without a value for the metric) are dropped; the
 * rest are grouped into fixed-width time buckets and each bucket is reduced to a
 * single point per the metric's `MetricValueType` (mean for Numeric). Only the
 * Numeric reduction is implemented in this slice; other value types throw until
 * their own slices land, since nothing calls this utility with those types yet.
 */
export class GetMetricSeriesUseCase {
  execute(
    records: Record[],
    metric: Metric,
    timeRange: TimeRange,
    aggregation: AggregationStrategy
  ): MetricSeriesPoint[] {
    const bucketSizeMs = aggregation.bucketSizeMs;
    if (!(bucketSizeMs > 0)) {
      throw new Error('AggregationStrategy.bucketSizeMs must be a positive number.');
    }

    const startMs = timeRange.start.getTime();
    const endMs = timeRange.end.getTime();

    const inRange = records
      .filter(record => {
        const timestamp = record.timestamp.getTime();
        const value = record.getValue(metric.id);
        return (
          timestamp >= startMs &&
          timestamp < endMs &&
          value !== undefined &&
          value !== null
        );
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const buckets = new Map<number, Record[]>();
    for (const record of inRange) {
      const index = Math.floor((record.timestamp.getTime() - startMs) / bucketSizeMs);
      const existing = buckets.get(index);
      if (existing) {
        existing.push(record);
      } else {
        buckets.set(index, [record]);
      }
    }

    return Array.from(buckets.keys())
      .sort((a, b) => a - b)
      .map(index => {
        const bucketRecords = buckets.get(index)!;
        return {
          x: startMs + index * bucketSizeMs,
          y: this.reduce(bucketRecords, metric),
          recordId: bucketRecords[0].id,
        };
      });
  }

  private reduce(records: Record[], metric: Metric): number {
    switch (metric.type) {
      case 'Numeric':
        return this.mean(records, metric);
      case 'Boolean':
      case 'Enum':
      case 'Text':
        throw new Error(
          `Aggregation for metric type '${metric.type}' is not implemented.`
        );
      default:
        return this.assertNever(metric.type);
    }
  }

  private mean(records: Record[], metric: Metric): number {
    const values = records.map(record => record.getValue(metric.id) as number);
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }

  private assertNever(type: never): never {
    throw new Error(`Unhandled metric value type: ${String(type)}`);
  }
}
