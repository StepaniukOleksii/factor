import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {buildSeedData} from './devSeedData';
import {GetMetricSeriesUseCase, isCategoryPoint} from '../application/GetMetricSeriesUseCase';
import {
  getAggregationForPreset,
  getTimeRangeForPreset,
  TIME_RANGE_PRESETS,
  type TimeRangePreset,
} from '../presentation/charts/chartDefaults';
import {METRIC_DESCRIPTION_MAX_LENGTH, RECORD_NOTE_MAX_LENGTH} from '../domain/validationLimits';
import type {NumericConstraint} from '../domain/Metric';

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
    const {observation, records} = entry('mixed metrics');
    const hourly = observation.metrics.find(metric => metric.name === 'hourly')!;
    const clusterDay = new Date();
    clusterDay.setHours(0, 0, 0, 0);
    clusterDay.setDate(clusterDay.getDate() - 3);
    const nextDay = new Date(clusterDay);
    nextDay.setDate(nextDay.getDate() + 1);

    const points = getMetricSeries.execute(
      records,
      hourly,
      {start: clusterDay, end: nextDay},
      {bucketSizeMs: 60 * 60 * 1000},
    );

    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points.some(point => point.recordCount > 1)).toBe(true);
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
    const shareCounts = points.map(point => (isCategoryPoint(point) ? point.shares.length : 0));
    expect(Math.max(...shareCounts)).toBeGreaterThan(1);
  });

  it('draws category a mark per day-bucket at the shorter windows and two columns at 1Y', () => {
    expect(pointCount('mixed metrics', 'category', '1W')).toBe(4);
    expect(pointCount('mixed metrics', 'category', '1M')).toBe(10);
    expect(pointCount('mixed metrics', 'category', '1Y')).toBe(2);
  });

  // One Record per day-bucket, so every mark fills its lane - the other regime,
  // and the one the checklist reads the lane order and the ramp off.
  it.each([
    ['mixed metrics', 'category'],
    ['no numeric', 'mood'],
  ])('leaves every 1M bucket of %s\'s %s unanimous', (observationName, metricName) => {
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
      expect(isCategoryPoint(point) && point.shares).toEqual([
        {value: expect.any(String), share: 1},
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

  // `reseedDevData()` builds entities and calls the repository directly, so
  // CreateObservationUseCase never sees this data and nothing else enforces the
  // limit on it.
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

  // `reseedDevData()` builds entities and calls the repository directly, so
  // CreateObservationUseCase never sees this data - an incoherent range, which
  // makes `validateValue` reject every value, would reach the device unnoticed.
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
  // The seed reads the wall clock, and `hoursAgo(3)` lands on 09:00 - the hour
  // `daysAgo(0)` is pinned to - for the hour either side of midday, merging the
  // two noted Records into one. Pinning the clock keeps the count below
  // independent of when the suite runs.
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

  // Nothing else enforces the limit: the seed never runs a use case.
  it('keeps every seeded note within the length limit', () => {
    for (const note of seededNotes()) {
      expect(note.length, note).toBeLessThanOrEqual(RECORD_NOTE_MAX_LENGTH);
    }
  });
});
