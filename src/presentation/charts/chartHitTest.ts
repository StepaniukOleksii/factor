// A tap counts as hitting a mark only if it falls within this many pixels of it
// on each axis the renderer tests, which puts a 48x48px box around a Numeric
// point and a 48px-wide band around a swimlane column - the platform's minimum
// touch target, and what leaves the empty stretches of a chart inert however few
// marks it draws (ADR-5, ADR-7). One constant for every renderer, so two cards
// under one window cannot answer the same gesture differently.
export const TAP_TOLERANCE = 24;

/**
 * Index of the candidate whose `x` is closest to `locationX`, ties keeping the
 * earlier (leftmost) one. Nearest rather than an exact hit on what was drawn,
 * since adjacent marks can sit only a few pixels apart; whether that nearest
 * candidate is close enough to have been meant is the caller's tolerance to
 * apply, on whichever axes its marks have.
 */
export function nearestPointIndex(candidates: {x: number}[], locationX: number): number {
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const distance = Math.abs(candidates[i].x - locationX);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }
  return nearestIndex;
}
