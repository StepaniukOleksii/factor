import React from 'react';
import {type GestureResponderEvent, Pressable} from 'react-native';
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
  spanToWidth,
  TimeAxisLabels,
  timeToX,
  toPlotRect,
  truncateToWidth,
  useAxisFont,
} from './chartAxis';
import {type ChartLane, getChartLanes} from './chartLanes';
import {nearestPointIndex, TAP_TOLERANCE} from './chartHitTest';
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
 * A tap is answered by the bucket whose column it is nearest horizontally, and
 * the whole of that bucket's point is reported: which lane it landed in says
 * nothing a column does not already carry, so it is discarded, and the vertical
 * axis is not tested at all (ADR-7). What a tap *means* - opening a Record, or
 * narrowing the section onto the Records behind a column - is the screen's
 * decision, as it is for the Numeric card.
 */
export const CategorySwimlaneChart = ({
  metric,
  points,
  timeRange,
  aggregation,
  width,
  height,
  onPointPress,
}: ChartRendererProps) => {
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
  const columns = toColumns(drawable, swimlane);

  const handlePress = ({nativeEvent: {locationX}}: GestureResponderEvent) => {
    const nearest = columns[nearestPointIndex(columns, locationX)];
    // A card whose every count matched no lane draws its lanes and no column at
    // all, leaving nothing for a tap to be near.
    if (nearest && Math.abs(nearest.x - locationX) <= TAP_TOLERANCE) {
      onPointPress(nearest.point);
    }
  };

  return (
    <Pressable testID="category-swimlane-chart-pressable" style={{width, height}} onPress={handlePress}>
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
    </Pressable>
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

/** The horizontal extent every mark of one bucket shares. */
interface Bar {
  x: number;
  width: number;
}

/** The Records of one bucket that took one value, as drawn. */
interface Mark extends Bar {
  key: string;
  /** The value's lane, counted from the plot's top. */
  lane: number;
  y: number;
  height: number;
}

/** A bucket as a tap is tested against it: the middle of the bar drawn for it. */
interface Column {
  point: CategorySeriesPoint;
  x: number;
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

function toMark({point, count: {value, count}, lane}: LaneCount, swimlane: Swimlane): Mark {
  const {plot, laneHeight, tallestCount} = swimlane;
  const markHeight = Math.max(
    (count / tallestCount) * (laneHeight - 2 * MARK_INSET),
    MIN_MARK_HEIGHT,
  );
  return {
    key: `${point.x}-${value}`,
    lane,
    ...toBar(point, swimlane),
    y: laneFloor(lane, plot, laneHeight) - MARK_INSET - markHeight,
    height: markHeight,
  };
}

/**
 * Where a bucket is drawn across the plot, which its marks and its tap target
 * are both measured from - one derivation rather than two that could be clipped
 * differently.
 */
function toBar(point: CategorySeriesPoint, {plot, timeRange, bucketSizeMs}: Swimlane): Bar {
  const x = timeToX(point.x, timeRange, plot);
  return {
    x,
    // The window may end mid-bucket, so the newest mark is cut off at the plot's
    // right edge rather than drawn past it.
    width: Math.min(
      Math.max(spanToWidth(bucketSizeMs, timeRange, plot) - MARK_GAP, MIN_MARK_WIDTH),
      plot.right - x,
    ),
  };
}

/**
 * The middle of every column drawn, in bucket order. Centred on the bar rather
 * than anchored to the bucket's own start, so the far end of a wide column is
 * inside its target as much as the near end is (ADR-7). Built from the counts
 * the chart could draw rather than from the buckets, which is what keeps a
 * bucket whose values matched no lane - and which drew nothing - from being one.
 */
function toColumns(drawable: LaneCount[], swimlane: Swimlane): Column[] {
  const columns = new Map<CategorySeriesPoint, Column>();
  for (const {point} of drawable) {
    if (!columns.has(point)) {
      const {x, width} = toBar(point, swimlane);
      columns.set(point, {point, x: x + width / 2});
    }
  }
  return [...columns.values()];
}

/** Clamped to half the smaller side, so a thin mark reads as a bar and not a lozenge. */
function cornerRadius(markWidth: number, markHeight: number): number {
  return Math.min(MARK_CORNER_RADIUS, Math.min(markWidth, markHeight) / 2);
}
