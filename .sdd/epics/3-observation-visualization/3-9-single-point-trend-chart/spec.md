# Feature Spec: Single-Point Trend Chart

* Date: 2026-07-25

## 1. Goal

Let a Numeric trend chart show data as soon as there is any, rather than waiting for two aggregated
points before it draws anything. Today a Metric with exactly one aggregated point in the selected window
is treated identically to one with zero — both show the "Not enough data yet" placeholder introduced by
[Numeric Metric Trend Chart](../3-2-numeric-metric-trend-chart/spec.md) — even though a single point is
real, plottable data, not an empty series. This feature narrows that placeholder to true emptiness (zero
aggregated points) and gives a chart with exactly one point its own rendering: the point's dot, sitting on
the same axes [Trend Chart Axes](../3-6-trend-chart-axes/spec.md) already draws for a multi-point chart,
but with no connecting curve or gradient fill — a single point has nothing to connect to.

## 2. Requirements

* [ ] **Insufficient-Data Placeholder Narrows to Zero Points:** The "Not enough data yet" placeholder is
  shown only when a Numeric Metric has zero aggregated points in the selected window. A Metric with one or
  more aggregated points renders a chart instead.
* [ ] **Single-Point Chart, No Line:** A Metric with exactly one aggregated point renders a chart: the
  point's dot and halo (and, if that point's `recordCount` is greater than one, its count label per
  [Aggregated Point Record Count](../3-8-aggregated-point-record-count/spec.md)) are drawn on the plotting
  rectangle, exactly as they are for any point on a multi-point chart. No connecting curve and no
  gradient-fill area are drawn — both need at least two points to mean anything, and neither is drawn for
  one.
* [ ] **Axes Still Render for a Single Point:** The value axis (its gridlines and labels) and the time axis
  render for a single-point chart exactly as they do for a multi-point one, scoped to the same `timeRange`.
  A single point is a chart with something to draw, not the placeholder's "no canvas at all" state — this
  supersedes [Trend Chart Axes](../3-6-trend-chart-axes/spec.md)'s "Insufficient-Data State Unaffected"
  requirement, which drew no axis of any kind below two points.
* [ ] **Single Point's Flat Value Range Is Not a Special Case:** A single point's `minY` and `maxY` are
  necessarily equal. This is the same "flat series" shape a multi-point chart with identical values already
  produces, so no new handling is introduced for it — the value axis's existing flat-range behavior (every
  gridline labelled the same value) and the plotting logic's existing zero-span behavior (the point plotted
  at the plotting rectangle's vertical mid-point) already cover a single point without change.
* [ ] **Tap Behaviour Is Unaffected:** Tapping a single-point chart's dot resolves and reports through
  `onPointPress` exactly as tapping any point on a multi-point chart does — opening that Record's detail
  view if the point's `recordCount` is one, or offering to zoom per
  [Tap an Aggregated Chart Point to Zoom](../3-7-tap-aggregated-point-to-zoom/spec.md) if greater. Nothing
  about hit-testing or what a tap means changes for a chart that happens to have only one point to hit.
* [ ] **Zero-Point State Is Otherwise Unchanged:** A Metric with zero aggregated points still shows the
  existing "Not enough data yet" message, icon, and layout, exactly as before.
* [ ] **Multi-Point Charts Are Unchanged:** A Metric with two or more aggregated points renders exactly as
  it does today — curve, gradient fill, axes, point markers, and count labels all unaffected.
* [ ] **The Threshold Counts Aggregated Points, Not Raw Records:** Whether a chart shows the placeholder, a
  single dot, or a full line is decided by the number of aggregated points (`points.length`), not the
  number of raw Records behind them — consistent with every other point-scoped behavior this epic already
  has (zoom, count labels). A bucket that folds several Records together still counts as one point: three
  Records landing in the same bucket produce a single dot with a "3" above it, not a line, even though three
  Records were recorded.
* [ ] **Only the Numeric Chart Is Affected:** Boolean, Enum, and Text Metrics still render no chart at all;
  nothing about this feature applies to them.

## 3. Technical Design

### 3.1 Data Models

None. `MetricSeriesPoint` (`src/application/GetMetricSeriesUseCase.ts`) is reused unchanged — it already
carries everything a single-point chart needs (`recordCount`, the point's own `x`/`y`).

### 3.2 Application Layer

None. `GetMetricSeriesUseCase` is reused unchanged: it already returns exactly one point for a bucket
holding one or more Records, regardless of how many. Nothing about aggregation changes.

### 3.3 Storage Layer

None.

### 3.4 Chart Rendering

`NumericTrendChart` (`src/presentation/charts/NumericTrendChart.tsx`) changes:

* The insufficient-data guard at the top of the component moves from `points.length < 2` to
  `points.length === 0` — only a genuinely empty series shows `NUMERIC_TREND_INSUFFICIENT_MESSAGE` and
  renders no canvas.
* Building the curve and its area fill becomes conditional on having at least two points: `buildSmoothPath`
  and `buildAreaPath` are only called, and their corresponding `Path` elements (stroke and gradient fill)
  only drawn, when `points.length` is two or more. With exactly one point, neither is invoked and neither
  `Path` is rendered.
* Every other canvas element already renders from `points` and `timeRange` alone, independent of how many
  points there are, so nothing about them changes for a single point: the value-axis gridlines and labels
  (`getValueAxisTicks(minY, maxY, ...)`), the time-axis labels (`getTimeAxisTicks(timeRange)`), the per-point
  dot and halo, and that point's count label when its `recordCount` is greater than one.
* `toScreenPoints`'s existing `ySpan === 0` branch (a flat series plots at the plotting rectangle's vertical
  mid-point) already covers a single point, whose `minY` and `maxY` are necessarily equal — no change.
* `getValueAxisTicks`'s existing `minValue === maxValue` handling (every tick labelled with that one value)
  already covers a single point's flat value range — no change.
* Hit-testing (`nearestPointIndex`, the vertical-tolerance check in `handlePress`) is unchanged: against a
  one-element `screenPoints` array it trivially resolves to that element, and `onPointPress` fires exactly
  as it does today for any point.
* `chartDefaults.ts`'s `NUMERIC_TREND_INSUFFICIENT_MESSAGE` constant and value are unchanged; only its
  doc-comment, which currently describes "fewer than two aggregated points," should be corrected to describe
  zero.

No new mockup accompanies this feature: the dot-and-halo marker and its count label already appear in
[`design/aggregated-point-record-count.html`](../3-8-aggregated-point-record-count/design/aggregated-point-record-count.html),
and the value/time axes already appear in
[`design/trend-chart-axes.html`](../3-6-trend-chart-axes/design/trend-chart-axes.html) — a single-point
chart is exactly those elements, without a curve or gradient fill between them.

### 3.5 User Interface — Observation Details Screen

`ObservationDetailsScreen` (`src/presentation/screens/ObservationDetailsScreen.tsx`) changes its Trends
section's own gate: `hasEnoughData` (currently `points.length >= 2`, choosing between rendering
`NumericRenderer` and the screen's own inline "insufficient" block) becomes `points.length >= 1`. Nothing
else about the screen changes — the same `NumericRenderer` wiring (`points`, `timeRange`, `onPointPress`,
sizing) already used for a multi-point chart is reused unchanged for a single-point one, since deciding what
a tap on that single point does is already the screen's `handleChartPointPress` logic from
[Tap an Aggregated Chart Point to Zoom](../3-7-tap-aggregated-point-to-zoom/spec.md), unaffected by how many
points the chart happens to have.

### 3.6 Seed Data Documentation

Because the rendered state of a Numeric Metric's trend chart moves from two tiers (nothing below two
points, a line at or above it) to three (nothing at zero, a dot at exactly one, a line at two or more),
some of the existing scenarios [testing-data.md](../../../../testing-data.md) documents change what they
show at some presets, and its prose needs correcting to match:

* `insufficient` (`mixed metrics`) currently reads as showing "Not enough data yet" at every preset; per
  its own point counts (`0 / 1 / 1 / 1` across `1D`/`1W`/`1M`/`1Y`) it now shows the placeholder only at
  `1D` (0 points — its one Record, 5 days old, falls outside that window) and a single dot at `1W`, `1M`,
  and `1Y`.
* `stale records`' `value` Metric currently reads as showing "Not enough data yet" at every preset,
  including `1Y`, reasoning that its three Records collapsing into one bucket at `1Y` still counts as
  "too few." Under the new threshold that same collapse instead produces a single dot (carrying a "3" count
  label) at `1Y`; `1D`, `1W`, and `1M` are unaffected, since all three Records still fall outside those
  narrower windows.
* The `1D` step of `mixed metrics`' manual walkthrough currently reads "`dense` and `sparse` drop to `Not
  enough data yet`"; per the point-count table both sit at exactly one point at `1D`, so they now render a
  single dot rather than the placeholder — `insufficient` (0 points at `1D`) is the only Metric on
  `mixed metrics` still showing the placeholder there.

No new Observation or Metric is needed to cover the new single-dot state: every seeded Numeric Metric
already lands on exactly one point at some preset (`dense`, `sparse`, and `yearly` at `1D`; `insufficient`
at `1W`/`1M`/`1Y`; `stale records`' `value` at `1Y`), so the existing dataset already exercises the
placeholder, the single dot, and the full line without extension — only the doc's prose describing what
each of those now renders needs to change.

## 4. Verification Plan

### Manual Verification

Run "Reseed test data" first (see [testing-data.md](../../../../testing-data.md)).

1. Open `mixed metrics` at its default `1M` selection. Confirm `insufficient` — previously showing "Not
   enough data yet" here — now renders a chart: a single dot, vertically centred on the plotting rectangle,
   with the value axis's gridlines all labelled the same value and the usual `1M` time-axis labels along the
   bottom, and with no connecting line, curve, or gradient fill anywhere on the card.
2. Tap `insufficient`'s dot. Confirm it opens that Record's detail view, the same as tapping any
   single-Record point on a multi-point chart.
3. Switch to `1D`. Confirm `insufficient` drops back to the "Not enough data yet" placeholder — its one
   Record is 5 days old, outside the 1-day window, giving it zero aggregated points there.
4. Still at `1D`, confirm `dense` and `sparse` (each with exactly one Record inside that narrow window) now
   render as a single dot rather than "Not enough data yet," while `hourly` (several Records within the last
   day) still renders its usual multi-point line, unchanged.
5. Open `stale records`. Confirm `value` still shows "Not enough data yet" at `1D`, `1W`, and `1M` (all
   three Records remain outside those windows). Switch to `1Y`: confirm it now shows a single dot carrying a
   "3" count label, instead of the placeholder. Tap the dot: confirm it zooms — per
   [Tap an Aggregated Chart Point to Zoom](../3-7-tap-aggregated-point-to-zoom/spec.md) — into the days its
   three Records span, rather than opening a Record directly.
6. Confirm every already-multi-point metric/preset combination on `mixed metrics` (e.g. `dense` at `1M`,
   `yearly` at `1Y`) is visually unchanged — curve, gradient fill, axes, and point markers exactly as before.
7. Open `no records`. Confirm its `value` Metric still shows "Not enough data yet" at every preset — it has
   zero Records, so zero points regardless of window.
8. Open `no numeric`. Confirm neither the Trends section nor the time range selector renders, unchanged.

### Automated Tests

* Unit tests for `NumericTrendChart`: a single point renders its dot and halo (and, once the mocked font
  resolves, its count label when `recordCount` is greater than one) plus the value and time axes, but no
  `Path` for the curve or the gradient fill, and no `NUMERIC_TREND_INSUFFICIENT_MESSAGE`; zero points still
  render the insufficient-data message with no axis of any kind, matching current behavior; a tap on a
  single-point chart's sole point still resolves through `onPointPress` exactly as any other point does.
  This replaces the existing "renders the insufficient-data message and no path for a single point" and
  "renders no pressable for a single point" cases with ones asserting the opposite for one point, while the
  equivalent zero-point cases are kept.
* `ObservationDetailsScreen` tests: the existing "shows the insufficient-data message for a Metric with
  fewer than two points" test (built on exactly one Record) is replaced by two — a zero-Record Metric still
  shows `NUMERIC_TREND_INSUFFICIENT_MESSAGE` with no `trend-chart`, and a one-Record Metric now renders a
  `trend-chart` (no `trend-empty`) whose point opens that Record on tap.
* `devSeedData.test.ts`: the `'never charts the insufficient Metric, at any preset'` test's assertion
  (`pointCount(...) < 2` at every preset) no longer describes the rendered state it was written to pin,
  since one point now charts as a dot; it is replaced with an assertion matching the documented point counts
  directly — zero at `1D`, exactly one at `1W`/`1M`/`1Y` — described as the placeholder-vs-dot boundary
  rather than a blanket "never charts."
