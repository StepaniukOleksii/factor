/**
 * The geometry of the Event markers drawn over a trend card: how deep a band
 * they need above the plot, and which of them share a handle.
 *
 * Named for the geometry rather than the markers because a case-insensitive
 * filesystem cannot tell `eventMarkers.ts` from the `EventMarkers.tsx` beside
 * it, and the component resolved its own import back to itself.
 */
import type {Event} from '../../domain/Event';
import {PLOT_TOP_PADDING, type PlotRect, timeToX} from './chartAxis';
import {TAP_TOLERANCE} from './chartHitTest';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';

export const EVENT_MARK_SIZE = 7;

/** Deep enough that a handle's target reaches the plot's top edge, never past it. */
export const EVENT_BAND_HEIGHT = 20;

/**
 * The 48px target, biased upward about its mark rather than centred - which is
 * what lets a 20px band hold it (ADR-8).
 */
export const EVENT_TARGET_ABOVE = 32;
export const EVENT_TARGET_BELOW = 16;

/**
 * How far a handle's target reaches above the canvas that holds its band, which
 * is the one part of the marker layer that falls outside the chart's own box.
 * Android clips a child to its parent's bounds, so the layer's box has to
 * include this rather than simply overflow it.
 */
export const EVENT_MARKER_OVERHANG = EVENT_TARGET_ABOVE - PLOT_TOP_PADDING - EVENT_MARK_SIZE / 2;

export function eventBandHeight(events: readonly Event[]): number {
  return events.length > 0 ? EVENT_BAND_HEIGHT : 0;
}

export interface EventMarkerGroup {
  /** The Events this one handle stands for, in the order they occurred. */
  events: Event[];
  /** Its first rule's place across the plot, and its last's - equal for a lone Event. */
  startX: number;
  endX: number;
}

/**
 * Groups the Events whose targets would overlap into one handle each, without
 * which the overlap decides by draw order and an Event becomes unreachable
 * (ADR-8).
 *
 * An Event joins while it falls within a target's width of the group's *first*
 * rather than of the last, which bounds a group's span at one target's width
 * however many chain into it.
 */
export function eventMarkerGroups(
  events: readonly Event[],
  timeRange: TimeRange,
  plot: PlotRect,
): EventMarkerGroup[] {
  const targetWidth = TAP_TOLERANCE * 2;
  const groups: EventMarkerGroup[] = [];

  for (const event of events) {
    const x = timeToX(event.occurredAt.getTime(), timeRange, plot);
    const open = groups[groups.length - 1];
    if (open && x - open.startX <= targetWidth) {
      open.events.push(event);
      open.endX = x;
    } else {
      groups.push({events: [event], startX: x, endX: x});
    }
  }

  return groups;
}

export interface EventMarkerBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A pill from the group's first rule to its last, which is a square for one Event. */
export function eventMarkRect(group: EventMarkerGroup, bandTop: number): EventMarkerBox {
  return {
    left: group.startX - EVENT_MARK_SIZE / 2,
    top: bandTop,
    width: group.endX - group.startX + EVENT_MARK_SIZE,
    height: EVENT_MARK_SIZE,
  };
}

/**
 * The target around that mark. ADR-5's 48px is a floor here rather than a size:
 * a wide pill keeps its own width, so a group never offers less than a lone
 * Event does.
 */
export function eventTargetRect(group: EventMarkerGroup, bandTop: number): EventMarkerBox {
  const mark = eventMarkRect(group, bandTop);
  const width = Math.max(mark.width, TAP_TOLERANCE * 2);
  const centreX = mark.left + mark.width / 2;
  const centreY = bandTop + EVENT_MARK_SIZE / 2;

  return {
    left: centreX - width / 2,
    top: centreY - EVENT_TARGET_ABOVE,
    width,
    height: EVENT_TARGET_ABOVE + EVENT_TARGET_BELOW,
  };
}
