import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Line} from '@shopify/react-native-skia';
import {EventRules} from './EventRules';
import {EVENT_BAND_HEIGHT, EVENT_MARK_SIZE} from './eventMarkerGeometry';
import type {PlotRect} from './chartAxis';
import {Event} from '../../domain/Event';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';

vi.mock('react-native', () => require('react-native-web'));

// One pixel to the minute across the plot, so a rule's expected x reads straight
// off the minute its Event falls on.
const PLOT: PlotRect = {left: 0, top: 26, right: 300, bottom: 120};
const START = new Date('2026-03-01T00:00:00Z');
const RANGE: TimeRange = {start: START, end: new Date(START.getTime() + 300 * 60_000)};

function eventAt(minute: number): Event {
  return new Event(`event-${minute}`, `event-${minute}`, new Date(START.getTime() + minute * 60_000));
}

function renderRules(events: Event[]) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <EventRules events={events} timeRange={RANGE} plot={PLOT} bandHeight={EVENT_BAND_HEIGHT} />,
    );
  });
  return tree!.root.findAllByType(Line);
}

describe('EventRules', () => {
  it('draws one line per event at the x its moment maps to', () => {
    const lines = renderRules([eventAt(40), eventAt(220)]);

    expect(lines).toHaveLength(2);
    expect(lines[0].props.p1.x).toBeCloseTo(40);
    expect(lines[1].props.p1.x).toBeCloseTo(220);
  });

  it('draws nothing for an empty list', () => {
    expect(renderRules([])).toHaveLength(0);
  });

  it('runs each line from its mark in the band down to the plot bottom', () => {
    const [line] = renderRules([eventAt(100)]);

    // The mark's own centre, so the line and the mark that opens it touch.
    expect(line.props.p1.y).toBe(PLOT.top - EVENT_BAND_HEIGHT + EVENT_MARK_SIZE / 2);
    expect(line.props.p2.y).toBe(PLOT.bottom);
  });

  it('keeps a line at its own moment when two events all but coincide', () => {
    const lines = renderRules([eventAt(150), eventAt(152)]);

    expect(lines[0].props.p1.x).toBeCloseTo(150);
    expect(lines[1].props.p1.x).toBeCloseTo(152);
  });
});
