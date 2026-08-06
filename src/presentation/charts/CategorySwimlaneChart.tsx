import React from 'react';
import {Canvas, Line, RoundedRect, Text as SkiaText, vec} from '@shopify/react-native-skia';
import {
  type CategoryCount,
  type CategorySeriesPoint,
  isCategoryPoint,
  type TimeRange,
} from '../../application/GetMetricSeriesUseCase';
import {
  AXIS_LABEL_COLOR,
  baselineCentreOffset,
  GRIDLINE_COLOR,
  GRIDLINE_WIDTH,
  LABEL_GAP,
  LABEL_GUTTER,
  type PlotRect,
  TimeAxisLabels,
  toPlotRect,
  truncateToWidth,
  useAxisFont,
} from './chartAxis';
import {type ChartLane, getChartLanes} from './chartLanes';
import {getLaneColors} from './laneColors';
import {InsufficientData} from './InsufficientData';
import type {ChartRendererProps} from './rendererRegistry';

// Between a mark and its neighbour, so consecutive buckets read as two marks
// rather than one band.
const MARK_GAP = 2;
const MIN_MARK_WIDTH = 2;
// Keeps a mark clear of its lane's separators, top and bottom.
const MARK_INSET = 3;
// A value that occurred at all is visible, however few Records took it. This does
// overstate the rarest counts, since every mark is measured against the same
// scale - the alternative is a value that happened vanishing from the chart.
const MIN_MARK_HEIGHT = 3;
const MARK_CORNER_RADIUS = 4;

/**
 * Renders as a swimlane the series of a metric whose Records take one of a fixed
 * set of values - an Enum's declared list, a Boolean's pair of answers. One lane
 * per value, read top down in the order the Record form presents them, and one
 * mark per value a bucket's Records took, as wide as the bucket and as tall as
 * the number of Records that took it.
 *
 * Heights are measured against one scale shared by the whole chart rather than
 * against each bucket's own total, so a bucket standing for a single Record
 * draws a shorter column than a busy one beside it. Within a bucket that leaves
 * every mark divided by the same constant, so their proportions to one another
 * are still that bucket's own split.
 *
 * Nothing here is tappable: what a tap on a lane should mean has not been
 * decided, so `onPointPress` is never called and no `Pressable` wraps the canvas.
 */
export const CategorySwimlaneChart = ({metric, points, timeRange, aggregation, width, height}: ChartRendererProps) => {
  const font = useAxisFont();

  const lanes = getChartLanes(metric);
  const buckets = points.filter(isCategoryPoint);
  if (buckets.length === 0 || lanes.length === 0) {
    return <InsufficientData height={height} />;
  }

  const plot = toPlotRect(width, height);
  const laneHeight = (plot.bottom - plot.top) / lanes.length;
  const laneColors = getLaneColors(lanes.length);
  const drawable = drawableCounts(buckets, lanes);
  const swimlane: Swimlane = {
    plot,
    laneHeight,
    timeRange,
    bucketSizeMs: aggregation.bucketSizeMs,
    tallestCount: tallestCountIn(drawable),
  };
  const marks = drawable.map(laneCount => toMark(laneCount, swimlane));

  return (
    <Canvas style={{width, height}}>
      {laneBoundaries(lanes.length, plot, laneHeight).map(y => (
        <Line
          key={`separator-${y}`}
          p1={vec(plot.left, y)}
          p2={vec(plot.right, y)}
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
        lanes.map(({label}, lane) => (
          <SkiaText
            key={`lane-label-${lane}`}
            font={font}
            text={truncateToWidth(font, label, LABEL_GUTTER - LABEL_GAP)}
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
  laneHeight: number;
  timeRange: TimeRange;
  bucketSizeMs: number;
  /** What a full lane stands for: the most Records any one value took in any one bucket. */
  tallestCount: number;
}

/** How many Records of one bucket took one value, and the lane that value has. */
interface LaneCount {
  point: CategorySeriesPoint;
  count: CategoryCount;
  /** The lane counted from the plot's top. */
  lane: number;
}

/** The Records of one bucket that took one value, as drawn. */
interface Mark {
  key: string;
  /** The value's lane, counted from the plot's top. */
  lane: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Every count the chart can draw, each with the lane it belongs in. Lanes come
 * from the Metric's type and counts from its Records, so a count matching no
 * lane is possible - and is dropped here, before the shared height scale is
 * taken, rather than painting above the plot at lane -1.
 */
function drawableCounts(buckets: CategorySeriesPoint[], lanes: ChartLane[]): LaneCount[] {
  return buckets
    .flatMap(point =>
      point.counts.map(count => ({
        point,
        count,
        lane: lanes.findIndex(lane => lane.value === count.value),
      })),
    )
    .filter(({lane}) => lane >= 0);
}

/**
 * The lower edge of a lane, counting lanes down from the plot's top - where the
 * first value's lane sits, so the lanes read in the order the Record form
 * presents the values.
 */
function laneFloor(lane: number, plot: PlotRect, laneHeight: number): number {
  return plot.top + (lane + 1) * laneHeight;
}

/** Every lane boundary, the plot's top and bottom edges included. */
function laneBoundaries(laneCount: number, plot: PlotRect, laneHeight: number): number[] {
  return Array.from({length: laneCount + 1}, (_, index) => plot.top + index * laneHeight);
}

/**
 * The scale every mark is drawn against: the largest count anywhere in the
 * series, which is what fills a lane. Per chart, as the Numeric chart's value
 * axis is - two metrics side by side keep their own scales.
 */
function tallestCountIn(drawable: LaneCount[]): number {
  return Math.max(...drawable.map(({count}) => count.count));
}

function toMark(
  {point, count: {value, count}, lane}: LaneCount,
  {plot, laneHeight, timeRange, bucketSizeMs, tallestCount}: Swimlane,
): Mark {
  const x = timeToX(point.x, timeRange, plot);
  const markHeight = Math.max(
    (count / tallestCount) * laneHeight - 2 * MARK_INSET,
    MIN_MARK_HEIGHT,
  );
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
