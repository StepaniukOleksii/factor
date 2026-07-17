import React from 'react';
import {type GestureResponderEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import {Canvas, Circle, LinearGradient, Path, Skia, type SkPath, vec} from '@shopify/react-native-skia';
import {MetricSeriesPoint, TimeRange} from '../../application/GetMetricSeriesUseCase';
import {NUMERIC_TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import type {ChartRendererProps} from './rendererRegistry';
import {COLORS, withAlpha} from '@presentation/theme';

// The curve and its fade are the section's only coloured elements, per the
// design, and reuse `primaryContainer` from the shared palette — no new colour
// is introduced here.
const LINE_COLOR = COLORS.primaryContainer;
const FILL_COLOR_TOP = withAlpha(COLORS.primaryContainer, 0.22);
const FILL_COLOR_BOTTOM = withAlpha(COLORS.primaryContainer, 0);
const STROKE_WIDTH = 2.5;
// Keeps the stroke off the top/bottom edges so peaks and troughs aren't clipped.
const VERTICAL_PADDING = 6;
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

/**
 * Renders a Numeric metric's aggregated series as a single smooth Skia curve
 * with a soft gradient fill fading out beneath it.
 *
 * The x axis is scaled across `timeRange` — the window the chart is drawn over —
 * so points sit at their true position in time; a series that stops in the middle
 * of the window ends in the middle of the chart rather than being stretched to the
 * right edge. The y axis is scaled across the points' min/max value. There are no
 * axes, gridlines, or legend. Fewer than two points cannot form a line, so an
 * "insufficient data" message is shown instead of a broken canvas.
 *
 * Each aggregated point is marked with a small dot so the underlying Records are
 * visible. Tapping a dot (or the curve near it) selects the point nearest the
 * tap's horizontal position and opens its Record via `onPointPress`, provided the
 * tap is also close enough to the curve vertically; taps in the empty space above
 * or below miss silently.
 */
export const NumericTrendChart = ({points, timeRange, width, height, onPointPress}: ChartRendererProps) => {
  if (points.length < 2) {
    return (
      <View style={[styles.insufficient, {height}]}>
        <Text style={styles.insufficientText}>{NUMERIC_TREND_INSUFFICIENT_MESSAGE}</Text>
      </View>
    );
  }

  const screenPoints = toScreenPoints(points, timeRange, width, height);
  const linePath = buildSmoothPath(screenPoints);
  const areaPath = buildAreaPath(linePath, screenPoints, height);

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
        <Path path={areaPath}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
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
      </Canvas>
    </Pressable>
  );
};

interface Point {
  x: number;
  y: number;
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
 * Takes the smooth line and closes it down to the canvas baseline, producing the
 * region beneath the curve that the gradient fills.
 */
function buildAreaPath(linePath: SkPath, screenPoints: Point[], height: number): SkPath {
  const areaPath = linePath.copy();
  const firstPoint = screenPoints[0];
  const lastPoint = screenPoints[screenPoints.length - 1];

  areaPath.lineTo(lastPoint.x, height);
  areaPath.lineTo(firstPoint.x, height);
  areaPath.close();

  return areaPath;
}

function toScreenPoints(points: MetricSeriesPoint[], timeRange: TimeRange, width: number, height: number): Point[] {
  const ys = points.map(p => p.y);
  // The x domain is the chart's time window, not the data's own span, so points
  // land at their real position in time and gaps before the first or after the
  // last Record stay visible instead of being scaled away.
  const minX = timeRange.start.getTime();
  const maxX = timeRange.end.getTime();
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY;
  const drawableHeight = height - VERTICAL_PADDING * 2;

  return points.map(point => ({
    x: ((point.x - minX) / xSpan) * width,
    // SVG/Skia y grows downward, so larger values map to smaller y (higher up).
    y: ySpan === 0
      ? height / 2
      : height - VERTICAL_PADDING - ((point.y - minY) / ySpan) * drawableHeight,
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
