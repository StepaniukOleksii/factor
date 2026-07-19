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
import {NUMERIC_TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import {type AxisTick, getTimeAxisTicks, getValueAxisTicks} from './axisTicks';
import type {ChartRendererProps} from './rendererRegistry';
import {COLORS, withAlpha} from '@presentation/theme';

// The curve and its fade are the section's only coloured elements, per the
// design, and reuse `primaryContainer` from the shared palette — no new colour
// is introduced here.
const LINE_COLOR = COLORS.primaryContainer;
const FILL_COLOR_TOP = withAlpha(COLORS.primaryContainer, 0.22);
const FILL_COLOR_BOTTOM = withAlpha(COLORS.primaryContainer, 0);
const STROKE_WIDTH = 2.5;
// Keeps the stroke off the plot's top edge so peaks aren't clipped; the time
// label strip below does the same job for troughs.
const PLOT_TOP_PADDING = 6;
// A tap counts as hitting a point only if it falls within this many pixels of the
// curve vertically — a comfortable touch-target radius that still rejects taps in
// the empty space above or below the line.
const VERTICAL_TOLERANCE = 24;
// A small marker is drawn at each aggregated point so the tappable Records are
// visible and users know where to aim — otherwise, on a sparse curve, the actual
// hit targets are invisible. The dot reuses the line colour; a halo in the trend
// card's own colour rings it so it reads as a distinct node, not a bulge in the
// line.
const POINT_RADIUS = 2.5;
const POINT_HALO_RADIUS = 4;
const POINT_COLOR = LINE_COLOR;
const POINT_HALO_COLOR = COLORS.surfaceContainerLow;

// Gutters carved out of the chart's `{width, height}` box to make room for the
// axis labels. What is left over is the plotting rectangle — everything the
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
// The muted text colour the "Not enough data yet" placeholder already uses, and
// a gridline faint enough to read as a reference behind the curve rather than a
// grid drawn over it — neither introduces a colour the palette doesn't have.
const AXIS_LABEL_COLOR = COLORS.onSurfaceVariant;
const GRIDLINE_COLOR = withAlpha(COLORS.outlineVariant, 0.6);
const GRIDLINE_WIDTH = 1;

/**
 * Renders a Numeric metric's aggregated series as a single smooth Skia curve
 * with a soft gradient fill fading out beneath it.
 *
 * The x axis is scaled across `timeRange` — the window the chart is drawn over —
 * so points sit at their true position in time; a series that stops in the middle
 * of the window ends in the middle of the chart rather than being stretched to the
 * right edge. The y axis is scaled across the points' min/max value, per chart:
 * two metrics side by side keep their own value scales rather than sharing one.
 * Fewer than two points cannot form a line, so an "insufficient data" message is
 * shown instead of a broken canvas.
 *
 * Both scales are labelled: a row of time labels along the bottom, whose format
 * and count follow the window's span (see `axisTicks`), and a column of value
 * labels down the left, each paired with a faint horizontal gridline. There are
 * no vertical gridlines and no legend — the curve stays the dominant element.
 *
 * Each aggregated point is marked with a small dot so the underlying Records are
 * visible. Tapping a dot (or the curve near it) selects the point nearest the
 * tap's horizontal position and opens its Record via `onPointPress`, provided the
 * tap is also close enough to the curve vertically; taps in the empty space above
 * or below miss silently.
 */
export const NumericTrendChart = ({points, timeRange, width, height, onPointPress}: ChartRendererProps) => {
  // Ahead of the insufficient-data return so the hook order never varies. The
  // typeface resolves asynchronously, leaving this `null` for the first render
  // or two — the axis elements below wait for it while the curve does not, so a
  // chart is never blank while a font loads.
  const font = useFont(AXIS_TYPEFACE, AXIS_FONT_SIZE);

  if (points.length < 2) {
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
  const linePath = buildSmoothPath(screenPoints);
  const areaPath = buildAreaPath(linePath, screenPoints, plot.bottom);

  // Both axes come from what the chart is already drawing — this series' value
  // range and this chart's window — so they follow the curve automatically
  // whenever either changes.
  const valueTicks = getValueAxisTicks(minY, maxY, VALUE_AXIS_TICK_COUNT);
  const timeTicks = getTimeAxisTicks(timeRange);

  const handlePress = (event: GestureResponderEvent) => {
    const {locationX, locationY} = event.nativeEvent;
    const nearestIndex = nearestPointIndex(screenPoints, locationX);
    if (Math.abs(screenPoints[nearestIndex].y - locationY) <= VERTICAL_TOLERANCE) {
      onPointPress(points[nearestIndex].recordId);
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
        <Path path={areaPath}>
          <LinearGradient
            start={vec(0, plot.top)}
            end={vec(0, plot.bottom)}
            colors={[FILL_COLOR_TOP, FILL_COLOR_BOTTOM]}
          />
        </Path>
        <Path
          path={linePath}
          style="stroke"
          strokeWidth={STROKE_WIDTH}
          strokeJoin="round"
          strokeCap="round"
          color={LINE_COLOR}
        />
        {screenPoints.map((point, index) => (
          <React.Fragment key={points[index].recordId}>
            <Circle cx={point.x} cy={point.y} r={POINT_HALO_RADIUS} color={POINT_HALO_COLOR} />
            <Circle cx={point.x} cy={point.y} r={POINT_RADIUS} color={POINT_COLOR} />
          </React.Fragment>
        ))}
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
 * to hold them — a chart whose width hasn't been measured yet — collapses to an
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
 * tick, except one sitting exactly at the range's start or end — those align
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
