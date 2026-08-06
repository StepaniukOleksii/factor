import {EnumConstraint, Metric} from '../domain/Metric';
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
 * What every point carries whatever its metric's value type: which Records it
 * stands for, rather than what they reduced to.
 */
interface MetricSeriesPointBase {
  /** The bucket's start: a point on a fixed grid laid over the range, not any Record's own time. */
  x: number;
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

export interface NumericSeriesPoint extends MetricSeriesPointBase {
  kind: 'numeric';
  /** The bucket's mean. */
  y: number;
}

/** How much of a bucket one of its metric's values accounts for. */
export interface CategoryShare {
  value: string;
  /** In `(0, 1]` - a value no Record took is absent rather than present at zero. */
  share: number;
}

export interface CategorySeriesPoint extends MetricSeriesPointBase {
  /**
   * `'category'` rather than `'enum'`: a Boolean metric reduces to this same
   * shape, its two values being a fixed pair rather than a declared list.
   */
  kind: 'category';
  /** In the metric's own declared value order, summing to 1. */
  shares: CategoryShare[];
}

/** A single point on a metric's chart series. */
export type MetricSeriesPoint = NumericSeriesPoint | CategorySeriesPoint;

/**
 * Which kind a point is. The renderer registry pairs a renderer with a metric
 * type rather than with a point kind, so a renderer is handed `MetricSeriesPoint`
 * and narrows it itself.
 */
export function isNumericPoint(point: MetricSeriesPoint): point is NumericSeriesPoint {
  return point.kind === 'numeric';
}

export function isCategoryPoint(point: MetricSeriesPoint): point is CategorySeriesPoint {
  return point.kind === 'category';
}

/** The half of a point that its metric's value type decides. */
type SeriesPointValue =
  | Pick<NumericSeriesPoint, 'kind' | 'y'>
  | Pick<CategorySeriesPoint, 'kind' | 'shares'>;

/**
 * Turns a Metric's Records into a chart-ready series.
 *
 * Records outside the range, or without a value the metric can chart, are
 * dropped; the rest are bucketed and each bucket reduced per the metric's
 * `MetricValueType` (mean for Numeric, per-value shares for Enum). Boolean and
 * Text throw until their own slices land rather than returning something
 * plausible.
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
        return (
          timestamp >= startMs &&
          timestamp < endMs &&
          this.charts(record.getValue(metric.id), metric)
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
          recordId: bucketRecords[0].id,
          recordCount: bucketRecords.length,
          firstRecordAt: bucketRecords[0].timestamp.getTime(),
          lastRecordAt: lastRecord.timestamp.getTime(),
          ...this.reduce(bucketRecords, metric),
        };
      });
  }

  /**
   * Whether a Record's value for this metric belongs in the series at all. An
   * Enum value outside `allowedValues` has no lane to be drawn in - and with no
   * constraint there are no lanes, so nothing charts.
   */
  private charts(value: unknown, metric: Metric): boolean {
    if (value === undefined || value === null) {
      return false;
    }
    return metric.type !== 'Enum' || this.allowedValues(metric).includes(value as string);
  }

  private allowedValues(metric: Metric): string[] {
    return (metric.constraint as EnumConstraint | null)?.allowedValues ?? [];
  }

  private reduce(records: Record[], metric: Metric): SeriesPointValue {
    switch (metric.type) {
      case 'Numeric':
        return {kind: 'numeric', y: this.mean(records, metric)};
      case 'Enum':
        return {kind: 'category', shares: this.shares(records, metric)};
      case 'Boolean':
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

  private shares(records: Record[], metric: Metric): CategoryShare[] {
    const counts = new Map<string, number>();
    for (const record of records) {
      const value = record.getValue(metric.id) as string;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return this.allowedValues(metric)
      .filter(value => counts.has(value))
      .map(value => ({value, share: counts.get(value)! / records.length}));
  }

  private assertNever(type: never): never {
    throw new Error(`Unhandled metric value type: ${String(type)}`);
  }
}
