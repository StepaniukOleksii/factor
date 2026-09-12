import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {TouchableOpacity} from 'react-native';
import {EventMarkers} from './EventMarkers';
import {EVENT_BAND_HEIGHT, EVENT_MARK_SIZE} from './eventMarkerGeometry';
import type {PlotRect} from './chartAxis';
import {Event} from '../../domain/Event';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';

vi.mock('react-native', () => require('react-native-web'));

const PLOT: PlotRect = {left: 0, top: 26, right: 300, bottom: 120};
const START = new Date('2026-03-01T00:00:00Z');
const RANGE: TimeRange = {start: START, end: new Date(START.getTime() + 300 * 60_000)};

function eventAt(minute: number, name = `event-${minute}`, description: string | null = null): Event {
  return new Event(name, name, new Date(START.getTime() + minute * 60_000), description);
}

function renderMarkers(events: Event[], onPress = vi.fn()) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <EventMarkers
        events={events}
        timeRange={RANGE}
        plot={PLOT}
        bandHeight={EVENT_BAND_HEIGHT}
        offsetX={0}
        offsetY={0}
        onPress={onPress}
      />,
    );
  });
  return {handles: tree!.root.findAllByType(TouchableOpacity), onPress};
}

/** A press on a handle, carrying the touch both in window and element coordinates. */
function pressAt(pageX: number, pageY: number, locationX: number, locationY: number) {
  return {nativeEvent: {pageX, pageY, locationX, locationY}};
}

function markWidth(handle: renderer.ReactTestInstance): number {
  return handle.findByProps({testID: 'event-mark'}).props.style[1].width;
}

describe('EventMarkers', () => {
  it('draws one handle per group rather than per event', () => {
    const {handles} = renderMarkers([eventAt(20), eventAt(140), eventAt(160)]);

    expect(handles).toHaveLength(2);
  });

  it('names a lone event on its handle', () => {
    const {handles} = renderMarkers([eventAt(20, 'vacation')]);

    expect(handles[0].props.accessibilityLabel).toContain('vacation');
  });

  it('announces a count where a handle stands for several', () => {
    const {handles} = renderMarkers([eventAt(140), eventAt(150), eventAt(160)]);

    expect(handles[0].props.accessibilityLabel).toBe('3 events');
  });

  it('reports the group behind the handle that was pressed', () => {
    const events = [eventAt(140, 'this week'), eventAt(160, 'today')];
    const {handles, onPress} = renderMarkers(events);

    act(() => handles[0].props.onPress(pressAt(200, 300, 10, 20)));

    expect(onPress.mock.calls[0][0].events.map((event: Event) => event.name))
      .toEqual(['this week', 'today']);
  });

  it('reports where the pressed target sits on the window, from the press alone', () => {
    const {handles, onPress} = renderMarkers([eventAt(20)]);

    // A touch 10px into a 48px-wide target, 20px down its 48px height.
    act(() => handles[0].props.onPress(pressAt(200, 300, 10, 20)));

    const [, anchor] = onPress.mock.calls[0];
    expect(anchor.centreX).toBe(200 - 10 + 24);
    expect(anchor.bottomY).toBe(300 - 20 + 48);
  });

  it('keeps every target clear of the plot', () => {
    const {handles} = renderMarkers([eventAt(20), eventAt(140)]);

    handles.forEach(handle => {
      const {top, height} = handle.props.style[1];
      expect(top + height).toBeLessThanOrEqual(PLOT.top);
    });
  });

  it('draws nothing when the window holds no event', () => {
    expect(renderMarkers([]).handles).toHaveLength(0);
  });

  it('spans a group mark across its rules and keeps a lone one square', () => {
    const {handles: [group]} = renderMarkers([eventAt(140), eventAt(170)]);
    const {handles: [lone]} = renderMarkers([eventAt(20)]);

    expect(markWidth(group)).toBeCloseTo(30 + EVENT_MARK_SIZE);
    expect(markWidth(lone)).toBe(EVENT_MARK_SIZE);
  });
});
