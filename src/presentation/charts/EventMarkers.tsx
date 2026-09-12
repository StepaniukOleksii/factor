import React from 'react';
import {type GestureResponderEvent, StyleSheet, TouchableOpacity, View} from 'react-native';
import type {Event} from '../../domain/Event';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';
import {formatRelativeTime} from '@shared/formatRelativeTime';
import {type PlotRect} from './chartAxis';
import {
  type EventMarkerGroup,
  EVENT_MARK_SIZE,
  eventMarkerGroups,
  eventMarkRect,
  eventTargetRect,
} from './eventMarkerGeometry';
import {COLORS, RADIUS} from '@presentation/theme';

interface EventMarkersProps {
  events: readonly Event[];
  timeRange: TimeRange;
  plot: PlotRect;
  /** Depth of the band the marks sit in, above the plot. */
  bandHeight: number;
  /** How far the layer's own left edge sits from the canvas's. */
  offsetX: number;
  /** How far its top sits from the canvas's, positive where it reaches above. */
  offsetY: number;
  /**
   * What a handle opens, and where on the window its target sits - so a popover
   * can be anchored to the handle without anyone having to measure it.
   */
  onPress: (group: EventMarkerGroup, target: EventMarkerAnchor) => void;
}

export interface EventMarkerAnchor {
  /** Middle of the target, in window coordinates. */
  centreX: number;
  /** Its bottom edge, which is the plot's top edge. */
  bottomY: number;
}

/**
 * The tappable half of the Event markers, and the only part of one that is not
 * Skia: a layer of handles over the card, transparent to touches except where a
 * handle sits.
 *
 * A handle is a real element rather than arithmetic on a tap position, unlike
 * every mark a renderer draws, because that is what carries an
 * `accessibilityLabel` (ADR-8).
 */
export const EventMarkers = ({
  events,
  timeRange,
  plot,
  bandHeight,
  offsetX,
  offsetY,
  onPress,
}: EventMarkersProps) => {
  const bandTop = plot.top - bandHeight;
  const groups = eventMarkerGroups(events, timeRange, plot);

  return (
    <View style={styles.layer} pointerEvents="box-none">
      {groups.map(group => {
        const mark = eventMarkRect(group, bandTop);
        const target = eventTargetRect(group, bandTop);

        return (
          <TouchableOpacity
            key={group.events[0].id}
            style={[
              styles.target,
              {
                left: offsetX + target.left,
                top: offsetY + target.top,
                width: target.width,
                height: target.height,
              },
            ]}
            onPress={event => onPress(group, toAnchor(event, target.width, target.height))}
            accessibilityLabel={markerLabel(group)}
            activeOpacity={0.7}
          >
            {/* Inside the target rather than being it: the target reaches well
                above the mark, and only the mark is drawn. */}
            <View
              testID="event-mark"
              style={[
                styles.mark,
                {
                  left: mark.left - target.left,
                  top: mark.top - target.top,
                  width: mark.width,
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/**
 * Where the pressed handle's target sits on the window, from the press alone: a
 * responder event carries the touch both in window coordinates and relative to
 * what it hit, and the difference is the element's own origin.
 */
function toAnchor(event: GestureResponderEvent, width: number, height: number): EventMarkerAnchor {
  const {pageX, pageY, locationX, locationY} = event.nativeEvent;
  return {
    centreX: pageX - locationX + width / 2,
    bottomY: pageY - locationY + height,
  };
}

/** What a handle announces, and what an E2E flow taps it by. */
function markerLabel(group: EventMarkerGroup): string {
  const [first] = group.events;
  return group.events.length === 1
    ? `Event ${first.name}, ${formatRelativeTime(first.occurredAt)}`
    : `${group.events.length} events`;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  target: {
    position: 'absolute',
  },
  mark: {
    position: 'absolute',
    height: EVENT_MARK_SIZE,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.outline,
  },
});
