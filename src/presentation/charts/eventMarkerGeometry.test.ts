import {describe, expect, it} from 'vitest';
import {
  EVENT_BAND_HEIGHT,
  EVENT_MARK_SIZE,
  EVENT_MARKER_OVERHANG,
  eventBandHeight,
  eventMarkerGroups,
  eventMarkRect,
  eventTargetRect,
} from './eventMarkerGeometry';
import {Event} from '../../domain/Event';
import type {PlotRect} from './chartAxis';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';

// A 300px-wide plot over a 300-minute window, so one minute is one pixel and a
// test can state distances in the pixels the grouping actually compares.
const PLOT: PlotRect = {left: 0, top: 26, right: 300, bottom: 120};
const START = new Date('2026-03-01T00:00:00Z');
const RANGE: TimeRange = {start: START, end: new Date(START.getTime() + 300 * 60_000)};

function eventAt(x: number, name = `event-${x}`): Event {
  return new Event(name, name, new Date(START.getTime() + x * 60_000));
}

function groupsAt(...xs: number[]) {
  return eventMarkerGroups(xs.map(x => eventAt(x)), RANGE, PLOT);
}

describe('eventBandHeight', () => {
  it('reserves nothing when there is no event to mark', () => {
    expect(eventBandHeight([])).toBe(0);
  });

  it('reserves the band once there is', () => {
    expect(eventBandHeight([eventAt(10)])).toBe(EVENT_BAND_HEIGHT);
  });
});

describe('EVENT_MARKER_OVERHANG', () => {
  it('covers exactly what a target reaches above the canvas', () => {
    const [group] = groupsAt(100);
    const bandTop = PLOT.top - EVENT_BAND_HEIGHT;

    // Negative in canvas coordinates, which is what the layer has to make room
    // for above itself.
    expect(eventTargetRect(group, bandTop).top).toBe(-EVENT_MARKER_OVERHANG);
  });
});

describe('eventMarkerGroups', () => {
  it('leaves well-separated events as separate handles', () => {
    const groups = groupsAt(20, 120, 220);

    expect(groups.map(group => group.events.length)).toEqual([1, 1, 1]);
    groups.forEach((group, index) => expect(group.startX).toBeCloseTo([20, 120, 220][index]));
  });

  it('merges events whose targets would overlap into one handle carrying both', () => {
    const groups = groupsAt(100, 128);

    expect(groups).toHaveLength(1);
    expect(groups[0].events.map(event => event.name)).toEqual(['event-100', 'event-128']);
  });

  it('separates events exactly further apart than a target is wide', () => {
    expect(groupsAt(100, 149)).toHaveLength(2);
  });

  it('keeps events exactly a target apart together', () => {
    expect(groupsAt(100, 148)).toHaveLength(1);
  });

  it('bounds a chained run at one target width, measuring from the group first', () => {
    // Each is within a target of the one before, but the fourth is not within
    // one of the first, so it opens a group of its own.
    const groups = groupsAt(0, 40, 80, 120);

    expect(groups.map(group => group.events.length)).toEqual([2, 2]);
    groups.forEach(group => expect(group.endX - group.startX).toBeCloseTo(40));
  });

  it('records the span from the group first rule to its last', () => {
    const [group] = groupsAt(100, 110, 130);

    expect(group.startX).toBeCloseTo(100);
    expect(group.endX).toBeCloseTo(130);
  });

  it('groups nothing when there is nothing to group', () => {
    expect(eventMarkerGroups([], RANGE, PLOT)).toEqual([]);
  });
});

describe('eventMarkRect', () => {
  it('draws a lone event as a square centred on its rule', () => {
    const [group] = groupsAt(100);

    expect(eventMarkRect(group, 6)).toEqual({
      left: 100 - EVENT_MARK_SIZE / 2,
      top: 6,
      width: EVENT_MARK_SIZE,
      height: EVENT_MARK_SIZE,
    });
  });

  it('draws a group as a pill spanning its first rule to its last', () => {
    const [group] = groupsAt(100, 130);

    expect(eventMarkRect(group, 6)).toMatchObject({
      left: 100 - EVENT_MARK_SIZE / 2,
      width: 30 + EVENT_MARK_SIZE,
    });
  });
});

describe('eventTargetRect', () => {
  it('gives a lone event the full 48px box', () => {
    const [group] = groupsAt(100);

    expect(eventTargetRect(group, 6)).toMatchObject({left: 100 - 24, width: 48});
  });

  it('widens to the pill once the pill is the wider', () => {
    const [group] = groupsAt(100, 145);

    expect(eventTargetRect(group, 6)).toMatchObject({width: 45 + EVENT_MARK_SIZE});
  });

  it('keeps 48px for a group whose pill is narrower than one', () => {
    const [group] = groupsAt(100, 110);

    expect(eventTargetRect(group, 6).width).toBe(48);
  });

  it('reaches further above the mark than below it, and never past the plot top', () => {
    const [group] = groupsAt(100);
    const bandTop = PLOT.top - EVENT_BAND_HEIGHT;

    const target = eventTargetRect(group, bandTop);

    expect(target.height).toBe(48);
    expect(target.top).toBeLessThan(bandTop);
    // The whole point of the band: no part of a target lies over a chart.
    expect(target.top + target.height).toBeLessThanOrEqual(PLOT.top);
  });
});
