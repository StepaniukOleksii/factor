import type React from 'react';
import type {Metric, MetricValueType} from '../../domain/Metric';
import type {MetricSeriesPoint, TimeRange} from '../../application/GetMetricSeriesUseCase';
import {NumericTrendChart} from './NumericTrendChart';

/**
 * The contract every chart renderer implements. Renderers own their drawing but
 * not their layout - the screen decides size and labelling.
 */
export interface ChartRendererProps {
  metric: Metric;
  points: MetricSeriesPoint[];
  /** The x-axis domain. Scaled across `[start, end)`, not across the data's own span. */
  timeRange: TimeRange;
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

/**
 * Chart renderers keyed by the `MetricValueType` they draw. Slices register
 * their renderer here rather than inventing their own per-type lookup.
 */
export const rendererRegistry = new Map<MetricValueType, ChartRenderer>();

rendererRegistry.set('Numeric', NumericTrendChart);
