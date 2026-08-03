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

/** A single point on a metric's chart series. */
export interface MetricSeriesPoint {
  /** The bucket's start: a point on a fixed grid laid over the range, not any Record's own time. */
  x: number;
  y: number;
  /** A representative Record for tap-to-detail - the earliest in the bucket. */
  recordId: string;
  /** How many Records were folded into this point. */
  recordCount: number;
  /**
   * When the earliest and latest of those Records were actually taken. A bucket's
   * edges rarely coincide with any Record and its far edge may lie past the last
   * one, so `x` cannot answer this and a caller wanting the span the Records
   * themselves occupy needs these two.
   */
  firstRecordAt: number;
  lastRecordAt: number;
}

/**
 * Turns a Metric's Records into a chart-ready series.
 *
 * Records outside the range, or without a value for the metric, are dropped; the
 * rest are bucketed and each bucket reduced per the metric's `MetricValueType`
 * (mean for Numeric). Only the Numeric reduction exists - other value types throw
 * until their own slices land rather than returning something plausible.
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
        // Sorted by timestamp above, so the ends of the bucket's own list are
        // the earliest and latest Records in it.
        const lastRecord = bucketRecords[bucketRecords.length - 1];
        return {
          x: startMs + index * bucketSizeMs,
          y: this.reduce(bucketRecords, metric),
          recordId: bucketRecords[0].id,
          recordCount: bucketRecords.length,
          firstRecordAt: bucketRecords[0].timestamp.getTime(),
          lastRecordAt: lastRecord.timestamp.getTime(),
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
