import type {EnumConstraint, Metric} from '../../domain/Metric';
import {BOOLEAN_METRIC_OPTIONS, toEnumOptions} from '../metricDisplay';

/** One lane of a swimlane chart. */
export interface ChartLane {
  /** The canonical string a series' counts name this lane's value by. */
  value: string;
  /** The word the Record form's own control offers for that value. */
  label: string;
}

/**
 * The lanes a Metric's swimlane is divided into, top lane first - so a lane's
 * index is both its position counted down from the plot's top and its entry in
 * `getLaneColors`, exactly as a declared index is.
 *
 * Both types hand over the list the Record form presents, so the chart and the
 * form cannot disagree about either the order or the words. A Boolean Metric's
 * pair comes from its type rather than from `metric.constraint`, which it has
 * none of.
 *
 * A type no renderer draws has no lanes, so a Metric one is handed anyway falls
 * to the placeholder rather than dividing its plot into zero lanes.
 */
export function getChartLanes(metric: Metric): ChartLane[] {
  switch (metric.type) {
    case 'Enum':
      return toEnumOptions(metric.constraint as EnumConstraint | null);
    case 'Boolean':
      return BOOLEAN_METRIC_OPTIONS.map(({value, label}) => ({value: String(value), label}));
    default:
      return [];
  }
}
