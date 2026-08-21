import type React from 'react';
import type {Metric, MetricValueType} from '../../domain/Metric';
import type {AggregationStrategy, MetricSeriesPoint, TimeRange,} from '../../application/GetMetricSeriesUseCase';
import {NumericTrendChart} from './NumericTrendChart';
import {CategorySwimlaneChart} from './CategorySwimlaneChart';
import {TextMarkerChart} from './TextMarkerChart';
import {swimlaneCardHeight} from './chartLanes';

/**
 * The contract every chart renderer implements. Renderers own their drawing but
 * not their layout - the screen decides size and labelling.
 */
export interface ChartRendererProps {
  metric: Metric;
  points: MetricSeriesPoint[];
  /** The x-axis domain. Scaled across `[start, end)`, not across the data's own span. */
  timeRange: TimeRange;
  /**
   * How the points were bucketed. A renderer drawing a point as an interval
   * rather than a dot needs the bucket's span, which the gaps between points
   * cannot give it: on a metric that skips buckets they are multiples of it.
   */
  aggregation: AggregationStrategy;
  width: number;
  height: number;
  /**
   * Reports which point was hit and nothing more - what the tap *means* is the
   * screen's decision. Renderers with no tappable state never call it.
   */
  onPointPress: (point: MetricSeriesPoint) => void;
}

/**
 * Draws a metric's series onto the chart canvas. A plain React component so it
 * composes with the rest of the presentation layer.
 */
export type ChartRenderer = React.ComponentType<ChartRendererProps>;

export interface ChartRegistration {
  renderer: ChartRenderer;
  /**
   * A card's width is the screen's column to decide, but how much room a drawing
   * needs belongs to the drawing - so its height is declared here rather than by
   * the screen.
   *
   * Answered from the Metric and never from its series: the screen needs a
   * height before it knows whether there is anything to draw, the `Not enough
   * data yet` placeholder standing in a box of the same size, and a height that
   * moved with the data would reflow the whole column at every change of window.
   */
  cardHeight: (metric: Metric) => number;
}

// Tall enough that the plotted curve keeps roughly the room it had before the
// chart started reserving a strip along its bottom edge for time labels.
const NUMERIC_CARD_HEIGHT = 108;
// The top padding, the time-label strip, and a 20px band between them: the
// halo's 8px with room above it for a count label, which is the only thing a
// marker card needs vertical space it does not occupy.
const MARKER_CARD_HEIGHT = 40;

/**
 * Chart renderers keyed by the `MetricValueType` they draw. Slices register
 * their renderer here rather than inventing their own per-type lookup.
 */
export const rendererRegistry = new Map<MetricValueType, ChartRegistration>();

rendererRegistry.set('Numeric', {renderer: NumericTrendChart, cardHeight: () => NUMERIC_CARD_HEIGHT});
rendererRegistry.set('Enum', {renderer: CategorySwimlaneChart, cardHeight: swimlaneCardHeight});
rendererRegistry.set('Boolean', {renderer: CategorySwimlaneChart, cardHeight: swimlaneCardHeight});
rendererRegistry.set('Text', {renderer: TextMarkerChart, cardHeight: () => MARKER_CARD_HEIGHT});
