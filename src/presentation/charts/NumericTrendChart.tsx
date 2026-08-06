import React from 'react';
import {type GestureResponderEvent, Pressable} from 'react-native';
import {
  Canvas,
  Circle,
  Line,
  LinearGradient,
  Path,
  Skia,
  type SkPath,
  Text as SkiaText,
  vec,
} from '@shopify/react-native-skia';
import {isNumericPoint, type NumericSeriesPoint, TimeRange,} from '../../application/GetMetricSeriesUseCase';
import {formatPointCount} from './chartDefaults';
import {getValueAxisTicks} from './axisTicks';
import {
  AXIS_LABEL_COLOR,
  baselineCentreOffset,
  GRIDLINE_COLOR,
  GRIDLINE_WIDTH,
  LABEL_GAP,
  measureWidth,
  type PlotRect,
  TimeAxisLabels,
  toPlotRect,
  useAxisFont,
} from './chartAxis';
import {InsufficientData} from './InsufficientData';
import type {ChartRendererProps} from './rendererRegistry';
import {COLORS, withAlpha} from '@presentation/theme';

// The section's only coloured elements, per the design. Reuses an existing
// palette token rather than introducing a chart-specific colour.
const LINE_COLOR = COLORS.primaryContainer;
const FILL_COLOR_TOP = withAlpha(COLORS.primaryContainer, 0.22);
const FILL_COLOR_BOTTOM = withAlpha(COLORS.primaryContainer, 0);
const STROKE_WIDTH = 2.5;
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

const VALUE_AXIS_TICK_COUNT = 5;

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
  const font = useAxisFont();

  // The registry pairs this renderer with the metric type whose reduction
  // produces numeric points, so this narrowing is what makes the code legal
  // rather than a case that can arise.
  const numericPoints = points.filter(isNumericPoint);
  if (numericPoints.length === 0) {
    return <InsufficientData height={height} />;
  }

  const plot = toPlotRect(width, height);
  const ys = numericPoints.map(point => point.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const screenPoints = toScreenPoints(numericPoints, timeRange, plot, minY, maxY);
  // A curve joins points to each other, and the gradient fills the region under
  // that curve - neither means anything with a single point, so a lone point is
  // left as its own marker on the axes rather than given a line to nowhere.
  const linePath = screenPoints.length > 1 ? buildSmoothPath(screenPoints) : null;
  const areaPath = linePath ? buildAreaPath(linePath, screenPoints, plot.bottom) : null;

  const valueTicks = getValueAxisTicks(minY, maxY, VALUE_AXIS_TICK_COUNT);

  const handlePress = (event: GestureResponderEvent) => {
    const {locationX, locationY} = event.nativeEvent;
    const nearestIndex = nearestPointIndex(screenPoints, locationX);
    if (Math.abs(screenPoints[nearestIndex].y - locationY) <= VERTICAL_TOLERANCE) {
      onPointPress(numericPoints[nearestIndex]);
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
                  x={plot.left - LABEL_GAP - measureWidth(font, tick.label)}
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
          const {recordId, recordCount} = numericPoints[index];
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
        <TimeAxisLabels font={font} timeRange={timeRange} plot={plot} />
      </Canvas>
    </Pressable>
  );
};

interface Point {
  x: number;
  y: number;
}

/**
 * Where a fraction of the way up the value axis lands on screen. The same
 * inversion `toScreenPoints` applies to the curve, so a gridline and the values
 * plotted against it line up.
 */
function valueRatioToY(ratio: number, plot: PlotRect): number {
  return plot.bottom - ratio * (plot.bottom - plot.top);
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
  points: NumericSeriesPoint[],
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
