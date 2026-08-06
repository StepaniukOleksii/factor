/**
 * The ordinal colour ramp a swimlane chart paints its lanes with: one hue over
 * the app's existing green, darkest at the first-declared value and lightest at
 * the last, so a lane's colour says where in the declared order it sits.
 *
 * The greens stay here rather than joining `COLORS`: they encode one chart's
 * ordinal scale, and nothing else in the app has an ordinal scale to share them
 * with. Every ramp spans the same endpoints - a dim end holding 4.22:1 against
 * `surfaceContainerLow`, and `COLORS.primaryContainer` exactly - in fewer steps
 * than the five-step ramp they were sampled from.
 */
const LANE_RAMPS: Readonly<Record<number, readonly string[]>> = {
  2: ['#5a8a45', '#b6f09c'],
  3: ['#5a8a45', '#86bd68', '#b6f09c'],
  4: ['#5a8a45', '#75a85b', '#95ce79', '#b6f09c'],
};

const FALLBACK_LANE_COUNT = 4;

/**
 * The ramp for `laneCount` lanes, bottom lane first. `METRIC_ENUM_MAX_VALUES`
 * keeps a real chart within 2 to 4, so any other count falls back to the widest
 * ramp rather than throwing: a chart is not worth crashing a screen over.
 */
export function getLaneColors(laneCount: number): readonly string[] {
  return LANE_RAMPS[laneCount] ?? LANE_RAMPS[FALLBACK_LANE_COUNT];
}
