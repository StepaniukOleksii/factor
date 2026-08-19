import {describe, expect, it} from 'vitest';
import {
    AggregationStrategy,
    type CategoryCount,
    type CategorySeriesPoint,
    GetMetricSeriesUseCase,
    isCategoryPoint,
    isMarkerPoint,
    isNumericPoint,
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

function countsOf(series: MetricSeriesPoint[]): CategoryCount[] {
  const [point] = series;
  expect(isCategoryPoint(point)).toBe(true);
  return (point as CategorySeriesPoint).counts;
}

/** What a point says about the Records behind it, whatever they reduced to. */
function baseOf({x, recordId, recordCount, firstRecordAt, lastRecordAt}: MetricSeriesPoint) {
  return {x, recordId, recordCount, firstRecordAt, lastRecordAt};
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
  // Three values, so a bucket can hold a mixture and the declared order is
  // something the result can be read against.
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

  it('counts a bucket by value, in declared order', () => {
    const series = useCase.execute(
      moodRecords('high', 'low', 'ok', 'low'),
      enumMetric(),
      TIME_RANGE,
      ONE_BUCKET
    );

    expect(series[0].kind).toBe('category');
    expect(countsOf(series)).toEqual([
      {value: 'low', count: 2},
      {value: 'ok', count: 1},
      {value: 'high', count: 1},
    ]);
  });

  it('leaves out a value no Record in the bucket took', () => {
    const series = useCase.execute(
      moodRecords('low', 'high'),
      enumMetric(),
      TIME_RANGE,
      ONE_BUCKET
    );
    const counts = countsOf(series);

    expect(counts.map(({value}) => value)).toEqual(['low', 'high']);
    expect(counts.reduce((total, {count}) => total + count, 0)).toBe(series[0].recordCount);
  });

  it('gives a unanimous bucket a single count of every Record in it', () => {
    expect(
      countsOf(useCase.execute(moodRecords('ok', 'ok', 'ok'), enumMetric(), TIME_RANGE, ONE_BUCKET))
    ).toEqual([{value: 'ok', count: 3}]);
  });

  it('drops a Record whose value is not one the Metric allows, from the counts and the count', () => {
    const series = useCase.execute(
      moodRecords('low', 'elated', 'low'),
      enumMetric(),
      TIME_RANGE,
      ONE_BUCKET
    );

    expect(countsOf(series)).toEqual([{value: 'low', count: 2}]);
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

describe('GetMetricSeriesUseCase Boolean reduction', () => {
  const useCase = new GetMetricSeriesUseCase();
  const TIME_RANGE: TimeRange = {start: new Date(0), end: new Date(2000)};
  const ONE_BUCKET: AggregationStrategy = {bucketSizeMs: 1000};

  function booleanMetric(): Metric {
    return new Metric('b1', 'Completed', 'Boolean');
  }

  /** Records inside the first bucket, one every 100ms, giving the answers in turn. */
  function answers(...values: unknown[]) {
    return values.map((value, index) => record(`r${index}`, new Date(index * 100), 'b1', value));
  }

  it('counts a bucket by answer, keyed by the value rather than the word for it', () => {
    const series = useCase.execute(answers(false, true, false), booleanMetric(), TIME_RANGE, ONE_BUCKET);

    expect(series[0].kind).toBe('category');
    // `true` first however the Records fell, which is the order the Record form
    // offers the two answers in.
    expect(countsOf(series)).toEqual([
      {value: 'true', count: 1},
      {value: 'false', count: 2},
    ]);
  });

  it('leaves out an answer no Record in the bucket gave', () => {
    const series = useCase.execute(answers(false, false), booleanMetric(), TIME_RANGE, ONE_BUCKET);
    const counts = countsOf(series);

    expect(counts).toEqual([{value: 'false', count: 2}]);
    expect(counts.reduce((total, {count}) => total + count, 0)).toBe(series[0].recordCount);
  });

  it('gives a unanimous bucket a single count of every Record in it', () => {
    expect(
      countsOf(useCase.execute(answers(true, true, true), booleanMetric(), TIME_RANGE, ONE_BUCKET))
    ).toEqual([{value: 'true', count: 3}]);
  });

  // Unreachable through the domain, which refuses to store it - but the string
  // would otherwise be counted as the answer `true` once the counts are keyed by
  // canonical string form.
  it('drops a Record whose stored value is not a boolean, from the counts and the count', () => {
    const series = useCase.execute(answers(true, 'true', 1), booleanMetric(), TIME_RANGE, ONE_BUCKET);

    expect(countsOf(series)).toEqual([{value: 'true', count: 1}]);
    expect(series[0].recordCount).toBe(1);
  });

  it('reports the same Records a Numeric Metric of the same Records would', () => {
    const at = [new Date(100), new Date(400), new Date(1200)];
    const booleanRecords = at.map((timestamp, index) => record(`r${index}`, timestamp, 'b1', true));
    const numericRecords = at.map((timestamp, index) => record(`r${index}`, timestamp, 'm1', 7));

    const booleanSeries = useCase.execute(booleanRecords, booleanMetric(), TIME_RANGE, ONE_BUCKET);
    const numericSeries = useCase.execute(numericRecords, numericMetric(), TIME_RANGE, ONE_BUCKET);

    expect(booleanSeries.map(baseOf)).toEqual(numericSeries.map(baseOf));
  });
});

describe('GetMetricSeriesUseCase Text reduction', () => {
  const useCase = new GetMetricSeriesUseCase();
  const TIME_RANGE: TimeRange = {start: new Date(0), end: new Date(2000)};
  const ONE_BUCKET: AggregationStrategy = {bucketSizeMs: 1000};

  function textMetric(): Metric {
    return new Metric('t1', 'Notes', 'Text');
  }

  function textRecords(...values: unknown[]): Record[] {
    return values.map((value, index) => record(`r${index}`, new Date(index * 100), 't1', value));
  }

  it('reduces a bucket holding text to a marker carrying nothing beside its kind', () => {
    const series = useCase.execute(textRecords('slept badly'), textMetric(), TIME_RANGE, ONE_BUCKET);

    expect(series).toEqual([
      {
        kind: 'marker',
        x: 0,
        recordId: 'r0',
        recordCount: 1,
        firstRecordAt: 0,
        lastRecordAt: 0,
      },
    ]);
  });

  it('folds a bucket of several Records into one marker counting them all', () => {
    const [point] = useCase.execute(
      textRecords('one', 'two', 'three'),
      textMetric(),
      TIME_RANGE,
      ONE_BUCKET,
    );

    expect(point.recordCount).toBe(3);
    expect(point.recordId).toBe('r0');
    expect(point.firstRecordAt).toBe(0);
    expect(point.lastRecordAt).toBe(200);
  });

  it('buckets as the other types do, one marker per bucket holding text', () => {
    const records = [
      record('r0', new Date(100), 't1', 'first'),
      record('r1', new Date(1400), 't1', 'second'),
      record('r2', new Date(1600), 't1', 'third'),
    ];

    const series = useCase.execute(records, textMetric(), TIME_RANGE, ONE_BUCKET);

    expect(series.map(point => [point.x, point.recordCount])).toEqual([[0, 1], [1000, 2]]);
  });

  it('drops a whitespace-only value and a non-string one', () => {
    const series = useCase.execute(textRecords('  \n ', 42), textMetric(), TIME_RANGE, ONE_BUCKET);

    expect(series).toEqual([]);
  });

  it('keeps a value with whitespace around it', () => {
    const series = useCase.execute(textRecords('  noted  '), textMetric(), TIME_RANGE, ONE_BUCKET);

    expect(series).toHaveLength(1);
  });

  it('reports the same Records a Numeric Metric of the same Records would', () => {
    const at = [new Date(100), new Date(400), new Date(1200)];
    const noted = at.map((timestamp, index) => record(`r${index}`, timestamp, 't1', 'noted'));
    const numeric = at.map((timestamp, index) => record(`r${index}`, timestamp, 'm1', 7));

    const textSeries = useCase.execute(noted, textMetric(), TIME_RANGE, ONE_BUCKET);
    const numericSeries = useCase.execute(numeric, numericMetric(), TIME_RANGE, ONE_BUCKET);

    expect(textSeries.map(baseOf)).toEqual(numericSeries.map(baseOf));
  });
});

describe('isMarkerPoint', () => {
  const base = {x: 0, recordId: 'r0', recordCount: 1, firstRecordAt: 0, lastRecordAt: 0};

  it('narrows a marker point', () => {
    const point: MetricSeriesPoint = {...base, kind: 'marker'};

    expect(isMarkerPoint(point)).toBe(true);
  });

  it.each<MetricSeriesPoint>([
    {...base, kind: 'numeric', y: 4},
    {...base, kind: 'category', counts: [{value: 'ok', count: 1}]},
  ])('rejects a $kind point', point => {
    expect(isMarkerPoint(point)).toBe(false);
  });

  // The three guards partition the union, so a marker is not mistaken for either
  // of the kinds a renderer already narrows for.
  it('is rejected by the numeric and category guards', () => {
    const point: MetricSeriesPoint = {...base, kind: 'marker'};

    expect(isNumericPoint(point)).toBe(false);
    expect(isCategoryPoint(point)).toBe(false);
  });
});
