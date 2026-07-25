# Feature Spec: Aggregated Point Record Count

* Date: 2026-07-25

## 1. Goal

Let a user tell, before tapping, whether a chart point stands for one Record or several, and roughly how many.
Since [Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md) introduced markers, every
point has drawn as an identical dot regardless of `recordCount` — and since
[Tap an Aggregated Chart Point to Zoom](../3-7-tap-aggregated-point-to-zoom/spec.md) shipped, that dot now
hides two different tap outcomes (open a Record, or zoom the chart) with no visual cue for which.

`MetricSeriesPoint.recordCount`, added by 3-7, already carries what this needs, so this is a pure
chart-rendering change — no data model, application, or storage change, and no change to what a tap does. It
reverses the half of 3-7's "No Visual Change Beyond the Window" requirement that ruled out a new marker style.

## 2. Requirements

* [ ] **Aggregated Points Get a Count Label:** A point whose `recordCount` is greater than one draws a small
  text label directly above its existing dot, showing the exact count (e.g. "15"). The dot and halo are drawn
  exactly as they are today, for every point.
* [ ] **Single-Record Points Are Unchanged:** A point whose `recordCount` is exactly one gets no label — nothing
  about it changes.
* [ ] **Count Is Capped At Three Characters:** A `recordCount` above 99 displays as `"99+"` rather than its
  literal digits.
* [ ] **Label Is Quiet, Not a Second Accent:** The label uses `onSurfaceVariant` — the colour the chart's axis
  labels already use — at roughly 65% opacity via the existing `withAlpha` helper, so it reads as secondary
  annotation rather than competing with the curve. No new colour token is introduced.
* [ ] **Font Loads Without Breaking the Chart:** The dot never depends on the chart's Skia font. The label, like
  the axis labels [Trend Chart Axes](../3-6-trend-chart-axes/spec.md) introduced, waits for that font to
  resolve; while it is still loading, an aggregated point simply shows no label yet.
* [ ] **No Change to Tap Behaviour or Hit-Testing:** Nearest-point hit-testing, the vertical-tolerance check,
  `onPointPress`, and what tapping a point does (per [3-3](../3-3-tap-to-record-detail/spec.md) and
  [3-7](../3-7-tap-aggregated-point-to-zoom/spec.md)) are all unchanged — the label is purely visual and is
  drawn regardless of whether tapping that point would currently zoom or do nothing.
* [ ] **No Collision, Overlap, or Edge-Avoidance Logic:** A label is always horizontally centred on its own
  point, with no awareness of neighbouring points or the plot's edges. Overlapping labels on a dense chart, or
  a label bleeding slightly past the plot's edge, are accepted as-is — nothing detects, hides, resizes, or
  repositions them.
* [ ] **Only the Numeric Chart Is Affected:** Boolean, Enum, and Text Metrics still render no chart at all.
* [ ] **No Other Visual Change:** The curve, gradient fill, dot-and-halo markers, and axes are otherwise
  unaffected.

## 3. Technical Design

### 3.1 Data Models

None. `MetricSeriesPoint.recordCount` (`src/application/GetMetricSeriesUseCase.ts`, added by
[3-7](../3-7-tap-aggregated-point-to-zoom/spec.md)) is reused unchanged.

### 3.2 Application Layer

None. `recordCount` already flows into `NumericTrendChart` through the existing `points` prop.

### 3.3 Storage Layer

None.

### 3.4 Chart Rendering

`NumericTrendChart` (`src/presentation/charts/NumericTrendChart.tsx`) changes:

* A formatting helper, `formatPointCount(recordCount: number): string`, is added to `chartDefaults.ts`: returns
  the exact integer up to a new `AGGREGATION_COUNT_DISPLAY_CAP` constant (99), and `"99+"` above it. Never
  called with `1`.
* Two new local constants: `POINT_COUNT_LABEL_COLOR` (`withAlpha(COLORS.onSurfaceVariant, 0.65)`) and a small
  fixed vertical offset placing the label above the point. Exact offset and font size are implementation
  details.
* The existing per-point drawing loop (halo `Circle` + dot `Circle`) is unchanged. One additive step: if
  `points[index].recordCount > 1` and `font` is non-null, draw a centred `SkiaText` at `screenPoints[index].x`,
  offset above `screenPoints[index].y`, showing `formatPointCount(points[index].recordCount)` in
  `POINT_COUNT_LABEL_COLOR`.
* The label's `x` is always `screenPoints[index].x` — no logic inspects other points or the plot's edges to
  adjust it.
* No change to `toScreenPoints`, `nearestPointIndex`, `handlePress`, `onPointPress`, the dot/halo drawing, or
  any plot-rect constant (`PLOT_RIGHT_INSET`, `VALUE_AXIS_WIDTH`, etc.) — a text label needs no extra
  clearance carved out for it.

### 3.5 User Interface — Observation Details Screen

None. `ObservationDetailsScreen`, `TimeRangeSelector`, and `CustomTimeRangeModal` need no changes.

Visual design is provided in
[`design/aggregated-point-record-count.html`](design/aggregated-point-record-count.html): a single chart with
plain dots alongside labelled aggregated points across a range of counts, including the `"99+"` cap.

## 4. Verification Plan

### Manual Verification

Run "Reseed test data" first (see [testing-data.md](../../../../testing-data.md)), and use `mixed metrics`.

1. At "1M", confirm `dense` renders 30 plain dots with no label above any of them.
2. Switch to "1Y". Confirm `dense`'s 3 points each keep their same dot but now carry a small muted number
   above (mid-teens, per testing-data.md).
3. Compare `dense` against `sparse`, `hourly`, and `yearly` at "1Y" — confirm labels follow each Metric's own
   `recordCount` independently.
4. Tap a labelled point to zoom (per [3-7](../3-7-tap-aggregated-point-to-zoom/spec.md)). Confirm labels update
   to the new aggregation and the tap still zooms exactly as before.
5. Open `no numeric` — confirm no chart, no markers, no labels.
6. Confirm `insufficient` still shows its plain placeholder, unaffected.

### Automated Tests

* Unit tests for `formatPointCount`: exact digits up to 99; `"99+"` above the cap.
* Unit tests for `NumericTrendChart`: `recordCount: 1` draws the existing dot/halo with no `SkiaText`;
  `recordCount > 1` draws the same unchanged dot/halo plus a centred `SkiaText` once the mocked font resolves,
  with no `SkiaText` while it's `null`; a count past the cap renders `"99+"`. Regression: existing
  hit-testing/tap suite passes unchanged.
* A clock-pinned `ObservationDetailsScreen` test reproducing `hourly`'s "day-3-back" scenario: the 09:00 point
  shows `"2"`, the 15:00 point shows nothing, and tapping the 09:00 point has no further effect.
