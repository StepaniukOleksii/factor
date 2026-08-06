import React from 'react';
import {Canvas, Line, RoundedRect, Text as SkiaText, vec} from '@shopify/react-native-skia';
import {
  type CategorySeriesPoint,
  type CategoryShare,
  isCategoryPoint,
  type TimeRange,
} from '../../application/GetMetricSeriesUseCase';
import type {EnumConstraint} from '../../domain/Metric';
import {
  AXIS_LABEL_COLOR,
  baselineCentreOffset,
  GRIDLINE_COLOR,
  GRIDLINE_WIDTH,
  type PlotRect,
  TimeAxisLabels,
  toPlotRect,
  truncateToWidth,
  useAxisFont,
} from './chartAxis';
import {getLaneColors} from './laneColors';
import {InsufficientData} from './InsufficientData';
import type {ChartRendererProps} from './rendererRegistry';

// Wider than the Numeric chart's value gutter, which holds numbers: this one
// holds words, and the extra characters are what make a lane label readable.
const LANE_LABEL_GUTTER = 48;
const LANE_LABEL_GAP = 5;
// Between a mark and its neighbour, so consecutive buckets read as two marks
// rather than one band.
const MARK_GAP = 2;
const MIN_MARK_WIDTH = 2;
// Keeps a mark clear of its lane's separators, top and bottom.
const MARK_INSET = 3;
// A value that occurred at all is visible, however small its share. Nothing is
// distorted by it: each lane is measured against itself, so unlike a stacked bar
// there is no total for a floored mark to take from.
const MIN_MARK_HEIGHT = 3;
const MARK_CORNER_RADIUS = 4;

/**
 * Renders an Enum metric's series as a swimlane: one lane per allowed value, in
 * declared order with the last-declared value on top, and one mark per value a
 * bucket's Records took - as wide as the bucket and as tall a share of its lane
 * as the Records taking that value were of the bucket.
 *
 * Nothing here is tappable: what a tap on a lane should mean has not been
 * decided, so `onPointPress` is never called and no `Pressable` wraps the canvas.
 */
export const EnumSwimlaneChart = ({metric, points, timeRange, aggregation, width, height}: ChartRendererProps) => {
  const font = useAxisFont();

  const laneValues = (metric.constraint as EnumConstraint | null)?.allowedValues ?? [];
  if (points.length === 0 || laneValues.length === 0) {
    return <InsufficientData height={height} />;
  }

  const plot = toPlotRect(width, height, LANE_LABEL_GUTTER);
  // Over the lane count rather than a fixed height, so two, three and four lanes
  // each fill the same card.
  const laneHeight = (plot.bottom - plot.top) / laneValues.length;
  const laneColors = getLaneColors(laneValues.length);
  const swimlane: Swimlane = {
    plot,
    laneValues,
    laneHeight,
    timeRange,
    bucketSizeMs: aggregation.bucketSizeMs,
  };
  const marks = points
    .filter(isCategoryPoint)
    .flatMap(point => point.shares.map(share => toMark(point, share, swimlane)));

  return (
    <Canvas style={{width, height}}>
      {separatorLanes(laneValues.length).map(lane => (
        <Line
          key={`separator-${lane}`}
          p1={vec(plot.left, laneFloor(lane, plot, laneHeight))}
          p2={vec(plot.right, laneFloor(lane, plot, laneHeight))}
          color={GRIDLINE_COLOR}
          strokeWidth={GRIDLINE_WIDTH}
        />
      ))}
      {marks.map(mark => (
        <RoundedRect
          key={mark.key}
          x={mark.x}
          y={mark.y}
          width={mark.width}
          height={mark.height}
          r={cornerRadius(mark.width, mark.height)}
          color={laneColors[mark.lane]}
        />
      ))}
      {font &&
        laneValues.map((value, lane) => (
          <SkiaText
            key={`lane-label-${lane}`}
            font={font}
            text={truncateToWidth(font, value, LANE_LABEL_GUTTER - LANE_LABEL_GAP)}
            x={0}
            y={laneFloor(lane, plot, laneHeight) - laneHeight / 2 + baselineCentreOffset(font)}
            color={AXIS_LABEL_COLOR}
          />
        ))}
      <TimeAxisLabels font={font} timeRange={timeRange} plot={plot} />
    </Canvas>
  );
};

/** Everything a mark's geometry is measured against. */
interface Swimlane {
  plot: PlotRect;
  /** In declared order, so a value's index is its lane counted from the bottom. */
  laneValues: string[];
  laneHeight: number;
  timeRange: TimeRange;
  bucketSizeMs: number;
}

/** One value's share of one bucket, as drawn. */
interface Mark {
  key: string;
  /** Counted from the plot's bottom, which is where the first-declared value sits. */
  lane: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The lower edge of a lane, counting lanes up from the plot's bottom - where the
 * first-declared value's lane sits. Lane `laneCount` is the plot's own top edge.
 */
function laneFloor(lane: number, plot: PlotRect, laneHeight: number): number {
  return plot.bottom - lane * laneHeight;
}

/** Every lane boundary, the plot's bottom and top edges included. */
function separatorLanes(laneCount: number): number[] {
  return Array.from({length: laneCount + 1}, (_, lane) => lane);
}

function toMark(
  point: CategorySeriesPoint,
  {value, share}: CategoryShare,
  {plot, laneValues, laneHeight, timeRange, bucketSizeMs}: Swimlane,
): Mark {
  const lane = laneValues.indexOf(value);
  const x = timeToX(point.x, timeRange, plot);
  const markHeight = Math.max(share * laneHeight - 2 * MARK_INSET, MIN_MARK_HEIGHT);
  return {
    key: `${point.x}-${value}`,
    lane,
    x,
    // The window may end mid-bucket, so the newest mark is cut off at the plot's
    // right edge rather than drawn past it.
    width: Math.min(
      Math.max(spanToWidth(bucketSizeMs, timeRange, plot) - MARK_GAP, MIN_MARK_WIDTH),
      plot.right - x,
    ),
    y: laneFloor(lane, plot, laneHeight) - MARK_INSET - markHeight,
    height: markHeight,
  };
}

/**
 * A moment's place across the plot. The x domain is the chart's window, not the
 * data's own span - the same scale the Numeric chart maps its points through, so
 * two charts of the same window line up.
 */
function timeToX(atMs: number, timeRange: TimeRange, plot: PlotRect): number {
  const startMs = timeRange.start.getTime();
  return plot.left + ((atMs - startMs) / spanOf(timeRange)) * (plot.right - plot.left);
}

/** How wide a stretch of time is, through that same scale. */
function spanToWidth(durationMs: number, timeRange: TimeRange, plot: PlotRect): number {
  return (durationMs / spanOf(timeRange)) * (plot.right - plot.left);
}

function spanOf(timeRange: TimeRange): number {
  return timeRange.end.getTime() - timeRange.start.getTime() || 1;
}

/** Clamped to half the smaller side, so a thin mark reads as a bar and not a lozenge. */
function cornerRadius(markWidth: number, markHeight: number): number {
  return Math.min(MARK_CORNER_RADIUS, Math.min(markWidth, markHeight) / 2);
}
