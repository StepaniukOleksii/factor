import {describe, expect, it} from 'vitest';
import {
    AggregationStrategy,
    type CategorySeriesPoint,
    type CategoryShare,
    GetMetricSeriesUseCase,
    isCategoryPoint,
    type MetricSeriesPoint,
    TimeRange,
} from './GetMetricSeriesUseCase';
import {Metric} from '../domain/Metric';
import {Record} from '../domain/Record';

const DAY_MS = 24 * 60 * 60 * 1000;

function numericMetric(id = 'm1'): Metric {
  return new Metric(id, 'Weight', 'Numeric');
}

function record(
  id: string,
  timestamp: Date,
  metricId: string,
  value: unknown
): Record {
  return new Record(id, 'obs1', timestamp, new Map([[metricId, value]]));
}

describe('GetMetricSeriesUseCase', () => {
  const useCase = new GetMetricSeriesUseCase();

  it('reduces each Numeric bucket to its mean and skips empty buckets', () => {
    const metric = numericMetric();
    const start = new Date('2026-01-01T00:00:00.000Z');
    const startMs = start.getTime();
    const timeRange: TimeRange = {start, end: new Date('2026-01-04T00:00:00.000Z')};
    const aggregation: AggregationStrategy = {bucketSizeMs: DAY_MS};

    const records = [
      record('a', new Date(startMs + 1 * 60 * 60 * 1000), metric.id, 10), // day 0
      record('b', new Date(startMs + 5 * 60 * 60 * 1000), metric.id, 20), // day 0
      record('c', new Date(startMs + DAY_MS + 60 * 1000), metric.id, 5), //  day 1
      // day 2 intentionally has no records
    ];

    const series = useCase.execute(records, metric, timeRange, aggregation);

    expect(series).toEqual([
      {
        kind: 'numeric',
        x: startMs,
        y: 15,
        recordId: 'a',
        recordCount: 2,
        firstRecordAt: startMs + 1 * 60 * 60 * 1000,
        lastRecordAt: startMs + 5 * 60 * 60 * 1000,
      },
      {
        kind: 'numeric',
        x: startMs + DAY_MS,
        y: 5,
        recordId: 'c',
        recordCount: 1,
        firstRecordAt: startMs + DAY_MS + 60 * 1000,
        lastRecordAt: startMs + DAY_MS + 60 * 1000,
      },
    ]);
  });

  it('reports when each bucket’s earliest and latest Records were actually taken', () => {
    const metric = numericMetric();
    const start = new Date('2026-01-01T00:00:00.000Z');
    const startMs = start.getTime();
    const timeRange: TimeRange = {start, end: new Date('2026-01-04T00:00:00.000Z')};
    const aggregation: AggregationStrategy = {bucketSizeMs: DAY_MS};

    const earliest = new Date(startMs + 3 * 60 * 60 * 1000);
    const latest = new Date(startMs + 20 * 60 * 60 * 1000);
    const records = [
      // Deliberately out of order, and nowhere near the bucket's own edges: the
      // point reports the Records' own times, not the grid's.
      record('middle', new Date(startMs + 11 * 60 * 60 * 1000), metric.id, 20),
      record('latest', latest, metric.id, 30),
      record('earliest', earliest, metric.id, 10),
    ];

    const [point] = useCase.execute(records, metric, timeRange, aggregation);

    expect(point.firstRecordAt).toBe(earliest.getTime());
    expect(point.lastRecordAt).toBe(latest.getTime());
    expect(point.x).toBe(startMs);
  });

  it('collapses a single-Record bucket’s first and last onto the same instant', () => {
    const metric = numericMetric();
    const taken = new Date(500);

    const [point] = useCase.execute(
      [record('only', taken, metric.id, 42)],
      metric,
      {start: new Date(0), end: new Date(1000)},
      {bucketSizeMs: 1000}
    );

    expect(point.firstRecordAt).toBe(taken.getTime());
    expect(point.lastRecordAt).toBe(taken.getTime());
  });

  it('counts the Records folded into each bucket', () => {
    const metric = numericMetric();
    const start = new Date('2026-01-01T00:00:00.000Z');
    const startMs = start.getTime();
    const timeRange: TimeRange = {start, end: new Date('2026-01-04T00:00:00.000Z')};
    const aggregation: AggregationStrategy = {bucketSizeMs: DAY_MS};

    const records = [
      record('a', new Date(startMs + 1 * 60 * 60 * 1000), metric.id, 10), // day 0
      record('b', new Date(startMs + 5 * 60 * 60 * 1000), metric.id, 20), // day 0
      record('c', new Date(startMs + 9 * 60 * 60 * 1000), metric.id, 30), // day 0
      record('d', new Date(startMs + DAY_MS + 60 * 1000), metric.id, 5), //  day 1
    ];

    const series = useCase.execute(records, metric, timeRange, aggregation);

    // Three Records behind the first point and one behind the second, so a
    // caller can tell which points hide detail and which already are the detail.
    expect(series.map(point => point.recordCount)).toEqual([3, 1]);
  });

  it('counts only the Records that contribute a value to the bucket', () => {
    const metric = numericMetric();
    const records = [
      record('has-value', new Date(100), metric.id, 42),
      record('also-has-value', new Date(200), metric.id, 44),
      // Same bucket, but contributes nothing to the point's value, so it is not
      // one of the Records the point stands for either.
      new Record('no-value', 'obs1', new Date(300), new Map([['other-metric', 7]])),
    ];

    const series = useCase.execute(
      records,
      metric,
      {start: new Date(0), end: new Date(1000)},
      {bucketSizeMs: 1000}
    );

    expect(series).toEqual([
      {
        kind: 'numeric',
        x: 0,
        y: 43,
        recordId: 'has-value',
        recordCount: 2,
        firstRecordAt: 100,
        lastRecordAt: 200,
      },
    ]);
  });

  it('buckets by half-open boundaries anchored at the range start', () => {
    const metric = numericMetric();
    const timeRange: TimeRange = {start: new Date(0), end: new Date(3000)};
    const aggregation: AggregationStrategy = {bucketSizeMs: 1000};

    const records = [
      record('start-edge', new Date(0), metric.id, 1), //   bucket 0 (start is inclusive)
      record('bucket0-end', new Date(999), metric.id, 3), // bucket 0
      record('bucket1', new Date(1000), metric.id, 10), //  bucket 1 (boundary → later bucket)
      record('end-edge', new Date(3000), metric.id, 99), //  == end → excluded
    ];

    const series = useCase.execute(records, metric, timeRange, aggregation);

    expect(series).toEqual([
      {
        kind: 'numeric',
        x: 0,
        y: 2,
        recordId: 'start-edge',
        recordCount: 2,
        firstRecordAt: 0,
        lastRecordAt: 999,
      },
      {
        kind: 'numeric',
        x: 1000,
        y: 10,
        recordId: 'bucket1',
        recordCount: 1,
        firstRecordAt: 1000,
        lastRecordAt: 1000,
      },
    ]);
  });

  it('returns an empty series when there are no records', () => {
    const series = useCase.execute(
      [],
      numericMetric(),
      {start: new Date(0), end: new Date(1000)},
      {bucketSizeMs: 1000}
    );

    expect(series).toEqual([]);
  });

  it('returns an empty series when no records fall within the range', () => {
    const metric = numericMetric();
    const records = [
      record('before', new Date(-5000), metric.id, 1),
      record('after', new Date(9000), metric.id, 2),
    ];

    const series = useCase.execute(
      records,
      metric,
      {start: new Date(0), end: new Date(1000)},
      {bucketSizeMs: 1000}
    );

    expect(series).toEqual([]);
  });

  it('ignores records that carry no value for the metric', () => {
    const metric = numericMetric();
    const records = [
      record('has-value', new Date(100), metric.id, 42),
      new Record('no-value', 'obs1', new Date(200), new Map([['other-metric', 7]])),
    ];

    const series = useCase.execute(
      records,
      metric,
      {start: new Date(0), end: new Date(1000)},
      {bucketSizeMs: 1000}
    );

    expect(series).toEqual([
      {
        kind: 'numeric',
        x: 0,
        y: 42,
        recordId: 'has-value',
        recordCount: 1,
        firstRecordAt: 100,
        lastRecordAt: 100,
      },
    ]);
  });

  it.each(['Boolean', 'Text'] as const)(
    'throws for %s, whose reduction is not implemented yet',
    type => {
      const metric = new Metric('x1', 'Completed', type);
      const records = [
        new Record('r1', 'obs1', new Date(100), new Map([['x1', type === 'Boolean' ? true : 'done']])),
      ];

      expect(() =>
        useCase.execute(
          records,
          metric,
          {start: new Date(0), end: new Date(1000)},
          {bucketSizeMs: 1000}
        )
      ).toThrow(/not implemented/i);
    }
  );

  it('rejects a non-positive bucket size', () => {
    expect(() =>
      useCase.execute(
        [],
        numericMetric(),
        {start: new Date(0), end: new Date(1000)},
        {bucketSizeMs: 0}
      )
    ).toThrow(/positive/i);
  });
});

describe('GetMetricSeriesUseCase Enum reduction', () => {
  const useCase = new GetMetricSeriesUseCase();
  // Three values, declared low to high, since a lane's order is what the chart
  // paints its ramp along.
  const MOODS = ['low', 'ok', 'high'];
  const TIME_RANGE: TimeRange = {start: new Date(0), end: new Date(2000)};
  const ONE_BUCKET: AggregationStrategy = {bucketSizeMs: 1000};

  function enumMetric(allowedValues: string[] | null = MOODS): Metric {
    return new Metric('e1', 'Mood', 'Enum', allowedValues ? {allowedValues} : null);
  }

  /** Records inside the first bucket, one every 100ms, taking the given values in turn. */
  function moodRecords(...values: string[]) {
    return values.map((value, index) => record(`r${index}`, new Date(index * 100), 'e1', value));
  }

  function sharesOf(series: MetricSeriesPoint[]): CategoryShare[] {
    const [point] = series;
    expect(isCategoryPoint(point)).toBe(true);
    return (point as CategorySeriesPoint).shares;
  }

  /** What a point says about the Records behind it, whatever they reduced to. */
  function baseOf({x, recordId, recordCount, firstRecordAt, lastRecordAt}: MetricSeriesPoint) {
    return {x, recordId, recordCount, firstRecordAt, lastRecordAt};
  }

  it('reduces a bucket to one share per value its Records took, in declared order', () => {
    const series = useCase.execute(
      moodRecords('high', 'low', 'ok', 'low'),
      enumMetric(),
      TIME_RANGE,
      ONE_BUCKET
    );

    expect(series[0].kind).toBe('category');
    expect(sharesOf(series)).toEqual([
      {value: 'low', share: 0.5},
      {value: 'ok', share: 0.25},
      {value: 'high', share: 0.25},
    ]);
  });

  it('leaves out a value no Record in the bucket took', () => {
    const shares = sharesOf(
      useCase.execute(moodRecords('low', 'high'), enumMetric(), TIME_RANGE, ONE_BUCKET)
    );

    expect(shares.map(share => share.value)).toEqual(['low', 'high']);
    expect(shares.reduce((total, share) => total + share.share, 0)).toBe(1);
  });

  it('gives a unanimous bucket a single share of the whole', () => {
    expect(
      sharesOf(useCase.execute(moodRecords('ok', 'ok', 'ok'), enumMetric(), TIME_RANGE, ONE_BUCKET))
    ).toEqual([{value: 'ok', share: 1}]);
  });

  it('drops a Record whose value is not one the Metric allows, from the shares and the count', () => {
    const series = useCase.execute(
      moodRecords('low', 'elated', 'low'),
      enumMetric(),
      TIME_RANGE,
      ONE_BUCKET
    );

    expect(sharesOf(series)).toEqual([{value: 'low', share: 1}]);
    expect(series[0].recordCount).toBe(2);
  });

  it('charts nothing for a Metric carrying no allowed values', () => {
    expect(
      useCase.execute(moodRecords('low', 'ok'), enumMetric(null), TIME_RANGE, ONE_BUCKET)
    ).toEqual([]);
  });

  it('reports the same Records a Numeric Metric of the same Records would', () => {
    const at = [new Date(100), new Date(400), new Date(1200)];
    const enumRecords = at.map((timestamp, index) => record(`r${index}`, timestamp, 'e1', 'ok'));
    const numericRecords = at.map((timestamp, index) => record(`r${index}`, timestamp, 'm1', 7));

    const enumSeries = useCase.execute(enumRecords, enumMetric(), TIME_RANGE, ONE_BUCKET);
    const numericSeries = useCase.execute(numericRecords, numericMetric(), TIME_RANGE, ONE_BUCKET);

    expect(enumSeries.map(baseOf)).toEqual(numericSeries.map(baseOf));
  });
});
