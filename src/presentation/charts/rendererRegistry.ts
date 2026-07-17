import type React from 'react';
import type {Metric, MetricValueType} from '../../domain/Metric';
import type {MetricSeriesPoint} from '../../application/GetMetricSeriesUseCase';
import {NumericTrendChart} from './NumericTrendChart';

/**
 * Props every chart renderer receives: the metric being drawn, its aggregated
 * series, and the pixel box to draw within. Renderers own their drawing but not
 * their layout — the screen decides size and labelling.
 *
 * `onPointPress` is invoked with the `recordId` of a tapped series point so the
 * screen can open that Record's detail view; renderers with no tappable state
 * (e.g. an insufficient-data placeholder) simply never call it.
 */
export interface ChartRendererProps {
  metric: Metric;
  points: MetricSeriesPoint[];
  width: number;
  height: number;
  onPointPress: (recordId: string) => void;
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
