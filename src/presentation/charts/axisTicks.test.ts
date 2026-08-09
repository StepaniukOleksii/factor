import {describe, expect, it} from 'vitest';
import {
  chooseValueUnit,
  formatAxisTimeLabel,
  formatAxisValueLabel,
  getTimeAxisTicks,
  getTimeAxisTier,
  getValueAxisTicks,
  PLAIN_UNIT,
} from './axisTicks';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A window of `spanMs` starting at a fixed Monday midnight, so labels are stable. */
function rangeOf(spanMs: number, start = new Date(2026, 6, 13)): TimeRange {
  return {start, end: new Date(start.getTime() + spanMs)};
}

describe('getTimeAxisTier', () => {
  it.each([
    ['just inside the one-day boundary', DAY_MS - MINUTE_MS, 'hour'],
    ['exactly one day', DAY_MS, 'hour'],
    ['just outside the one-day boundary', DAY_MS + MINUTE_MS, 'week'],
    ['just inside the one-week boundary', 7 * DAY_MS - MINUTE_MS, 'week'],
    ['exactly one week', 7 * DAY_MS, 'week'],
    ['just outside the one-week boundary', 7 * DAY_MS + MINUTE_MS, 'month'],
    ['just inside the two-month boundary', 60 * DAY_MS, 'month'],
    ['just outside the two-month boundary', 70 * DAY_MS, 'year'],
    ['a full year', 365 * DAY_MS, 'year'],
  ])('reads %s as the %s tier', (_description, spanMs, expectedTier) => {
    expect(getTimeAxisTier(spanMs)).toBe(expectedTier);
  });
});

describe('getTimeAxisTicks', () => {
  it('divides an hour-tier range into eight centred slices', () => {
    const ticks = getTimeAxisTicks(rangeOf(DAY_MS));

    expect(ticks).toHaveLength(8);
    // Centred within each eighth of the day, so the row reads as eight evenly
    // weighted captions rather than eight boundary markers.
    expect(ticks.map(tick => tick.ratio)).toEqual([
      1 / 16,
      3 / 16,
      5 / 16,
      7 / 16,
      9 / 16,
      11 / 16,
      13 / 16,
      15 / 16,
    ]);
  });

  it('never places an hour-tier tick on either edge of the plot', () => {
    const ratios = getTimeAxisTicks(rangeOf(DAY_MS)).map(tick => tick.ratio);

    expect(Math.min(...ratios)).toBeGreaterThan(0);
    expect(Math.max(...ratios)).toBeLessThan(1);
  });

  it('labels an hour-tier range with bare hours of the day', () => {
    // Slice centres land 1.5h, 4.5h, 7.5h … after a midnight start.
    expect(getTimeAxisTicks(rangeOf(DAY_MS)).map(tick => tick.label)).toEqual([
      '1',
      '4',
      '7',
      '10',
      '13',
      '16',
      '19',
      '22',
    ]);
  });

  it('gives a week-tier range one centred tick per calendar day', () => {
    const ticks = getTimeAxisTicks(rangeOf(7 * DAY_MS));

    expect(ticks).toHaveLength(7);
    expect(ticks.map(tick => tick.ratio)).toEqual([
      1 / 14,
      3 / 14,
      5 / 14,
      7 / 14,
      9 / 14,
      11 / 14,
      13 / 14,
    ]);
    // A Monday-anchored week, one uppercase weekday initial per day.
    expect(ticks.map(tick => tick.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('scales a short week-tier range to the days it actually covers', () => {
    const ticks = getTimeAxisTicks(rangeOf(3 * DAY_MS));

    // Three days means three labels, not a week's worth padded out to seven.
    expect(ticks).toHaveLength(3);
    expect(ticks.map(tick => tick.ratio)).toEqual([1 / 6, 3 / 6, 5 / 6]);
    expect(ticks.map(tick => tick.label)).toEqual(['M', 'T', 'W']);
  });

  it.each([
    ['month', 45 * DAY_MS],
    ['year', 321 * DAY_MS],
  ])('spans a %s-tier range with five endpoint ticks', (_tier, spanMs) => {
    const ticks = getTimeAxisTicks(rangeOf(spanMs));

    expect(ticks).toHaveLength(5);
    expect(ticks.map(tick => tick.ratio)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('labels a month-tier range with short dates', () => {
    const labels = getTimeAxisTicks(rangeOf(40 * DAY_MS)).map(tick => tick.label);

    // The first and last ticks name the range's own endpoints exactly.
    expect(labels[0]).toBe(new Date(2026, 6, 13).toLocaleDateString([], {month: 'short', day: 'numeric'}));
    expect(labels[4]).toBe(new Date(2026, 7, 22).toLocaleDateString([], {month: 'short', day: 'numeric'}));
  });

  it('labels a year-tier range with two-digit years that change across a year boundary', () => {
    const labels = getTimeAxisTicks(rangeOf(321 * DAY_MS, new Date(2025, 8, 1))).map(t => t.label);

    expect(labels.every(label => /^\w+ '\d{2}$/.test(label))).toBe(true);
    expect(labels.some(label => label.endsWith("'25"))).toBe(true);
    expect(labels.some(label => label.endsWith("'26"))).toBe(true);
    expect(labels.some(label => label.includes('2025') || label.includes('2026'))).toBe(false);
  });
});

describe('formatAxisTimeLabel', () => {
  const wednesdayAfternoon = new Date(2026, 6, 15, 14, 30);

  it('says an hour of the day as a bare 24-hour number', () => {
    expect(formatAxisTimeLabel(wednesdayAfternoon, 'hour')).toBe('14');
  });

  it('says a day of the week as a single uppercase initial', () => {
    const label = formatAxisTimeLabel(wednesdayAfternoon, 'week');

    expect(label).toHaveLength(1);
    expect(label).toBe(label.toUpperCase());
  });

  it('says a date within a couple of months as a short date', () => {
    expect(formatAxisTimeLabel(wednesdayAfternoon, 'month')).toBe(
      wednesdayAfternoon.toLocaleDateString([], {month: 'short', day: 'numeric'}),
    );
  });

  it('says a month across a longer span with a two-digit year, never four', () => {
    const label = formatAxisTimeLabel(wednesdayAfternoon, 'year');

    expect(label).toMatch(/^\w+ '26$/);
    expect(label).not.toContain('2026');
  });
});

describe('getValueAxisTicks', () => {
  it('spreads the requested number of ticks across the value range', () => {
    const ticks = getValueAxisTicks(0, 100, 5);

    expect(ticks.map(tick => tick.ratio)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(ticks.map(tick => tick.label)).toEqual(['0', '25', '50', '75', '100']);
  });

  it('starts at the minimum value and ends at the maximum', () => {
    const ticks = getValueAxisTicks(3.5, 9.5, 5);

    expect(ticks[0]).toEqual({ratio: 0, label: '3.5'});
    expect(ticks[4]).toEqual({ratio: 1, label: '9.5'});
  });

  it('labels a flat series with its single value instead of dividing by zero', () => {
    const ticks = getValueAxisTicks(42, 42, 5);

    expect(ticks).toHaveLength(5);
    expect(ticks.map(tick => tick.label)).toEqual(['42', '42', '42', '42', '42']);
    expect(ticks.every(tick => Number.isFinite(tick.ratio))).toBe(true);
  });

  it('places a lone tick at the start of the range instead of dividing by zero', () => {
    expect(getValueAxisTicks(10, 20, 1)).toEqual([{ratio: 0, label: '10'}]);
  });

  it('writes values plainly while they fit the gutter', () => {
    // Five digits fit, so a step-counting range keeps every digit it has rather
    // than being rounded into a unit that buys it nothing.
    expect(getValueAxisTicks(8000, 15000, 5).map(tick => tick.label)).toEqual([
      '8000',
      '9750',
      '11500',
      '13250',
      '15000',
    ]);
  });

  it('keeps a range straddling a unit boundary plain rather than flattening it', () => {
    // Scaling at 1000 would write all five of these as `1k`: the unit is chosen
    // from what fits, so a value hovering near a boundary keeps its resolution.
    expect(getValueAxisTicks(999, 1001, 5).map(tick => tick.label)).toEqual([
      '999',
      '1000',
      '1000',
      '1001',
      '1001',
    ]);
  });

  it('scales the whole axis once a label would overrun the gutter', () => {
    expect(getValueAxisTicks(100000, 500000, 5).map(tick => tick.label)).toEqual([
      '100k',
      '200k',
      '300k',
      '400k',
      '500k',
    ]);
  });

  it('scales every label to the same unit, including the ones that would have fit', () => {
    // `90000` fits and `120000` does not. Writing them as they come would put
    // `90000` beside `120k` on one axis, which reads as two different scales.
    expect(getValueAxisTicks(90000, 120000, 5).map(tick => tick.label)).toEqual([
      '90k',
      '97.5k',
      '105k',
      '113k',
      '120k',
    ]);
  });

  it('writes a zero tick bare whatever unit the axis is in', () => {
    expect(getValueAxisTicks(0, 200000, 5).map(tick => tick.label)).toEqual([
      '0',
      '50k',
      '100k',
      '150k',
      '200k',
    ]);
  });

  it('counts the minus sign against the gutter it has to fit', () => {
    // `-50000` is six characters and overruns where `50000` would not.
    expect(getValueAxisTicks(-50000, -10000, 5).map(tick => tick.label)).toEqual([
      '-50k',
      '-40k',
      '-30k',
      '-20k',
      '-10k',
    ]);
  });

  it('climbs the unit ladder with the magnitude', () => {
    expect(getValueAxisTicks(1e6, 5e6, 5).map(tick => tick.label)).toEqual([
      '1M',
      '2M',
      '3M',
      '4M',
      '5M',
    ]);
    expect(getValueAxisTicks(1e9, 2e9, 5).map(tick => tick.label)).toEqual([
      '1B',
      '1.25B',
      '1.5B',
      '1.75B',
      '2B',
    ]);
    expect(getValueAxisTicks(1e12, 2e12, 5).map(tick => tick.label)).toEqual([
      '1T',
      '1.25T',
      '1.5T',
      '1.75T',
      '2T',
    ]);
  });
});

describe('chooseValueUnit', () => {
  it('leaves values unscaled while the widest of them fits', () => {
    expect(chooseValueUnit([8000, 15000])).toBe(PLAIN_UNIT);
    expect(chooseValueUnit([-99.9, 99.9])).toBe(PLAIN_UNIT);
    expect(chooseValueUnit([])).toBe(PLAIN_UNIT);
  });

  it('answers the smallest unit that brings the widest value under 1000', () => {
    expect(chooseValueUnit([999999]).suffix).toBe('k');
    expect(chooseValueUnit([1e6]).suffix).toBe('M');
    expect(chooseValueUnit([5e9]).suffix).toBe('B');
    expect(chooseValueUnit([5e12]).suffix).toBe('T');
  });

  it('reads the widest label rather than the first', () => {
    expect(chooseValueUnit([0, 200000]).suffix).toBe('k');
    expect(chooseValueUnit([-5e6, 100]).suffix).toBe('M');
  });
});

describe('formatAxisValueLabel', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [7.5, '7.5'],
    [12.333333333333334, '12.3'],
    [99.96, '100'],
    [512.4, '512'],
    [-3.256, '-3.26'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatAxisValueLabel(value)).toBe(expected);
  });

  it.each([
    [123456, '123k'],
    [12345, '12.3k'],
    [1234, '1.23k'],
    [-1234, '-1.23k'],
    [0, '0'],
    [4, '0'],
  ])('formats %s under a unit as %s', (value, expected) => {
    expect(formatAxisValueLabel(value, {factor: 1e3, suffix: 'k'})).toBe(expected);
  });
});
