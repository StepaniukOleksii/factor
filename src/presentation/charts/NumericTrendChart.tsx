import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Canvas, LinearGradient, Path, Skia, type SkPath, vec} from '@shopify/react-native-skia';
import {MetricSeriesPoint} from '../../application/GetMetricSeriesUseCase';
import {NUMERIC_TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import type {ChartRendererProps} from './rendererRegistry';

// Matches the screen's `primary-container`; the curve and its fade are the
// section's only coloured elements, per the design. No new palette is introduced.
const LINE_COLOR = '#b6f09c';
const FILL_COLOR_TOP = 'rgba(182, 240, 156, 0.22)';
const FILL_COLOR_BOTTOM = 'rgba(182, 240, 156, 0)';
const STROKE_WIDTH = 2.5;
// Keeps the stroke off the top/bottom edges so peaks and troughs aren't clipped.
const VERTICAL_PADDING = 6;

/**
 * Renders a Numeric metric's aggregated series as a single smooth Skia curve
 * with a soft gradient fill fading out beneath it.
 *
 * The x axis is scaled across the span of the provided points and the y axis
 * across their min/max value; there are no axes, gridlines, or legend. Fewer
 * than two points cannot form a line, so an "insufficient data" message is
 * shown instead of a broken canvas.
 */
export const NumericTrendChart = ({points, width, height}: ChartRendererProps) => {
  if (points.length < 2) {
    return (
      <View style={[styles.insufficient, {height}]}>
        <Text style={styles.insufficientText}>{NUMERIC_TREND_INSUFFICIENT_MESSAGE}</Text>
      </View>
    );
  }

  const screenPoints = toScreenPoints(points, width, height);
  const linePath = buildSmoothPath(screenPoints);
  const areaPath = buildAreaPath(linePath, screenPoints, height);

  return (
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
    </Canvas>
  );
};

interface Point {
  x: number;
  y: number;
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

function toScreenPoints(points: MetricSeriesPoint[], width: number, height: number): Point[] {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
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
    color: '#c2c9b9',
    fontSize: 12,
    fontWeight: '500',
  },
});
