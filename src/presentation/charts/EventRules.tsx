import React from 'react';
import {DashPathEffect, Line, vec} from '@shopify/react-native-skia';
import type {Event} from '../../domain/Event';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';
import {type PlotRect, timeToX} from './chartAxis';
import {EVENT_MARK_SIZE} from './eventMarkerGeometry';
import {COLORS} from '@presentation/theme';

// Dashed, and off the gridlines' own token: a solid faint vertical line across a
// card of solid faint horizontal ones reads as one of them.
const RULE_COLOR = COLORS.outline;
const RULE_WIDTH = 1;
const DASH_LENGTH = 3;

interface EventRulesProps {
  events: readonly Event[];
  timeRange: TimeRange;
  plot: PlotRect;
  /** Depth of the band above the plot, which the rules run up through. */
  bandHeight: number;
}

/**
 * The drawn half of the Event markers: one dashed vertical line per Event, at
 * the moment it occurred, starting at the centre of its handle's mark up in the
 * band so the two touch.
 *
 * Belongs as the first child of a renderer's own `Canvas`: only a draw inside
 * the same canvas gets underneath that card's marks.
 *
 * Never grouped, unlike the handles - a grouped line would sit at a moment
 * nothing happened at (ADR-8).
 */
export const EventRules = ({events, timeRange, plot, bandHeight}: EventRulesProps) => {
  const top = plot.top - bandHeight + EVENT_MARK_SIZE / 2;

  return (
    <>
      {events.map(event => {
        const x = timeToX(event.occurredAt.getTime(), timeRange, plot);
        return (
          <Line
            key={event.id}
            p1={vec(x, top)}
            p2={vec(x, plot.bottom)}
            color={RULE_COLOR}
            strokeWidth={RULE_WIDTH}
          >
            <DashPathEffect intervals={[DASH_LENGTH, DASH_LENGTH]} />
          </Line>
        );
      })}
    </>
  );
};
