# ADR-7: Swimlane tap target

## Context

[ADR-5](5-chart-tap-hit-testing-tolerance.md) settled how much of a chart belongs to a point, and closed by
requiring that a renderer added later hit-test against the same 48x48px box *or state why its marks are
different*. The swimlane's are: it draws a bucket as a column of up to four marks, one per value the
bucket's Records took, stacked in lanes down the plot, where a Numeric chart draws a single dot. So a
swimlane can be asked a question a line chart cannot — which mark did you mean — and this settles the
answer.

Two facts bound it. A category series point carries per-value *counts* and no per-value Record identity: the
id and timestamps on it belong to the bucket as a whole. And the window every card is drawn over is one
shared `TimeRange`, chosen once for the section ([Trend Charting](../features/trend-charting.md)), not a
per-card or per-value scope.

What a tap *means* stays the screen's, unchanged
([Trend Exploration](../features/trend-exploration.md)) — this settles only what the renderer reports, and
from where.

## Alternatives

1. **A lane is its own target, narrowing the card to that value.** The reading that uses what a swimlane has
   and a line chart does not. Ruled out because there is no per-value scope to narrow into: a window is a
   `TimeRange` shared by every card, so the choice is between filtering every card by a value only one of
   them has, and giving one card a private scope that breaks the guarantee that Metrics are read over the
   same span. Both are larger features than a tap target, and both fork what exploration means by renderer.
2. **A lane is its own target, opening the Record behind a single-Record mark.** Ruled out twice over. It
   needs per-value Record identity threaded through the series, where today a bucket's identity is the
   bucket's. And it puts two meanings — the mark, and the empty space above it — inside a lane 22px tall on
   a three-lane card, under the platform's minimum touch target; a tap would then mean different things
   depending on how tall a mark happened to be drawn, which follows from the card's busiest bucket rather
   than from anything the user chose.
3. **The bucket column.** Chosen.

## Decision

A tap is answered by the bucket whose column is nearest it horizontally, and the renderer reports that
bucket's whole series point. Which lane the tap landed in is discarded: every mark in a column stands for
Records of the same bucket, so the lane adds no identity the point does not already carry.

The geometry is ADR-5's — same nearest-then-check shape, same helper, same 24px — with two changes. The
target is centred on the middle of the drawn bar rather than on the point's `x`, because `point.x` is the
bucket's *start*: where a Numeric chart puts its dot, but only where a swimlane's bar begins, which at the
seven day-buckets of `1W` would leave the right 40% of a visible ~41px mark outside its own target. And the
vertical axis is not tested, a column occupying the plot's whole height, with no single mark whose height it
could be measured from.

Only buckets that drew a mark are candidates, and ties keep the earlier column.

## Trade-offs

Benefits: one rule and one tolerance across both renderers, and the screen's handler and the series data
both untouched — so exploration means the same thing on either card, and a lane-level meaning stays
available to a later slice that has a reason and the data for one.

Cost: **which value a tap landed on is thrown away.** A bucket mixing values is separated by zooming into it
in time, and at a window already down to a single day it cannot be separated at all — the same resting point
the Numeric ladder comes to, reached the same way.

## Consequences

* A renderer added after this one follows ADR-5's box or this variant of it, and says which.
* **The 48px target contains the drawn bar only while a bucket is drawn no wider than 48px.** The widest the
  app produces today is `1W`'s seven day-buckets, at about 41px; every other window is narrower, a custom
  range being bucketed into roughly thirty. A window drawn with fewer than about six buckets would put the
  ends of its own marks outside their target, and is what reopens the anchor. Nothing enforces that ceiling
  in code — it is a property of the bucket counts
  [Trend Time Range Selection](../features/trend-time-range-selection.md) can produce.
* An E2E tap on a swimlane is aimed at a column's middle rather than at its leading edge, derived from the
  fixture's bucket grid like any other chart tap
  ([testing-android-e2e.md](../../testing-android-e2e.md)).
* Should per-value Record identity ever be added to a category series, a lane-level meaning can layer on top
  of this rather than replace it — the column remains the answer for a tap that hits no mark.
