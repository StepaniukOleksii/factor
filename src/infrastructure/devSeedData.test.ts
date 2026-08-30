import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {buildSeedData} from './devSeedData';
import {
  type AggregationStrategy,
  GetMetricSeriesUseCase,
  isCategoryPoint,
  isNumericPoint,
  type MetricSeriesPoint,
  type TimeRange,
} from '../application/GetMetricSeriesUseCase';
import {
  getAggregationForCustomRange,
  getAggregationForPreset,
  getDayAlignedRange,
  getTimeRangeForPreset,
  TIME_RANGE_PRESETS,
  type TimeRangePreset,
} from '../presentation/charts/chartDefaults';
import {
  METRIC_DESCRIPTION_MAX_LENGTH,
  METRIC_ENUM_VALUE_MAX_LENGTH,
  METRIC_NAME_MAX_LENGTH,
  OBSERVATION_DESCRIPTION_MAX_LENGTH,
  OBSERVATION_NAME_MAX_LENGTH,
  RECORD_NOTE_MAX_LENGTH,
} from '../domain/validationLimits';
import type {EnumConstraint, NumericConstraint} from '../domain/Metric';

vi.mock('expo-crypto', () => {
  let counter = 0;
  return {randomUUID: () => `seed-uuid-${counter++}`};
});

const PRESETS = Object.keys(TIME_RANGE_PRESETS) as TimeRangePreset[];
const getMetricSeries = new GetMetricSeriesUseCase();

function entry(name: string) {
  const found = buildSeedData().find(e => e.observation.name === name);
  expect(found, `no seeded observation named "${name}"`).toBeDefined();
  return found!;
}

/** Points the details screen would chart for a metric at a given preset. */
function pointCount(observationName: string, metricName: string, preset: TimeRangePreset): number {
  const {observation, records} = entry(observationName);
  const metric = observation.metrics.find(m => m.name === metricName);
  expect(metric, `no metric named "${metricName}" on "${observationName}"`).toBeDefined();
  return getMetricSeries.execute(
    records,
    metric!,
    getTimeRangeForPreset(preset),
    getAggregationForPreset(preset),
  ).length;
}

/** The hour-bucketed points a chart zoomed onto `hourly`'s cluster day draws. */
function clusterDayPoints(): MetricSeriesPoint[] {
  const {observation, records} = entry('mixed metrics');
  const hourly = observation.metrics.find(metric => metric.name === 'hourly')!;
  const clusterDay = new Date();
  clusterDay.setHours(0, 0, 0, 0);
  clusterDay.setDate(clusterDay.getDate() - 3);
  const nextDay = new Date(clusterDay);
  nextDay.setDate(nextDay.getDate() + 1);

  return getMetricSeries.execute(records, hourly, {start: clusterDay, end: nextDay}, {bucketSizeMs: 60 * 60 * 1000});
}

describe('seeded chart coverage', () => {
  // The details screen needs two aggregated points to draw a line rather than a
  // lone dot. Manual verification of the time range selector depends on some
  // metric clearing that bar at every preset - otherwise a preset can only ever
  // be eyeballed on a chart with nothing joined up.
  it.each(PRESETS)('gives %s at least one chartable Metric', preset => {
    const {observation, records} = entry('mixed metrics');
    const chartable = observation.metrics
      .filter(metric => metric.type === 'Numeric')
      .filter(
        metric =>
          getMetricSeries.execute(
            records,
            metric,
            getTimeRangeForPreset(preset),
            getAggregationForPreset(preset),
          ).length >= 2,
      );

    expect(chartable.length).toBeGreaterThan(0);
  });

  it('fills the hour-bucketed 1D window from the hourly Metric', () => {
    expect(pointCount('mixed metrics', 'hourly', '1D')).toBeGreaterThanOrEqual(7);
  });

  // Zoom narrows onto the days a tapped point's Records fall on, so it comes to
  // rest on a single day - bucketed by the hour, the finest a day-wide window
  // gets. Reaching that resting point by hand needs a day holding both an hour
  // with several Records and something else to draw alongside it, which no
  // metric offered until `hourly` gained its cluster.
  it('gives a zoomed-in day an hour holding several Records, and a second point beside it', () => {
    const points = clusterDayPoints();

    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points.some(point => point.recordCount > 1)).toBe(true);
  });

  it('declares four values on category, the only four-lane swimlane in the dataset', () => {
    const {observation} = entry('mixed metrics');
    const category = observation.metrics.find(metric => metric.name === 'category');

    expect((category!.constraint as EnumConstraint).allowedValues).toEqual(['a', 'b', 'c', 'd']);
  });

  // A swimlane's mixed regime - a bucket several values deep, each a fraction of
  // its lane - is what the manual checklist eyeballs at 1Y, and neither Enum
  // fixture can be stretched to a year of such buckets: `mood`'s Record count is
  // load-bearing for the deletion flow and `category`'s Records are shared with
  // `flag` and `note`. Both do fold their whole run of daily buckets into a
  // couple of 30-day ones, which is where that regime is reachable.
  it.each([
    ['mixed metrics', 'category'],
    ['no numeric', 'mood'],
  ])('folds %s\'s %s into 1Y buckets several Records deep, one of them mixed', (observationName, metricName) => {
    const {observation, records} = entry(observationName);
    const metric = observation.metrics.find(candidate => candidate.name === metricName)!;

    const points = getMetricSeries.execute(
      records,
      metric,
      getTimeRangeForPreset('1Y'),
      getAggregationForPreset('1Y'),
    );

    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBeLessThan(pointCount(observationName, metricName, '1M'));
    for (const point of points) {
      expect(point.recordCount).toBeGreaterThan(1);
    }
    // Which values a bucket draws is the fixture's own business; that some
    // bucket draws more than one is what the checklist reads off the screen.
    const valuesPerBucket = points.map(point => (isCategoryPoint(point) ? point.counts.length : 0));
    expect(Math.max(...valuesPerBucket)).toBeGreaterThan(1);
  });

  // A bucket holding both answers is the only place a Boolean swimlane draws two
  // marks at once, which is what the manual checklist reads its heights off. Not
  // that the two counts differ: which answer each Record carries comes from the
  // seeded RNG, so an assertion on that would turn on the order the fixture
  // happens to be built in.
  it.each([
    ['mixed metrics', 'flag'],
    ['no numeric', 'done'],
  ])('gives %s\'s %s a 1Y bucket holding both answers', (observationName, metricName) => {
    const {observation, records} = entry(observationName);
    const metric = observation.metrics.find(candidate => candidate.name === metricName)!;

    const points = getMetricSeries.execute(
      records,
      metric,
      getTimeRangeForPreset('1Y'),
      getAggregationForPreset('1Y'),
    );

    expect(
      points.some(point => isCategoryPoint(point) && point.counts.length === 2),
    ).toBe(true);
  });

  // `flag` and `note` write to `category`'s own Records, so all three cards carry
  // the same bucket counts at every preset - the rows testing-data.md states,
  // and what makes the counts above `note`'s two 1Y marks readable off a screen.
  it.each(['category', 'flag', 'note'])(
    'draws %s a mark per day-bucket at the shorter windows and two columns at 1Y',
    metricName => {
      expect(pointCount('mixed metrics', metricName, '1W')).toBe(4);
      expect(pointCount('mixed metrics', metricName, '1M')).toBe(10);
      expect(pointCount('mixed metrics', metricName, '1Y')).toBe(2);
    },
  );

  // One Record per day-bucket, so every count is 1 and every mark fills its lane
  // - the other regime, and the one the checklist reads the lane order and the
  // ramp off.
  it.each([
    ['mixed metrics', 'category'],
    ['no numeric', 'mood'],
  ])('leaves every 1M bucket of %s\'s %s a single Record of one value', (observationName, metricName) => {
    const {observation, records} = entry(observationName);
    const metric = observation.metrics.find(candidate => candidate.name === metricName)!;

    const points = getMetricSeries.execute(
      records,
      metric,
      getTimeRangeForPreset('1M'),
      getAggregationForPreset('1M'),
    );

    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(isCategoryPoint(point) && point.counts).toEqual([
        {value: expect.any(String), count: 1},
      ]);
    }
  });

  it('fills the 30-day-bucketed 1Y window from the yearly Metric', () => {
    expect(pointCount('mixed metrics', 'yearly', '1Y')).toBeGreaterThanOrEqual(10);
  });

  it('keeps the dense Metric populated at the day-bucketed presets', () => {
    expect(pointCount('mixed metrics', 'dense', '1W')).toBeGreaterThanOrEqual(7);
    expect(pointCount('mixed metrics', 'dense', '1M')).toBeGreaterThanOrEqual(30);
  });

  it('leaves the dense Metric a single point at 1D, where it records once a day', () => {
    expect(pointCount('mixed metrics', 'dense', '1D')).toBe(1);
  });

  // The insufficient Metric is what the placeholder-vs-dot boundary is eyeballed
  // on: its one Record, five days old, falls outside the shortest window and
  // inside every wider one, so the same Metric shows nothing at 1D and a single
  // dot everywhere else.
  it('puts the insufficient Metric on both sides of the placeholder-vs-dot boundary', () => {
    expect(pointCount('mixed metrics', 'insufficient', '1D')).toBe(0);
    for (const preset of PRESETS.filter(preset => preset !== '1D')) {
      expect(pointCount('mixed metrics', 'insufficient', preset)).toBe(1);
    }
  });
});

// Every assertion above reads the wall clock, so one that holds only at certain
// hours still passes whenever the suite happens to run at another. The seed's
// anchor hour is that kind of hinge - 09:00 for most of the day, the current hour
// before nine - and only a run before nine reaches the second case. These pin the
// clock either side of it and read the same shape off both.
describe('seeded anchor hour', () => {
  const HOURS: [string, Date][] = [
    ['before nine', new Date(2026, 7, 4, 3, 20)],
    ['past nine', new Date(2026, 7, 4, 14, 20)],
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(HOURS)('timestamps no Record in the future seeded at %s', (_hour, now) => {
    vi.setSystemTime(now);

    for (const {observation, records} of buildSeedData()) {
      expect(
        records.every(record => record.timestamp.getTime() <= now.getTime()),
        observation.name,
      ).toBe(true);
    }
  });

  // The counts the shared Metrics assert above, which turn on today's Record
  // being inside every window - the first thing an anchor past the current hour
  // would cost.
  it.each(HOURS)('buckets the shared Metrics the same way seeded at %s', (_hour, now) => {
    vi.setSystemTime(now);

    for (const metricName of ['category', 'flag', 'note']) {
      expect(pointCount('mixed metrics', metricName, '1D'), metricName).toBe(1);
      expect(pointCount('mixed metrics', metricName, '1W'), metricName).toBe(4);
      expect(pointCount('mixed metrics', metricName, '1M'), metricName).toBe(10);
      expect(pointCount('mixed metrics', metricName, '1Y'), metricName).toBe(2);
    }
  });

  // `hourly`'s cluster is placed as an offset from the anchor rather than at a
  // clock time, which is what keeps its pair inside one hour wherever the anchor
  // lands - and the extra Records on their own day, where the counts above
  // already account for them.
  it.each(HOURS)('keeps the cluster day an hour deep, seeded at %s', (_hour, now) => {
    vi.setSystemTime(now);

    const points = clusterDayPoints();

    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points.some(point => point.recordCount > 1)).toBe(true);
  });
});

// `stale records` is the one fixture a chart tap can descend twice, and each rung
// holds only while two properties of the data do. A tap lands on the canvas centre,
// which the chart resolves to the point nearest it horizontally and then drops
// unless that point is near the middle of the plot vertically - so the rung that
// zooms has to be both the nearest point to ~45% across the window and a mid-range
// one, and it has to stand for more than one Record or it opens that Record
// instead. These walk the same computation the details screen does.
describe('seeded zoom ladder', () => {
  /** Where a centre tap lands, as a fraction across the window. */
  const TAP_FRACTION = 0.45;

  function ladderPoints(range: TimeRange, aggregation: AggregationStrategy): MetricSeriesPoint[] {
    const {observation, records} = entry('stale records');
    const metric = observation.metrics.find(candidate => candidate.name === 'value')!;
    return getMetricSeries.execute(records, metric, range, aggregation);
  }

  /** The window and resolution a tap on `point` moves the section to. */
  function zoomedInto(point: MetricSeriesPoint) {
    const range = getDayAlignedRange(new Date(point.firstRecordAt), new Date(point.lastRecordAt));
    return {range, aggregation: getAggregationForCustomRange(range)};
  }

  function topPoints(): MetricSeriesPoint[] {
    return ladderPoints(getTimeRangeForPreset('1Y'), getAggregationForPreset('1Y'));
  }

  function firstZoomPoints(): MetricSeriesPoint[] {
    const {range, aggregation} = zoomedInto(topPoints()[0]);
    return ladderPoints(range, aggregation);
  }

  function nearestToTap(points: MetricSeriesPoint[], range: TimeRange): MetricSeriesPoint {
    const startMs = range.start.getTime();
    const spanMs = range.end.getTime() - startMs;
    const tapMs = startMs + TAP_FRACTION * spanMs;
    return points.reduce((nearest, point) =>
      Math.abs(point.x - tapMs) < Math.abs(nearest.x - tapMs) ? point : nearest);
  }

  it('folds every Record into a single 1Y point', () => {
    const points = topPoints();

    expect(points).toHaveLength(1);
    expect(points[0].recordCount).toBe(entry('stale records').records.length);
  });

  it('opens three points on the first zoom, only the middle one folding a pair', () => {
    expect(firstZoomPoints().map(point => point.recordCount)).toEqual([1, 2, 1]);
  });

  it('puts that pair where a centre tap resolves, and between the other two by value', () => {
    const {range, aggregation} = zoomedInto(topPoints()[0]);
    const points = ladderPoints(range, aggregation);
    const [low, middle, high] = points.filter(isNumericPoint);

    expect(nearestToTap(points, range)).toBe(points[1]);
    expect(middle.y).toBeGreaterThan(Math.min(low.y, high.y));
    expect(middle.y).toBeLessThan(Math.max(low.y, high.y));
  });

  it('draws the second zoom as one point standing for the pair', () => {
    const {range, aggregation} = zoomedInto(firstZoomPoints()[1]);
    const points = ladderPoints(range, aggregation);

    expect(points).toHaveLength(1);
    expect(points[0].recordCount).toBe(2);
  });

  it('cannot narrow past that day, so a third tap has nowhere to go', () => {
    const day = zoomedInto(firstZoomPoints()[1]).range;
    const again = zoomedInto(ladderPoints(day, getAggregationForCustomRange(day))[0]).range;

    expect(again).toEqual(day);
  });
});

describe('seeded observation-level scenarios', () => {
  it('gives the no-numeric case an Observation with no Numeric Metrics and some Records', () => {
    const {observation, records} = entry('no numeric');

    expect(observation.metrics.some(metric => metric.type === 'Numeric')).toBe(false);
    expect(observation.metrics.length).toBeGreaterThan(0);
    expect(records.length).toBeGreaterThan(0);
  });

  it('keeps every stale Record outside the 30-day window', () => {
    const {records} = entry('stale records');
    const thirtyDaysAgo = getTimeRangeForPreset('1M').start.getTime();

    expect(records.length).toBeGreaterThan(0);
    expect(records.every(record => record.timestamp.getTime() < thirtyDaysAgo)).toBe(true);
  });

  it('leaves the no-records case empty', () => {
    expect(entry('no records').records.length).toBe(0);
  });

  it('never timestamps a Record in the future', () => {
    const now = Date.now();
    for (const {records} of buildSeedData()) {
      expect(records.every(record => record.timestamp.getTime() <= now)).toBe(true);
    }
  });
});

// `reseedDevData()` builds entities and calls the repository directly, so no use
// case ever judges this data and the columns carry no length constraint. A
// fixture past a limit reaches the edit forms as a field that opens over its
// counter and cannot be saved until it is cut by hand.
describe('seeded lengths', () => {
  it('keeps every Observation name within its limit', () => {
    for (const {observation} of buildSeedData()) {
      expect(observation.name.length, observation.name)
        .toBeLessThanOrEqual(OBSERVATION_NAME_MAX_LENGTH);
    }
  });

  it('keeps every Observation description within its limit', () => {
    for (const {observation} of buildSeedData()) {
      expect(observation.description?.length ?? 0, observation.name)
        .toBeLessThanOrEqual(OBSERVATION_DESCRIPTION_MAX_LENGTH);
    }
  });

  it('keeps every Metric name within its limit', () => {
    for (const {observation} of buildSeedData()) {
      for (const metric of observation.metrics) {
        expect(metric.name.length, `"${metric.name}" on "${observation.name}"`)
          .toBeLessThanOrEqual(METRIC_NAME_MAX_LENGTH);
      }
    }
  });

  it('keeps every Choice value within its limit', () => {
    for (const {observation} of buildSeedData()) {
      for (const metric of observation.metrics) {
        for (const value of (metric.constraint as EnumConstraint | null)?.allowedValues ?? []) {
          expect(value.length, `"${value}" on "${metric.name}"`)
            .toBeLessThanOrEqual(METRIC_ENUM_VALUE_MAX_LENGTH);
        }
      }
    }
  });
});

// The details screen reads each Observation's creation date, and the list orders
// by it - so the fixtures state their own rather than taking the moment they were
// built, which four Observations built in one pass would share.
describe('seeded creation dates', () => {
  it('gives every Observation a distinct one', () => {
    const created = buildSeedData().map(({observation}) => observation.createdAt.getTime());

    expect(new Set(created).size).toBe(created.length);
  });

  it('creates each one before its own oldest Record', () => {
    for (const {observation, records} of buildSeedData()) {
      for (const record of records) {
        expect(
          observation.createdAt.getTime(),
          `a Record of "${observation.name}"`,
        ).toBeLessThan(record.timestamp.getTime());
      }
    }
  });

  it('puts the four in the newest-created order the list shows them in', () => {
    const byNewest = buildSeedData()
      .sort((a, b) => b.observation.createdAt.getTime() - a.observation.createdAt.getTime())
      .map(({observation}) => observation.name);

    expect(byNewest).toEqual(['no records', 'no numeric', 'stale records', 'mixed metrics']);
  });
});

// One Record form has to carry every state of the Metric-description info button
// at once, which only holds while exactly these Metrics are described and the
// rest aren't - the claim testing-data.md makes.
describe('seeded Metric descriptions', () => {
  const DESCRIBED = ['dense', 'hourly', 'yearly', 'flag'];

  it('describes exactly the four intended Metrics of mixed metrics', () => {
    const {observation} = entry('mixed metrics');

    const described = observation.metrics
      .filter(metric => metric.description !== null)
      .map(metric => metric.name);

    expect(described.sort()).toEqual([...DESCRIBED].sort());
  });

  it('leaves every other seeded Metric undescribed', () => {
    for (const {observation} of buildSeedData()) {
      for (const metric of observation.metrics) {
        if (observation.name === 'mixed metrics' && DESCRIBED.includes(metric.name)) continue;
        expect(metric.description, `"${metric.name}" on "${observation.name}"`).toBeNull();
      }
    }
  });

  it('gives the multi-line one line breaks for the dialog to preserve', () => {
    const {observation} = entry('mixed metrics');
    const hourly = observation.metrics.find(metric => metric.name === 'hourly')!;

    expect(hourly.description).toContain('\n');
  });

  it('keeps every seeded description within the length limit', () => {
    for (const {observation} of buildSeedData()) {
      for (const metric of observation.metrics) {
        expect(
          metric.description?.length ?? 0,
          `"${metric.name}" on "${observation.name}"`,
        ).toBeLessThanOrEqual(METRIC_DESCRIPTION_MAX_LENGTH);
      }
    }
  });
});

// One Record form has to carry every shape a Numeric bound comes in, so the
// placeholders and the refusal messages can all be eyeballed at once - the claim
// testing-data.md makes.
describe('seeded Metric bounds', () => {
  const BOUNDS: [string, NumericConstraint | null][] = [
    ['dense', {min: 0, max: 100}],
    ['yearly', {min: 0}],
    ['insufficient', {max: 100}],
    ['sparse', null],
  ];

  it.each(BOUNDS)('bounds %s as intended', (name, constraint) => {
    const {observation} = entry('mixed metrics');
    const metric = observation.metrics.find(candidate => candidate.name === name);

    expect(metric!.constraint).toEqual(constraint);
  });

  // An incoherent range, which makes `validateValue` reject every value, would
  // reach the device unnoticed.
  it('keeps every seeded range coherent', () => {
    for (const {observation} of buildSeedData()) {
      for (const metric of observation.metrics) {
        if (metric.type !== 'Numeric' || !metric.constraint) continue;
        const {min, max} = metric.constraint as NumericConstraint;
        if (min === undefined || max === undefined) continue;
        expect(min, `"${metric.name}" on "${observation.name}"`).toBeLessThanOrEqual(max);
      }
    }
  });
});

// The details screen's noted-and-un-noted states are eyeballed on these two
// Records alone - the claim testing-data.md makes.
describe('seeded Record notes', () => {
  // The seed reads the wall clock, and `hoursAgo(3)` lands on 09:00 - the anchor
  // hour `daysAgo(0)` sits at past nine - for the hour either side of midday,
  // merging the two noted Records into one. Pinning the clock keeps the count
  // below independent of when the suite runs.
  const NOW = new Date(2026, 7, 4, 14, 20);
  const SHARED_RECORD_AT = new Date(2026, 7, 4, 9, 0);

  function seededNotes(): string[] {
    return buildSeedData()
      .flatMap(({records}) => records)
      .map(record => record.note)
      .filter((note): note is string => note !== null);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('notes exactly two Records of mixed metrics: the newest, and today\'s shared one', () => {
    const {records} = entry('mixed metrics');

    const noted = records.filter(record => record.note !== null);

    expect(noted).toHaveLength(2);
    // Records come back newest first, and the sub-day one is the newest of all.
    expect(noted[0]).toBe(records[0]);
    expect(noted[1].timestamp).toEqual(SHARED_RECORD_AT);
  });

  it('leaves every Record of every other Observation without one', () => {
    for (const {observation, records} of buildSeedData()) {
      if (observation.name === 'mixed metrics') continue;
      for (const record of records) {
        expect(record.note, `a Record of "${observation.name}"`).toBeNull();
      }
    }
  });

  it('gives the longer note a line break for the details screen to preserve', () => {
    const [longest] = seededNotes().sort((a, b) => b.length - a.length);

    expect(longest).toContain('\n');
  });

  it('keeps every seeded note within the length limit', () => {
    for (const note of seededNotes()) {
      expect(note.length, note).toBeLessThanOrEqual(RECORD_NOTE_MAX_LENGTH);
    }
  });
});
