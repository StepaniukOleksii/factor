# Chart Tap Tolerance

* 2026-08-15
* Feature: trend-exploration.md

## 1. Goal

A tap on a Numeric chart reaches a point however far away it is: hit-testing takes the nearest point by x with
no horizontal bound and rejects only on vertical distance, so a chart drawing one dot hands most of its canvas
to that dot. Bound the tap horizontally as well, so a chart acts only where a point is.

This deliberately narrows what [Trend Exploration](../../features/trend-exploration.md) describes today — that
sentence is accurate about the code, and is what makes the defect possible. The feature file is rewritten from
this spec once the slice ships.

## 2. Requirements

* A tap lands on a point only when it falls within one tolerance of that point on **both** axes, the same
  distance for each.
* A tap landing on nothing is reported to nobody: no Record opens, no window narrows, nothing on screen changes.
* Which point a tap is tested against is unchanged — the nearest by x, ties keeping the earlier one.
* The rule holds whatever the chart draws: a single-point chart's dot owns the same area as one point of thirty.
* Enum and Boolean swimlanes are untouched, still reporting no point at all.

## 3. Technical Design

The whole change is the press handler in `src/presentation/charts/NumericTrendChart.tsx`: `VERTICAL_TOLERANCE`
becomes `TAP_TOLERANCE`, still 24, and the handler compares the tap against the nearest point's `x` as well as
its `y`. [ADR-5](../../adr/5-chart-tap-hit-testing-tolerance.md) records why one constant per axis rather than a
bucket-relative slab. `nearestPointIndex` keeps its behaviour, tie-break included; only its doc comment changes,
since it currently explains the *absence* of a horizontal bound. Nothing else moves — the `Pressable`, the
renderer contract, `CategorySwimlaneChart` and `ObservationDetailsScreen.handleChartPointPress` are all as they
were — and nothing drawn changes, so the slice has no mockup.

**The constant stays in `NumericTrendChart.tsx`** rather than moving to a shared chart module. The swimlane's
own tap is the next slice and will want the same number, but what a swimlane hit-tests *against* — a bucket
column rather than a point — is unsettled, so the shared home is better carved out by the slice that can see
both callers.

Two documents state the old behaviour and are corrected with the code:
[testing-data.md](../../../testing-data.md)'s `stale records` checklist tells the reader to "tap the middle of
the chart", which will do nothing, and [testing-android-e2e.md](../../../testing-android-e2e.md) gains the
flow-writing rule the E2E section states.

## 4. Verification

### Seed Data

None added. `stale records` already draws a single dot standing for four Records, and `mixed metrics`'
`insufficient` one standing for one — the two shapes where a horizontal bound is the whole of what decides a tap.

### Manual Verification

Reseed test data first.

1. **`stale records` at `1Y`** — one dot, about four-fifths across. Tap the left half of the card: nothing
   happens, and the selector still reads `1Y`. Tap the dot: the window narrows, and the zoom ladder still
   descends through the rungs testing-data.md lists.
2. **`mixed metrics` at `1M`, the `insufficient` card** — one dot about five-sixths across. Tap the empty
   stretch left of it: nothing. Tap the dot: that Record opens for editing.
3. **`mixed metrics` at `1M`, the `dense` card** — thirty points, so no part of the curve is more than half a
   bucket from one. Tapping anywhere along it still opens a Record; tapping the top or bottom of the card, clear
   of the curve, still does nothing.
4. **`no numeric`** — tapping a swimlane, on a mark or beside one, still does nothing.

### Automated Tests

* **Component — `NumericTrendChart.test.tsx`.** A tap beyond the tolerance horizontally of its nearest point
  reports nothing, on a multi-point chart and on a single-point one; a tap exactly at the tolerance still lands,
  on either axis, the bound being inclusive. The existing vertical-rejection, nearest-by-x and tie-break tests
  pass unchanged — they tap at a point's own coordinates.
* **Screen — `ObservationDetailsScreen.test.tsx`.** Its `pressChartPoint` helper and the inline press beside it
  tap at `locationX: 0`. Charts are unmeasured in that suite, which collapses every point onto the plot's left
  edge at `LABEL_GUTTER` — 32px from that tap, so both move to `locationX: 32`. What they assert is unchanged.

### E2E Flow

Both flows under `.maestro/flows/trend-exploration/` — `tap-a-chart-point.yaml` and `back-to-unzoom.yaml` — are
re-aimed **as part of this slice rather than queued**: they tap the canvas centre and reach their target only
because nothing rejects a distant tap today, so they go red the moment the tolerance lands. No new flow.

* **Fixture:** `seed`, which both already open from.
* **Covers, newly:** a tap in an empty stretch of a chart that *has* a point does nothing — in
  `tap-a-chart-point.yaml`, on the Record the flow enters by hand on `no records`, immediately before the tap
  that opens it, so one canvas is shown rejecting and then accepting. The screen staying on `TRENDS` with no
  `"Save Record"` visible is the whole assertion; every other variation is Vitest's.
* **How to aim:** Maestro's `tapOn` takes an element-relative `point` beside a selector, so
  `{id: "numeric-trend-chart-pressable", point: "83%,50%"}` taps 83% across *that element*, not the screen. A
  point is drawn at `x = 32 + f × (W − 36)` in a chart of width `W` (`LABEL_GUTTER` and `PLOT_RIGHT_INSET` in
  `chartAxis.tsx`), so its percentage is `f + (32 − 36f) / W` — within a point of `f` itself at any phone width,
  against a tolerance of ±24px ≈ ±7% of a card. `f` is where the point's bucket falls in the window, which the
  fixture fixes:

  | Where in the flow | Window and bucket grid | `f` | Aim |
  |---|---|---|---|
  | `no records` plus the Record the flow enters, at the default `1M` — 2 taps in `tap-a-chart-point.yaml` | 30 days, day buckets; a Record entered now lands in the last one | 29/30 | `"96%,50%"` |
  | `stale records` at `1Y` — 1 tap in `tap-a-chart-point.yaml`, 5 in `back-to-unzoom.yaml` | 365 days, 30-day buckets; all four Records share the bucket starting 300 days in | 300/365 | `"83%,50%"` |
  | the window the first zoom opens — 1 tap in each flow | the 17 days those Records span, 14-hour buckets; the middle day's pair sits 196 hours in | 196/408 | `"52%,50%"` |
  | the window the second zoom opens — 1 tap in `tap-a-chart-point.yaml` | that middle day, hour buckets; its two Records share the 09:00 one | 9/24 | `"43%,50%"` |

  The `50%` vertical serves all four: a single point is drawn at the plot's vertical middle, and the middle
  point of the zoomed three sits within a few pixels of it because its value lies between the other two. Each
  aim needs a comment giving its derivation — the number is meaningless alone, and a tap that silently stops
  landing is the hardest failure in the suite to read.
* **Handles:** none new; the canvas already carries `numeric-trend-chart-pressable`, the element the percentages
  are relative to.
* **Alongside:** `testing-android-e2e.md`'s "How flows are written" gains the rule — a tap on a chart canvas is
  aimed with an element-relative `point` derived from the fixture's bucket grid, because the centre of a canvas
  is not where a point is. It generalises past this slice, the swimlane tap wanting it next.
