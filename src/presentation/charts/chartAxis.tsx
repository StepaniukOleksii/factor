/**
 * What every trend chart draws the same way: the time axis along its bottom
 * edge, the geometry of the plotting rectangle the chart draws inside, and the
 * Skia text helpers both need. Held here rather than in one chart, so two charts
 * cannot drift into two versions of the same axis.
 */
import React from 'react';
import {type SkFont, Text as SkiaText, useFont,} from '@shopify/react-native-skia';
// A `Canvas` cannot composite a platform `Text` element, so drawing glyphs needs
// a typeface Skia itself owns. Bundled with the app rather than matched from the
// system, so every device labels its axes identically.
import AXIS_TYPEFACE from '../../../assets/fonts/Roboto-Regular.ttf';
import type {TimeRange} from '../../application/GetMetricSeriesUseCase';
import {type AxisTick, getTimeAxisTicks} from './axisTicks';
import {COLORS, withAlpha} from '@presentation/theme';

// Keeps a chart's own drawing off the plot's top edge so nothing is clipped
// there; the time label strip below does the same job at the bottom.
export const PLOT_TOP_PADDING = 6;
export const TIME_AXIS_HEIGHT = 14;
// Holds the last time label and whatever the chart draws last off the card's
// right edge, the way the left gutter does on the left.
export const PLOT_RIGHT_INSET = 4;
export const TIME_LABEL_BASELINE_OFFSET = 12;
export const AXIS_FONT_SIZE = 9;
/**
 * The gutter every chart carves out of its box for the labels down its left
 * edge, and the gap those labels keep from the plot. One width for every chart
 * rather than one per chart: the x scale runs from the plot's left edge, so two
 * cards reserving different gutters put the same moment at two different places
 * and cannot be read down a column against each other.
 *
 * 32px holds five digits of a Numeric value label - four, and any negative
 * carrying a decimal, overran the 24px this replaced. A value label is
 * right-aligned rather than truncated, since a truncated number is a different
 * number, so a value too wide for this is not shortened but scaled:
 * `getValueAxisTicks` moves the whole axis into a unit whose labels fit. It
 * holds six average characters of a lane label, past which `truncateToWidth`
 * takes over: fewer than the 48px it replaces there, and enough to tell lanes
 * apart when the ramp and the lane's position already say which is which.
 */
export const LABEL_GUTTER = 32;
export const LABEL_GAP = 5;
export const AXIS_LABEL_COLOR = COLORS.onSurfaceVariant;
// Faded below the axis labels' own colour: a count written above a mark is an
// annotation on the drawing, not a second accent.
export const POINT_COUNT_LABEL_COLOR = withAlpha(COLORS.onSurfaceVariant, 0.65);
// Faint enough that the gridlines read as a reference behind what the chart
// draws rather than a grid drawn over it.
export const GRIDLINE_COLOR = withAlpha(COLORS.outlineVariant, 0.6);
export const GRIDLINE_WIDTH = 1;

/** The chart's box less its label gutters: where a chart actually draws. */
export interface PlotRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Carves the label gutters out of the chart's box. Clamped so a box too small to
 * hold them - a chart whose width hasn't been measured yet - collapses to an
 * empty rectangle rather than an inside-out one.
 */
export function toPlotRect(width: number, height: number): PlotRect {
  return {
    left: LABEL_GUTTER,
    top: PLOT_TOP_PADDING,
    right: Math.max(width - PLOT_RIGHT_INSET, LABEL_GUTTER),
    bottom: Math.max(height - TIME_AXIS_HEIGHT, PLOT_TOP_PADDING),
  };
}

/**
 * A moment's place across the plot. The x domain is the chart's window, not the
 * data's own span, so every card drawn over one window puts a moment at the same
 * place and the cards can be read against each other down a column.
 */
export function timeToX(atMs: number, timeRange: TimeRange, plot: PlotRect): number {
  const startMs = timeRange.start.getTime();
  return plot.left + ((atMs - startMs) / spanOf(timeRange)) * (plot.right - plot.left);
}

/** How wide a stretch of time is, through that same scale. */
export function spanToWidth(durationMs: number, timeRange: TimeRange, plot: PlotRect): number {
  return (durationMs / spanOf(timeRange)) * (plot.right - plot.left);
}

function spanOf(timeRange: TimeRange): number {
  return timeRange.end.getTime() - timeRange.start.getTime() || 1;
}

/**
 * The typeface every chart labels with, at the one size they all label at. It
 * loads asynchronously, so this answers `null` for the first render or two and
 * each caller draws its labels only once it resolves.
 */
export function useAxisFont(): SkFont | null {
  return useFont(AXIS_TYPEFACE, AXIS_FONT_SIZE);
}

export function measureWidth(font: SkFont, text: string): number {
  return font.measureText(text).width;
}

/**
 * How far below a label's baseline its visual middle sits, so a label centres on
 * what it names instead of resting on top of it. `ascent` is negative (measured
 * upward from the baseline) and `descent` positive.
 */
export function baselineCentreOffset(font: SkFont): number {
  const {ascent, descent} = font.getMetrics();
  return -(ascent + descent) / 2;
}

const ELLIPSIS = '…';

/**
 * `text` if it fits `maxWidth`, otherwise its widest prefix that fits with an
 * ellipsis after it - and nothing at all if even the ellipsis is too wide to
 * draw, since a label may never overrun the gutter it sits in.
 */
export function truncateToWidth(font: SkFont, text: string, maxWidth: number): string {
  if (measureWidth(font, text) <= maxWidth) {
    return text;
  }
  if (measureWidth(font, ELLIPSIS) > maxWidth) {
    return '';
  }
  let prefix = text;
  while (prefix.length > 0 && measureWidth(font, prefix + ELLIPSIS) > maxWidth) {
    prefix = prefix.slice(0, -1);
  }
  return prefix + ELLIPSIS;
}

/**
 * Where a time label starts, given how wide it is. Labels are centred on their
 * tick, except one sitting exactly at the range's start or end - those align
 * inwards from the plot's edge instead, so they don't overflow the card.
 */
export function timeLabelX(tick: AxisTick, labelWidth: number, plot: PlotRect): number {
  if (tick.ratio <= 0) {
    return plot.left;
  }
  if (tick.ratio >= 1) {
    return plot.right - labelWidth;
  }
  return plot.left + tick.ratio * (plot.right - plot.left) - labelWidth / 2;
}

export interface TimeAxisLabelsProps {
  /** `null` until the typeface resolves, which draws no labels rather than blocking the chart. */
  font: SkFont | null;
  timeRange: TimeRange;
  plot: PlotRect;
}

/** The label strip along the plot's bottom edge, naming the window it spans. */
export const TimeAxisLabels = ({font, timeRange, plot}: TimeAxisLabelsProps) => {
  if (!font) {
    return null;
  }
  return (
    <>
      {getTimeAxisTicks(timeRange).map(tick => (
        <SkiaText
          key={`time-${tick.ratio}`}
          font={font}
          text={tick.label}
          x={timeLabelX(tick, measureWidth(font, tick.label), plot)}
          y={plot.bottom + TIME_LABEL_BASELINE_OFFSET}
          color={AXIS_LABEL_COLOR}
        />
      ))}
    </>
  );
};
