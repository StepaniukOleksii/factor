import type {EnumConstraint, Metric} from '../../domain/Metric';
import {BOOLEAN_METRIC_OPTIONS, toEnumOptions} from '../metricDisplay';
import {PLOT_TOP_PADDING, TIME_AXIS_HEIGHT} from './chartAxis';

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
 * How tall one lane stands, on every swimlane whatever Metric it draws. Fixed
 * rather than a share of the card, so a mark of a given height stands for the
 * same share of a lane wherever it is drawn.
 *
 * 32px leaves 26px between a lane's insets against the 3px `MIN_MARK_HEIGHT`
 * floor, the least in which a mark still reads as tall or short.
 */
export const SWIMLANE_LANE_HEIGHT = 32;

/**
 * The fewest lanes a card is sized for. A Metric with no lanes at all draws the
 * placeholder instead, which this gives the shortest legitimate swimlane box
 * rather than a sliver; two is also the fewest a drawn card can carry, a Choice
 * declaring at least two and a Yes/No exactly two.
 */
const MIN_SWIMLANE_LANES = 2;

/**
 * How tall a card carrying `metric`'s swimlane stands: its lanes, plus the
 * padding and time-label strip `toPlotRect` carves back out, so the plot divides
 * to exactly one `SWIMLANE_LANE_HEIGHT` per lane.
 */
export function swimlaneCardHeight(metric: Metric): number {
  const laneCount = Math.max(getChartLanes(metric).length, MIN_SWIMLANE_LANES);
  return PLOT_TOP_PADDING + laneCount * SWIMLANE_LANE_HEIGHT + TIME_AXIS_HEIGHT;
}
