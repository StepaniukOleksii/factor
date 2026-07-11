import {MetricValueType} from '../../domain/Metric';

/**
 * Draws a metric's series onto the chart canvas.
 *
 * The concrete contract is intentionally left open: the visualization slice
 * that registers the first renderer will define it (line / tick / swimlane /
 * marker — see ADR-1). This slice only needs the interface to exist so the
 * registry can be typed.
 */
export interface ChartRenderer {}

/**
 * Chart renderers keyed by the `MetricValueType` they draw.
 *
 * Empty for now — later slices register their renderers here rather than
 * inventing their own per-type lookup.
 */
export const rendererRegistry = new Map<MetricValueType, ChartRenderer>();
