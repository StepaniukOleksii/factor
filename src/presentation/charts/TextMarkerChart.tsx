import React from 'react';
import {type GestureResponderEvent, Pressable} from 'react-native';
import {Canvas, Circle, Line, Text as SkiaText, vec} from '@shopify/react-native-skia';
import {isMarkerPoint} from '../../application/GetMetricSeriesUseCase';
import {formatPointCount} from './chartDefaults';
import {
  GRIDLINE_COLOR,
  GRIDLINE_WIDTH,
  measureWidth,
  POINT_COUNT_LABEL_COLOR,
  TimeAxisLabels,
  timeToX,
  toPlotRect,
  useAxisFont,
} from './chartAxis';
import {nearestPointIndex, TAP_TOLERANCE} from './chartHitTest';
import {InsufficientData} from './InsufficientData';
import type {ChartRendererProps} from './rendererRegistry';
import {COLORS} from '@presentation/theme';

// Deliberately the Numeric card's own dot, at its size and its colour. Its halo
// takes the card's background, so a mark reads as a node on the rule rather than
// a bulge in it.
const POINT_RADIUS = 2.5;
const POINT_HALO_RADIUS = 4;
const MARK_COLOR = COLORS.primaryContainer;
const MARK_HALO_COLOR = COLORS.surfaceContainerLow;
// Below the Numeric card's 9, which clears a halo sitting on a curve where this
// one sits on a rule. The card's height is measured from it, so a larger offset
// would lift the glyphs off the top of the canvas.
const COUNT_LABEL_OFFSET = 7;

/**
 * Renders a Text metric's series as one mark per bucket that holds something
 * written, on a rule across the middle of the plot. Every mark is the same size
 * whatever its bucket holds: the card says when text was entered, never what,
 * which is the most a bucket folding several Records could honestly say.
 *
 * A tap is answered by the mark nearest it horizontally, accepted within
 * `TAP_TOLERANCE` on both axes - ADR-5's box taken whole, a marker being a dot
 * drawn on its bucket's start where a Numeric point is, rather than a bar
 * spanning the bucket like a swimlane's (ADR-7). What a tap *means* - opening a
 * Record, or narrowing the section onto the Records behind a mark - is the
 * screen's decision, as it is for the other two cards. Since a mark carries no
 * text to tell one Record from another, narrowing is the only way this card
 * separates the Records it folds.
 */
export const TextMarkerChart = ({points, timeRange, width, height, onPointPress}: ChartRendererProps) => {
  // Ahead of the insufficient-data return so the hook order never varies.
  const font = useAxisFont();

  // The registry pairs this renderer with the metric type whose reduction
  // produces marker points, so this narrowing is what makes the code legal
  // rather than a case that can arise.
  const markers = points.filter(isMarkerPoint);
  if (markers.length === 0) {
    return <InsufficientData height={height} />;
  }

  // The gutter comes with the plot, so this card starts on the same left edge as
  // the rest of the column - and goes unlabelled, there being neither a value
  // axis here nor lanes to name.
  const plot = toPlotRect(width, height);
  const markY = (plot.top + plot.bottom) / 2;
  // Where every mark is drawn, taken once so the drawing and the hit test cannot
  // read the series through two derivations of the same scale.
  const marks = markers.map(point => ({point, x: timeToX(point.x, timeRange, plot)}));

  const handlePress = ({nativeEvent: {locationX, locationY}}: GestureResponderEvent) => {
    const nearest = marks[nearestPointIndex(marks, locationX)];
    if (
      Math.abs(nearest.x - locationX) <= TAP_TOLERANCE &&
      // Excludes nothing at the height the registry draws this card at: the rule
      // sits 16px down 40px, leaving the bottom edge exactly TAP_TOLERANCE away.
      // Tested rather than dropped because a taller card would clip its own edges.
      Math.abs(markY - locationY) <= TAP_TOLERANCE
    ) {
      onPointPress(nearest.point);
    }
  };

  return (
    <Pressable testID="text-marker-chart-pressable" style={{width, height}} onPress={handlePress}>
      <Canvas style={{width, height}}>
        <Line
          p1={vec(plot.left, markY)}
          p2={vec(plot.right, markY)}
          color={GRIDLINE_COLOR}
          strokeWidth={GRIDLINE_WIDTH}
        />
        {marks.map(({point: {recordId, recordCount}, x: markX}) => {
          const countLabel = recordCount > 1 ? formatPointCount(recordCount) : null;
          return (
            <React.Fragment key={recordId}>
              <Circle cx={markX} cy={markY} r={POINT_HALO_RADIUS} color={MARK_HALO_COLOR} />
              <Circle cx={markX} cy={markY} r={POINT_RADIUS} color={MARK_COLOR} />
              {font && countLabel && (
                <SkiaText
                  font={font}
                  text={countLabel}
                  x={markX - measureWidth(font, countLabel) / 2}
                  y={markY - COUNT_LABEL_OFFSET}
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
