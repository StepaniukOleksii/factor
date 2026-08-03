import React from 'react';
import {type GestureResponderEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  Canvas,
  Circle,
  Line,
  LinearGradient,
  Path,
  type SkFont,
  Skia,
  type SkPath,
  Text as SkiaText,
  useFont,
  vec,
} from '@shopify/react-native-skia';
// A `Canvas` cannot composite a platform `Text` element, so drawing glyphs needs
// a typeface Skia itself owns. Bundled with the app rather than matched from the
// system, so every device labels its axes identically.
import AXIS_TYPEFACE from '../../../assets/fonts/Roboto-Regular.ttf';
import {MetricSeriesPoint, TimeRange} from '../../application/GetMetricSeriesUseCase';
import {formatPointCount, NUMERIC_TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import {type AxisTick, getTimeAxisTicks, getValueAxisTicks} from './axisTicks';
import type {ChartRendererProps} from './rendererRegistry';
import {COLORS, withAlpha} from '@presentation/theme';

// The section's only coloured elements, per the design. Reuses an existing
// palette token rather than introducing a chart-specific colour.
const LINE_COLOR = COLORS.primaryContainer;
const FILL_COLOR_TOP = withAlpha(COLORS.primaryContainer, 0.22);
const FILL_COLOR_BOTTOM = withAlpha(COLORS.primaryContainer, 0);
const STROKE_WIDTH = 2.5;
// Keeps the stroke off the plot's top edge so peaks aren't clipped; the time
// label strip below does the same job for troughs.
const PLOT_TOP_PADDING = 6;
// A tap counts as hitting a point only if it falls within this many pixels of the
// curve vertically - a comfortable touch-target radius that still rejects taps in
// the empty space above or below the line.
const VERTICAL_TOLERANCE = 24;
// Without a marker the hit targets on a sparse curve are invisible. The halo
// takes the card's own colour so a dot reads as a node, not a bulge in the line.
const POINT_RADIUS = 2.5;
const POINT_HALO_RADIUS = 4;
const POINT_COLOR = LINE_COLOR;
const POINT_HALO_COLOR = COLORS.surfaceContainerLow;
// A point folding several Records names its count above itself. Faded below the
// axis labels' own colour: an annotation on the curve, not a second accent.
const POINT_COUNT_LABEL_COLOR = withAlpha(COLORS.onSurfaceVariant, 0.65);
// How far above a point's centre the label's baseline sits - clear of the halo,
// close enough to still read as belonging to that point.
const POINT_COUNT_LABEL_OFFSET = 9;

// Gutters carved out of the chart's `{width, height}` box to make room for the
// axis labels. What is left over is the plotting rectangle - everything the
// chart draws and hit-tests lives inside it.
const VALUE_AXIS_WIDTH = 24;
const TIME_AXIS_HEIGHT = 14;
// Holds the last time label and the final record marker off the card's right
// edge, the way the value gutter does on the left.
const PLOT_RIGHT_INSET = 4;
const VALUE_LABEL_GAP = 5;
const TIME_LABEL_BASELINE_OFFSET = 12;
const VALUE_AXIS_TICK_COUNT = 5;
const AXIS_FONT_SIZE = 9;
// Faint enough that the gridlines read as a reference behind the curve rather
// than a grid drawn over it.
const AXIS_LABEL_COLOR = COLORS.onSurfaceVariant;
const GRIDLINE_COLOR = withAlpha(COLORS.outlineVariant, 0.6);
const GRIDLINE_WIDTH = 1;

/**
 * Renders a Numeric metric's aggregated series as a smooth Skia curve with a
 * gradient fill beneath it.
 *
 * x is scaled across `timeRange`, not across the data's own span, so a series
 * that stops mid-window ends mid-chart. y is scaled per chart across this
 * series' min/max, so two metrics side by side keep their own value scales.
 *
 * What a tap *means* - opening a Record, or zooming into the bucket a point
 * aggregates - is the screen's decision; this reports the point and no more.
 */
export const NumericTrendChart = ({points, timeRange, width, height, onPointPress}: ChartRendererProps) => {
  // Ahead of the insufficient-data return so the hook order never varies. The
  // typeface resolves asynchronously, leaving this `null` for the first render
  // or two - the axis elements below wait for it while the curve does not, so a
  // chart is never blank while a font loads.
  const font = useFont(AXIS_TYPEFACE, AXIS_FONT_SIZE);

  if (points.length === 0) {
    return (
      <View style={[styles.insufficient, {height}]}>
        <Text style={styles.insufficientText}>{NUMERIC_TREND_INSUFFICIENT_MESSAGE}</Text>
      </View>
    );
  }

  const plot = toPlotRect(width, height);
  const ys = points.map(point => point.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const screenPoints = toScreenPoints(points, timeRange, plot, minY, maxY);
  // A curve joins points to each other, and the gradient fills the region under
  // that curve - neither means anything with a single point, so a lone point is
  // left as its own marker on the axes rather than given a line to nowhere.
  const linePath = screenPoints.length > 1 ? buildSmoothPath(screenPoints) : null;
  const areaPath = linePath ? buildAreaPath(linePath, screenPoints, plot.bottom) : null;

  const valueTicks = getValueAxisTicks(minY, maxY, VALUE_AXIS_TICK_COUNT);
  const timeTicks = getTimeAxisTicks(timeRange);

  const handlePress = (event: GestureResponderEvent) => {
    const {locationX, locationY} = event.nativeEvent;
    const nearestIndex = nearestPointIndex(screenPoints, locationX);
    if (Math.abs(screenPoints[nearestIndex].y - locationY) <= VERTICAL_TOLERANCE) {
      onPointPress(points[nearestIndex]);
    }
  };

  return (
    <Pressable testID="numeric-trend-chart-pressable" style={{width, height}} onPress={handlePress}>
      <Canvas style={{width, height}}>
        {font &&
          valueTicks.map(tick => {
            const y = valueRatioToY(tick.ratio, plot);
            return (
              <React.Fragment key={`value-${tick.ratio}`}>
                <Line
                  p1={vec(plot.left, y)}
                  p2={vec(plot.right, y)}
                  color={GRIDLINE_COLOR}
                  strokeWidth={GRIDLINE_WIDTH}
                />
                <SkiaText
                  font={font}
                  text={tick.label}
                  x={plot.left - VALUE_LABEL_GAP - measureWidth(font, tick.label)}
                  y={y + baselineCentreOffset(font)}
                  color={AXIS_LABEL_COLOR}
                />
              </React.Fragment>
            );
          })}
        {areaPath && (
          <Path path={areaPath}>
            <LinearGradient
              start={vec(0, plot.top)}
              end={vec(0, plot.bottom)}
              colors={[FILL_COLOR_TOP, FILL_COLOR_BOTTOM]}
            />
          </Path>
        )}
        {linePath && (
          <Path
            path={linePath}
            style="stroke"
            strokeWidth={STROKE_WIDTH}
            strokeJoin="round"
            strokeCap="round"
            color={LINE_COLOR}
          />
        )}
        {screenPoints.map((point, index) => {
          const {recordId, recordCount} = points[index];
          const countLabel = recordCount > 1 ? formatPointCount(recordCount) : null;
          return (
            <React.Fragment key={recordId}>
              <Circle cx={point.x} cy={point.y} r={POINT_HALO_RADIUS} color={POINT_HALO_COLOR} />
              <Circle cx={point.x} cy={point.y} r={POINT_RADIUS} color={POINT_COLOR} />
              {font && countLabel && (
                <SkiaText
                  font={font}
                  text={countLabel}
                  x={point.x - measureWidth(font, countLabel) / 2}
                  y={point.y - POINT_COUNT_LABEL_OFFSET}
                  color={POINT_COUNT_LABEL_COLOR}
                />
              )}
            </React.Fragment>
          );
        })}
        {font &&
          timeTicks.map(tick => (
            <SkiaText
              key={`time-${tick.ratio}`}
              font={font}
              text={tick.label}
              x={timeLabelX(tick, measureWidth(font, tick.label), plot)}
              y={plot.bottom + TIME_LABEL_BASELINE_OFFSET}
              color={AXIS_LABEL_COLOR}
            />
          ))}
      </Canvas>
    </Pressable>
  );
};

interface Point {
  x: number;
  y: number;
}

/** The chart's box less its label gutters: where the curve is actually drawn. */
interface PlotRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Carves the label gutters out of the chart's box. Clamped so a box too small
 * to hold them - a chart whose width hasn't been measured yet - collapses to an
 * empty rectangle rather than an inside-out one.
 */
function toPlotRect(width: number, height: number): PlotRect {
  return {
    left: VALUE_AXIS_WIDTH,
    top: PLOT_TOP_PADDING,
    right: Math.max(width - PLOT_RIGHT_INSET, VALUE_AXIS_WIDTH),
    bottom: Math.max(height - TIME_AXIS_HEIGHT, PLOT_TOP_PADDING),
  };
}

/**
 * Where a fraction of the way up the value axis lands on screen. The same
 * inversion `toScreenPoints` applies to the curve, so a gridline and the values
 * plotted against it line up.
 */
function valueRatioToY(ratio: number, plot: PlotRect): number {
  return plot.bottom - ratio * (plot.bottom - plot.top);
}

function measureWidth(font: SkFont, text: string): number {
  return font.measureText(text).width;
}

/**
 * How far below a label's baseline its visual middle sits, so a value label
 * centres on its gridline instead of resting on top of it. `ascent` is negative
 * (measured upward from the baseline) and `descent` positive.
 */
function baselineCentreOffset(font: SkFont): number {
  const {ascent, descent} = font.getMetrics();
  return -(ascent + descent) / 2;
}

/**
 * Where a time label starts, given how wide it is. Labels are centred on their
 * tick, except one sitting exactly at the range's start or end - those align
 * inwards from the plot's edge instead, so they don't overflow the card.
 */
function timeLabelX(tick: AxisTick, labelWidth: number, plot: PlotRect): number {
  if (tick.ratio <= 0) {
    return plot.left;
  }
  if (tick.ratio >= 1) {
    return plot.right - labelWidth;
  }
  return plot.left + tick.ratio * (plot.right - plot.left) - labelWidth / 2;
}

/**
 * Index of the screen point whose `x` is closest to `locationX`. Hit-testing is
 * horizontal-nearest rather than an exact hit on the drawn curve, since adjacent
 * points can sit only a few pixels apart. Ties keep the earlier (leftmost) point.
 */
function nearestPointIndex(screenPoints: Point[], locationX: number): number {
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  for (let i = 0; i < screenPoints.length; i++) {
    const distance = Math.abs(screenPoints[i].x - locationX);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }
  return nearestIndex;
}

/**
 * Builds a Catmull-Rom spline through the series (converted to cubic Bezier
 * segments) so the connecting line reads as a smooth curve rather than straight
 * segments. One `moveTo` starts the path; each remaining point adds one
 * `cubicTo`.
 */
function buildSmoothPath(screenPoints: Point[]): SkPath {
  const path = Skia.Path.Make();

  path.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 0; i < screenPoints.length - 1; i++) {
    const p0 = screenPoints[i - 1] ?? screenPoints[i];
    const p1 = screenPoints[i];
    const p2 = screenPoints[i + 1];
    const p3 = screenPoints[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  return path;
}

/**
 * Takes the smooth line and closes it down to the plot's baseline, producing the
 * region beneath the curve that the gradient fills.
 */
function buildAreaPath(linePath: SkPath, screenPoints: Point[], baselineY: number): SkPath {
  const areaPath = linePath.copy();
  const firstPoint = screenPoints[0];
  const lastPoint = screenPoints[screenPoints.length - 1];

  areaPath.lineTo(lastPoint.x, baselineY);
  areaPath.lineTo(firstPoint.x, baselineY);
  areaPath.close();

  return areaPath;
}

function toScreenPoints(
  points: MetricSeriesPoint[],
  timeRange: TimeRange,
  plot: PlotRect,
  minY: number,
  maxY: number,
): Point[] {
  // The x domain is the chart's time window, not the data's own span, so points
  // land at their real position in time and gaps before the first or after the
  // last Record stay visible instead of being scaled away.
  const minX = timeRange.start.getTime();
  const maxX = timeRange.end.getTime();

  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY;
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;

  return points.map(point => ({
    x: plot.left + ((point.x - minX) / xSpan) * plotWidth,
    // SVG/Skia y grows downward, so larger values map to smaller y (higher up).
    y: ySpan === 0
      ? plot.top + plotHeight / 2
      : plot.bottom - ((point.y - minY) / ySpan) * plotHeight,
  }));
}

const styles = StyleSheet.create({
  insufficient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientText: {
    color: COLORS.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
  },
});
