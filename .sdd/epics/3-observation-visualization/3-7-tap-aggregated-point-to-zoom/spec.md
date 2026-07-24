# Feature Spec: Tap an Aggregated Chart Point to Zoom

* Date: 2026-07-23

## 1. Goal

Let a user who taps a chart point representing several Records drill into that point instead of being sent to
one arbitrarily chosen Record. [Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md)
already flagged its own "opens the earliest Record in the bucket" rule as a placeholder for this; that
placeholder is superseded here. Tapping an aggregated point now narrows the Trends section's shared window to
that point's own bucket span and redraws every Numeric chart at a finer aggregation appropriate to that
narrower span, so the Records folded together become visible as their own points. A tap on a point that
already represents exactly one Record is unchanged.

The backlog listed this as depending on [Time Range Selector](../3-4-time-range-selector/spec.md) for its
range/aggregation state; that feature and [Custom Time Range Input](../3-5-custom-time-range-input/spec.md)
have both since shipped. This slice builds on them unchanged: zooming simply makes the tapped bucket's span
the Trends section's active Custom selection, exactly as if entered by hand through the Custom Time Range
modal — and, for now, never narrows past a single day (see the Requirements below).

## 2. Requirements

* [ ] **Aggregated Points Zoom, But Never Below a Single Day:** Tapping a chart point that aggregates more
  than one Record narrows the Trends section's shared time window to that point's own bucket span — provided
  that span is at least a day. Below a day — only reachable from the `1D` preset's one-hour buckets, or a
  previous zoom that already reached hour-level buckets inside a zoomed day — tapping an aggregated point does
  nothing: no zoom, no navigation. This keeps zoom within the granularity Custom Time Range Input's aggregation
  rule already handles well, with no change needed to that rule. If a day zoomed into this way still leaves an
  hour with more than one Record, that hour simply stays a single aggregated point — resolving it further is
  out of scope for now.
* [ ] **Single-Record Points Still Navigate:** Tapping a chart point that represents exactly one Record is
  unchanged — it still opens that Record's detail view, exactly as
  [Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md) already behaves.
* [ ] **Zoom Reuses the Custom Range Mechanism:** The narrowed window becomes the Trends section's active
  Custom selection — the same selection kind [Custom Time Range Input](../3-5-custom-time-range-input/spec.md)
  introduced for a user-entered range — so the TimeRangeSelector row behaves exactly as it does after any
  other custom range: its Custom segment is selected and shows the new window, the four presets show as
  unselected, tapping a preset returns to that preset's window, and tapping Custom re-opens the modal
  pre-filled from the zoomed range.
* [ ] **Applies to Every Numeric Chart, Not Just the Tapped One:** Since the Trends section's window is
  already shared across every Numeric chart on the screen, zooming from a tap on one metric's chart re-scopes
  every other Numeric chart in the section to the same narrower window too.
* [ ] **Bucket-Exact Window, Not Day-Aligned:** Unlike a range entered through the Custom Time Range modal,
  the zoomed window is the tapped bucket's exact start and end instant — not rounded or aligned to
  calendar-day (midnight) boundaries the way a manually entered custom range is.
* [ ] **Zoom Ignored While Trends Are Loading:** A tap on a chart point — whether it would zoom or navigate —
  has no effect while a previous window switch's Record fetch is still in flight, the same `loadingTrends`
  state that already disables the TimeRangeSelector's own segments. This prevents a rapid double-tap from
  starting a second, overlapping reload.
* [ ] **Only the Numeric Chart Is Affected:** Numeric is still the only implemented chart type, so this
  feature only changes tap handling on `NumericTrendChart`. Boolean, Enum, and Text Metrics still render no
  chart at all, so there is nothing yet for this feature to change for them.
* [ ] **No Visual Change Beyond the Window:** A chart's curve, gradient fill, point markers, and axes (from
  [Trend Chart Axes](../3-6-trend-chart-axes/spec.md)) are otherwise unaffected — including no new marker
  style to tell a zoomable point from a navigable one before it's tapped. Axes already recompute from
  whatever window and points a chart is given, so a zoomed chart's axes update the same way they would after
  any other window change.

## 3. Technical Design

### 3.1 Data Models

No new domain entities. `MetricSeriesPoint` (in `GetMetricSeriesUseCase.ts`) gains one field, `recordCount` —
the number of Records folded into that point's bucket, already computed wherever a bucket is reduced to a
point but not currently exposed. A point is aggregated exactly when `recordCount` is greater than one.
`recordId` is unchanged: still the bucket's earliest Record, still needed for the single-Record navigate path.

### 3.2 Application Layer

None beyond the `MetricSeriesPoint` field above. `GetRecordsByTimeRangeUseCase`, `GetMetricSeriesUseCase`, and
the Time Range Selector/Custom Time Range Input helpers (`getTimeRangeForSelection`, `getAggregationForSelection`,
`getAggregationForCustomRange`) are all reused unchanged to resolve and load the zoomed window once it becomes
the active Custom selection.

### 3.3 Storage Layer

None.

### 3.4 Chart Rendering

`NumericTrendChart`'s `onPointPress` callback widens from taking just the tapped point's `recordId` to taking
the whole tapped `MetricSeriesPoint`. The renderer's existing hit-testing (nearest point by horizontal
position, then a vertical-tolerance check) is unchanged — it only reports which point was hit; deciding what
that means is the screen's job, not the chart's.

### 3.5 User Interface — Observation Details Screen

`ObservationDetailsScreen` replaces its current wiring, which passes its Record-navigation handler straight
through as `onPointPress`, with a new handler branching on the tapped point:

* Single Record (`recordCount` of one): opens that Record's detail view, exactly as before.
* Aggregated (`recordCount` greater than one), bucket spans a day or more: computes the bucket's own window —
  start at the point's own `x`, end at that start plus the bucket width the chart was aggregated at — and sets
  it as the Trends section's active Custom selection.
* Aggregated, bucket spans less than a day: no effect.
* Any case, while `loadingTrends` is true: no effect.

The bucket width is the same value the screen already resolves once per render, via the section's existing
aggregation lookup, to draw the charts — reused rather than recomputed. A day-length constant, compared
against that width, sits alongside the ones `chartDefaults.ts` already defines.

No new fetch or render logic is needed: the existing effect already keyed on the active selection picks up the
change automatically, exactly as it does for a manually applied custom range. No change to
`CustomTimeRangeModal` or `TimeRangeSelector`.

No mockup accompanies this feature — no new screen or component is introduced; only what a tap on an existing
point does changes.

## 4. Verification Plan

### Manual Verification

Run "Reseed test data" first (see [testing-data.md](../../../../testing-data.md)), and use the same
`mixed metrics` Observation earlier Trends specs cover. `dense` (one Record per day for 45 days) is what this
checklist relies on: at `1Y`'s 30-day buckets, its daily Records aggregate heavily into each of its three
points.

1. Open `mixed metrics` and switch to "1Y". Confirm `dense` renders three points, each an average of roughly a
   month of daily Records.
2. Tap the middle of `dense`'s three points. Confirm: no Record opens; the TimeRangeSelector's Custom segment
   becomes selected and displays the tapped bucket's date range; `dense`'s chart redraws within that narrower
   window with visibly more points than the single tapped one, its daily Records now spread across the curve
   instead of averaged together; the other Numeric metrics in the section (`sparse`, `hourly`, `yearly`,
   `insufficient`) re-scope to that same narrower window as well.
3. From that zoomed-in view, tap one of `dense`'s now-finer points. Confirm this opens that Record's detail
   view — at this resolution each point represents a single day's Record, so the tap navigates exactly as
   [Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md) already verifies.
4. Return to `mixed metrics` and switch to "1M". Tap several of `dense`'s 30 points (one per day — never
   aggregated at this window). Confirm each still opens its own Record directly, unaffected by this feature.
5. From the zoomed-in state reached in step 2 (or by repeating it), tap the Custom segment. Confirm the modal
   opens pre-filled from the zoomed range, exactly as it would for any other applied custom range.
6. Tap two different aggregated `1Y` points in quick succession, before the first tap's data finishes loading.
   Confirm the second tap has no effect — the chart settles on the first tap's zoomed window, not a mix of
   both or an error.
7. Open `no numeric` (no Numeric Metrics). Confirm neither the Trends section nor the selector appears,
   unchanged from existing behavior.

No seeded metric produces an aggregated point below a day's span — not at `1D` (its hourly buckets are wider
than any two same-metric seeded Records ever land within) and not from a further zoom on the steps above. That
floor is instead pinned by the Automated Tests below.

### Automated Tests

* Unit tests for `GetMetricSeriesUseCase`: every returned `MetricSeriesPoint` carries a `recordCount` equal to
  the number of Records folded into its bucket — one for a bucket fed by a single Record, more than one for a
  bucket fed by several.
* Unit tests for `NumericTrendChart`: a press that resolves to a given point calls `onPointPress` with that
  full point rather than a bare `recordId`; the existing suite of resolution cases (nearest point, vertical
  tolerance, first/last point, a miss) continues to pass, now asserting against the point returned.
* `ObservationDetailsScreen` tests: tapping a chart point whose `recordCount` is one calls the existing
  Record-navigation path with that point's `recordId` and leaves the active time-range selection unchanged;
  tapping an aggregated point whose bucket spans a day or more instead sets the selection to a Custom range
  matching that point's bucket start and the bucket width the chart was aggregated at, triggers no navigation,
  and re-fetches/re-renders every Numeric chart in the section; tapping an aggregated point whose bucket spans
  less than a day leaves the selection, navigation, and loaded data completely unchanged; a tap of any kind
  while `loadingTrends` is true has no effect.
