import React from 'react';
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
 * It ships inert - neither `metric` nor `onPointPress` is used and no `Pressable`
 * wraps the canvas, so a tap passes through to the scroll view beneath. ADR-7
 * asks a renderer which tap target it takes: this one takes none. A marker does
 * carry a bucket's identity, so one could be defined - but a mark holds nothing
 * a tap could reveal that opening the Record would not show better.
 */
export const TextMarkerChart = ({points, timeRange, width, height}: ChartRendererProps) => {
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

  return (
    <Canvas style={{width, height}}>
      <Line
        p1={vec(plot.left, markY)}
        p2={vec(plot.right, markY)}
        color={GRIDLINE_COLOR}
        strokeWidth={GRIDLINE_WIDTH}
      />
      {markers.map(({recordId, recordCount, x}) => {
        const markX = timeToX(x, timeRange, plot);
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
  );
};
