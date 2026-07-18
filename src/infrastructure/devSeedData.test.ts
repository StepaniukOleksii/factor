import {describe, expect, it, vi} from 'vitest';
import {buildSeedData} from './devSeedData';
import {GetMetricSeriesUseCase} from '../application/GetMetricSeriesUseCase';
import {
  getAggregationForPreset,
  getTimeRangeForPreset,
  TIME_RANGE_PRESETS,
  type TimeRangePreset,
} from '../presentation/charts/chartDefaults';

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
  // The details screen needs two aggregated points to draw a line rather than the
  // "not enough data yet" placeholder. Manual verification of the time range
  // selector depends on some metric clearing that bar at every preset - otherwise
  // a preset can only ever be eyeballed in its empty state.
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

  it('fills the 30-day-bucketed 1Y window from the yearly Metric', () => {
    expect(pointCount('mixed metrics', 'yearly', '1Y')).toBeGreaterThanOrEqual(10);
  });

  it('keeps the dense Metric populated at the day-bucketed presets', () => {
    expect(pointCount('mixed metrics', 'dense', '1W')).toBeGreaterThanOrEqual(7);
    expect(pointCount('mixed metrics', 'dense', '1M')).toBeGreaterThanOrEqual(30);
  });

  it('leaves the dense Metric short of a chart at 1D, where it records once a day', () => {
    expect(pointCount('mixed metrics', 'dense', '1D')).toBeLessThan(2);
  });

  it('never charts the insufficient Metric, at any preset', () => {
    for (const preset of PRESETS) {
      expect(pointCount('mixed metrics', 'insufficient', preset)).toBeLessThan(2);
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
