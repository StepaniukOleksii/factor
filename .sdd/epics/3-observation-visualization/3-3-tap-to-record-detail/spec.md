# Feature Spec: Tap Chart Point to Open Record Detail

* Date: 2026-07-17

## 1. Goal

Let users tap a point on a Numeric trend chart to jump straight to the Record behind it, closing the
"Non-Interactive" gap that [Numeric Metric Trend Chart](../3-2-numeric-metric-trend-chart/spec.md) deliberately
left open. Tapping opens the existing Record detail view — concretely, the Record form screen in its edit mode,
the same screen already reached via the Record contextual menu's Edit action — exactly as
[ADR-1](../../../adr/1-visualization-rendering-foundation.md) anticipated when it called for "one hit-test path
to the existing record-detail view." This slice only wires a tap gesture to that existing navigation; it
introduces no new screens, data models, or use cases.

## 2. Requirements

* [ ] **Nearest-Point Hit-Testing, Bounded Vertically:** Tapping within a Numeric trend chart's plotted area
  selects the chart point nearest to the tap's horizontal position — points can sit only a few pixels apart, so
  horizontal hit-testing is nearest-x rather than a precise hit on the drawn curve. That nearest point is only
  selected if the tap also falls within a small vertical tolerance of the curve at that position; a tap far
  above or below the curve (e.g. in empty space near the top of the chart) selects nothing and does not
  navigate.
* [ ] **Navigates to the Existing Record Detail View:** Selecting a point navigates to the existing Record form
  screen in edit mode for that point's `recordId`, pre-populated with that Record's values — the same screen and
  navigation already used by the Record contextual menu's Edit action.
* [ ] **Aggregated Points Open Their Earliest Record:** When a chart point represents more than one Record
  aggregated into the same bucket (e.g. two same-day Records averaged together), tapping it opens the earliest
  Record in that bucket, consistent with the `recordId` already assigned by `GetMetricSeriesUseCase`.
  * **Superseded by [Tap an Aggregated Chart Point to Zoom](../3-7-tap-aggregated-point-to-zoom/spec.md).**
    Opening an arbitrary Record from an aggregated point was always a placeholder for this. An aggregated
    point now narrows the chart to its own bucket's span at finer aggregation instead of navigating anywhere;
    a tap on a point representing exactly one Record still opens it exactly as described above.
* [ ] **Return Navigation Is Unchanged:** Leaving the opened Record form (via Save, Cancel, or back) returns the
  user to the Observation Details screen, using the existing Record-editing navigation unchanged. Because that
  screen fully reloads on return, both the Records list and the trend charts reflect any saved change.
* [ ] **Insufficient-Data State Stays Non-Interactive:** A Metric shown in its "insufficient data" placeholder
  state (fewer than two aggregated points) remains non-interactive — there is no chart to tap.
* [ ] **Record Points Are Marked:** Each aggregated point on the curve shows a small, minimalist marker (a dot in
  the line colour, ringed by a halo in the trend card's own colour so it reads as a distinct node). This makes the
  tap targets visible so users can aim at a Record directly, rather than guessing where on a sparse curve a point
  sits. No other affordance (highlight, cursor, ripple, press state) is added. *(This reverses an earlier "no
  visual affordance" decision: hands-on testing showed that, on a sparse curve, the invisible hit targets made the
  interaction undiscoverable — tapping the visible line between two distant points misses, since hit-testing is
  anchored to the points, not the drawn curve.)*
* [ ] **Only the Existing Numeric Chart Is Affected:** This feature only changes the `Numeric` chart renderer.
  Boolean, Enum, and Text Metrics still render no chart at all (per the current "TRENDS" section scope), so
  there is nothing yet for this feature to make tappable for those types.
* [ ] **Chart Appearance Is Otherwise Unchanged:** Apart from the per-point record markers above, the chart's
  visuals (smooth curve, gradient fill, no axes/gridlines/legend) are unchanged; this feature adds interaction and
  the markers only. The existing
  [`design/numeric-trend-chart.html`](../3-2-numeric-metric-trend-chart/design/numeric-trend-chart.html) mockup
  remains accurate except that it predates the point markers.

## 3. Technical Design

### 3.1 Data Models

No new domain entities or types are introduced. `MetricSeriesPoint.recordId` (already defined in
`src/application/GetMetricSeriesUseCase.ts` by Visualization Foundation, specifically for this future use) is
reused unchanged.

### 3.2 Application Layer

None. No new use cases or repository methods are needed — the existing `GetRecordByIdUseCase`, used by
`RecordFormScreen` in edit mode, already loads the tapped Record by id.

### 3.3 Chart Rendering

`ChartRendererProps` (`src/presentation/charts/rendererRegistry.ts`) gains one new required field:

```ts
export interface ChartRendererProps {
  metric: Metric;
  points: MetricSeriesPoint[];
  width: number;
  height: number;
  onPointPress: (recordId: string) => void;
}
```

`NumericTrendChart` (`src/presentation/charts/NumericTrendChart.tsx`) changes:

* The `<Canvas>` is wrapped in a `Pressable` sized to the same `{width, height}` box.
* On press, the handler reads `event.nativeEvent.locationX`/`locationY` and finds the point in the
  already-computed `screenPoints` array whose `x` is closest to `locationX` (smallest absolute difference).
  `onPointPress(points[nearestIndex].recordId)` fires only if that point's screen `y` is also within a fixed
  vertical tolerance (e.g. 24px, a comfortable touch-target radius) of `locationY`; otherwise the tap is treated
  as a miss and nothing happens. Exact tie-breaking between equidistant points, and the exact tolerance value,
  are implementation details.
* The insufficient-data branch (`points.length < 2`) is unchanged and renders no `Pressable` — it stays
  non-interactive since there is no `Canvas` to wrap.
* Inside the `<Canvas>`, on top of the line, each `screenPoints` entry is drawn as a record marker: a small
  `Circle` in the line colour (`primaryContainer`) over a slightly larger halo `Circle` in the trend card's
  colour (`surfaceContainerLow`), so the point reads as a discrete node rather than a bulge in the line. No new
  colours are introduced. Exact radii are implementation details.

### 3.4 User Interface — Observation Details Screen

`ObservationDetailsScreen` (`src/presentation/screens/ObservationDetailsScreen.tsx`) changes:

* The `<NumericRenderer .../>` call in the Trends section is given a new prop: `onPointPress={onEditRecord}`.
  `onEditRecord` is the screen's existing prop (already wired by `AppNavigator` to
  `navigateToEditRecord(observationId, recordId)`, and already used by the Record contextual menu's Edit action)
  — reused verbatim, not duplicated.
* No other changes to this screen, and no changes to `AppNavigator.tsx`: the `EditRecord` screen state and its
  `onBack`/`onCreated` wiring already return to `ObservationDetails` and already trigger a full reload of that
  screen (Records and trend data alike), so no additional refresh logic is needed for tap-to-detail specifically.

## 4. Verification Plan

### Manual Verification

1. Open an Observation with a Numeric Metric that has at least two Records spread across the last 30 days, so
   its trend chart renders (not the "insufficient data" placeholder). Verify a small marker dot appears at each
   point on the curve. The seeded `mixed metrics` Observation's `sparse` Metric (points every ~3 days) is the
   scenario this feature was refined against, since its widely-spaced points made the tap targets hardest to find.
2. Tap directly on one of the marker dots. Verify the app navigates to the Record form, pre-populated with the
   values of the Record at that point. Also tap near the middle of the curve and verify the nearest point's Record
   opens.
3. Tap near the very start and very end of the same curve. Verify each opens the first and last Record in the
   window, respectively.
4. Tap far above or below the curve (e.g. near the top edge of the chart while the curve sits near the bottom).
   Verify nothing happens — no navigation.
5. From the opened Record form, tap the cancel/back action. Verify the app returns to the Observation Details
   screen with the same Trends chart still shown.
6. Tap a chart point again and this time save a changed value. Verify the app returns to the Observation Details
   screen and the chart reflects the updated value.
7. For a Metric showing the "Not enough data yet" placeholder, tap it. Verify nothing happens — no navigation.
8. Verify tapping the METRICS chips and RECENT RECORDS rows still behaves exactly as before this feature.

### Automated Tests

* Unit tests for `NumericTrendChart`: pressing the chart at a synthetic `nativeEvent.locationX`/`locationY` near
  a given point calls `onPointPress` with that point's `recordId`; pressing near the first/last point resolves
  to the first/last `recordId`; a press whose `locationY` falls outside the vertical tolerance for its nearest
  point does not call `onPointPress`; the insufficient-data state (0 or 1 points) renders no pressable element
  and never calls `onPointPress`; one record marker dot is drawn per aggregated point.
* `ObservationDetailsScreen` test: simulating a press on a rendered trend chart calls the screen's `onEditRecord`
  prop with the expected `recordId`.
