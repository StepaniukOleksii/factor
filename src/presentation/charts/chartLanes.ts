import type {EnumConstraint, Metric} from '../../domain/Metric';
import {BOOLEAN_METRIC_OPTIONS, toEnumOptions} from '../metricDisplay';

/**
 * Wide enough for the longest word a Boolean Metric can label a lane with: `Yes`
 * measures 15px at the axis size against the 19px this leaves once the label's
 * gap from the plot is taken. The same width the Numeric chart gives its value
 * labels, so a Boolean plot starts where a Numeric one does.
 */
const FIXED_LABEL_GUTTER = 24;

/**
 * An Enum value runs to `METRIC_ENUM_VALUE_MAX_LENGTH` characters, and no gutter
 * a card can spare holds twelve of them - this is the width that buys the
 * shorter ones their extra characters, past which `truncateToWidth` takes over.
 */
const DECLARED_LABEL_GUTTER = 48;

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

/**
 * How wide a gutter this Metric's lane labels need. Answered from the type
 * rather than from the labels themselves: the typeface resolves a render or two
 * after the chart first draws, and a gutter measured from it would move the plot
 * out from under the marks when it did.
 */
export function getLaneLabelGutter(metric: Metric): number {
  return metric.type === 'Boolean' ? FIXED_LABEL_GUTTER : DECLARED_LABEL_GUTTER;
}
