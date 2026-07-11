# Feature Spec: Numeric Metric Trend Chart

* Date: 2026-07-11

## 1. Goal

Give users a first, at-a-glance view of how a Numeric Metric changes over time, directly on the Observation
Details screen, without requiring them to manually scan Records. This is the first real chart built on top of
the Skia rendering foundation and `GetMetricSeriesUseCase` introduced by
[Visualization Foundation](../3-1-visualization-foundation/spec.md): a single smooth line per Numeric Metric,
over a fixed, non-configurable time window. Per the epic's lean-slice preference, this feature deliberately
excludes tap-to-detail, a time range selector, non-Numeric chart types, and per-metric visibility — each is a
separate, later slice in the backlog.

## 2. Requirements

* [ ] **Trends Section:** The Observation Details screen displays a new "TRENDS" section, positioned between the
  existing "METRICS" section and the existing "RECENT RECORDS" section.
* [ ] **One Chart Per Numeric Metric:** The Trends section renders one chart for each Metric of type `Numeric`
  belonging to the Observation, labeled with the Metric's name, in the same order Metrics are otherwise
  displayed on this screen.
* [ ] **Smooth Line Rendering:** Each chart renders the Metric's values as a single smooth, curved connecting
  line — not straight-line segments — drawn with Skia.
* [ ] **Fixed Time Window:** Each chart covers a fixed window of the last 30 days ending now. The window is not
  user-configurable in this slice; no time range selector is presented.
* [ ] **Fixed Aggregation:** Chart data is produced by the existing `GetMetricSeriesUseCase`, using one-day
  aggregation buckets (mean of Numeric values per day).
* [ ] **Insufficient Data State:** If a Numeric Metric has fewer than two aggregated points within the window,
  its chart is replaced with an "insufficient data" message instead of an empty or broken canvas.
* [ ] **No Numeric Metrics:** If the Observation has no Numeric Metrics, the Trends section is not rendered at
  all.
* [ ] **Non-Interactive:** Chart points are not tappable in this slice. Tapping a chart point does nothing; no
  navigation occurs.
* [ ] **Non-Numeric Metric Types Excluded:** Boolean, Enum, and Text Metrics are not charted by this feature.
* [ ] **Renderer Contract:** The `ChartRenderer` placeholder introduced by Visualization Foundation is given a
  concrete shape by this feature, and a Numeric line renderer is registered against it in the existing
  `rendererRegistry`.
* [ ] **Range-Scoped Record Retrieval:** Records used for charting are retrieved via a new time-range-scoped
  repository method, independent of the existing 3-record "Recent Records" retrieval used by the rest of the
  screen.

## 3. Technical Design

### 3.1 Data Models

No new domain entities are introduced. `Observation`, `Metric`, `Record`, `TimeRange`, `AggregationStrategy`,
and `MetricSeriesPoint` (all already defined by Visualization Foundation in `src/application/GetMetricSeriesUseCase.ts`)
are reused unchanged.

`RecordRepository` (`src/application/RecordRepository.ts`) gains one new method:

* `getByObservationId(observationId: string, range: TimeRange): Promise<Record[]>` — returns Records for the
  given Observation with `timestamp` in `[range.start, range.end)` (half-open, matching
  `GetMetricSeriesUseCase`'s own filtering convention), ordered ascending by timestamp.

`SQLiteRecordRepository` (`src/infrastructure/SQLiteRecordRepository.ts`) implements it with a
`WHERE observation_id = ? AND timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC` query, following the same
row-reconstruction pattern as its existing `getRecentRecords`/`getById` methods.

### 3.2 Application Layer

New use case `GetRecordsByTimeRangeUseCase` (`src/application/GetRecordsByTimeRangeUseCase.ts`), mirroring the
existing `GetRecentRecordsUseCase` convention:

* **Input:** `observationId: string`, `range: TimeRange`.
* **Output:** `Record[]`.
* **Behavior:** delegates to `RecordRepository.getByObservationId(observationId, range)`.

The existing `GetMetricSeriesUseCase` is reused unchanged — it already fully implements Numeric mean
aggregation, bucketing, and empty-input handling. Its Boolean/Enum/Text branches remain unimplemented; nothing
in this feature calls it with those types.

New constants and a helper, co-located in `src/presentation/charts/chartDefaults.ts`:

```ts
export const NUMERIC_TREND_WINDOW_DAYS = 30;
export const NUMERIC_TREND_BUCKET_SIZE_MS = 24 * 60 * 60 * 1000; // one day

export function getDefaultNumericTrendRange(now: Date = new Date()): TimeRange {
  return {
    start: new Date(now.getTime() - NUMERIC_TREND_WINDOW_DAYS * NUMERIC_TREND_BUCKET_SIZE_MS),
    end: now,
  };
}

export const defaultNumericAggregation: AggregationStrategy = {
  bucketSizeMs: NUMERIC_TREND_BUCKET_SIZE_MS,
};
```

### 3.3 Chart Rendering

`ChartRenderer` in `src/presentation/charts/rendererRegistry.ts` moves from an empty placeholder interface to a
concrete contract:

```ts
export interface ChartRendererProps {
  metric: Metric;
  points: MetricSeriesPoint[];
  width: number;
  height: number;
}

export type ChartRenderer = React.ComponentType<ChartRendererProps>;
```

The registry itself (`Map<MetricValueType, ChartRenderer>`) keeps its existing shape.

New component `NumericTrendChart` (`src/presentation/charts/NumericTrendChart.tsx`) implements `ChartRenderer`
for the `Numeric` case:

* Maps each `MetricSeriesPoint` to a canvas coordinate: `x` scaled from the point's bucket timestamp against the
  fixed window bounds, `y` scaled from the point's value against the min/max value across the given `points`.
* Builds a single Skia `Path` (`Skia.Path.Make()`), starting at the first point (`moveTo`) and connecting each
  subsequent point with a cubic Bezier segment (`cubicTo`) rather than a straight `lineTo`, producing a smooth
  curve. Exact control-point placement (e.g. a Catmull-Rom-to-Bezier conversion) is an implementation detail.
* Renders no axis labels, gridlines, or legend in this slice — the Metric name (already shown as the chart's
  section label) and the curve itself are the only visual elements, consistent with the product's "minimalism"
  and "signal over noise" design principles.
* `rendererRegistry.ts` registers it at module load: `rendererRegistry.set('Numeric', NumericTrendChart)`.

### 3.4 User Interface — Observation Details Screen

`ObservationDetailsScreen` (`src/presentation/screens/ObservationDetailsScreen.tsx`) changes:

* A module-level `getRecordsByTimeRangeUseCase` is added alongside the screen's existing module-scope
  repository/use-case singletons.
* `loadData()` additionally calls
  `getRecordsByTimeRangeUseCase.execute(observationId, getDefaultNumericTrendRange())` to fetch chart-scoped
  Records. This is independent of the existing 3-record `getRecentRecordsUseCase` call — that call and the
  "RECENT RECORDS" section are unchanged.
* A new "TRENDS" section is rendered between the existing "METRICS" and "RECENT RECORDS" sections. For each
  Metric of type `Numeric` on the Observation (in Observation-defined order):
  1. Compute `points = getMetricSeriesUseCase.execute(chartRecords, metric, range, defaultNumericAggregation)`.
  2. If `points.length < 2`, render an "insufficient data" message for that Metric instead of a chart.
  3. Otherwise, look up `rendererRegistry.get('Numeric')` and render it with `{ metric, points, width, height }`
     (`width` = the section's content width, `height` = a fixed constant, e.g. 140).
* If the Observation has no `Numeric` Metrics, the "TRENDS" section is omitted entirely.
* Visual design is provided in [`design/numeric-trend-chart.html`](design/numeric-trend-chart.html): the "TRENDS"
  section sits between "METRICS" and "RECENT RECORDS", one card per Numeric Metric (metric name label + bare
  smooth curve, no axis/gridlines/legend), with a muted "Not enough data yet" placeholder card for Metrics below
  the two-point threshold. Colors and typography reuse this screen's existing local `COLORS` object exactly —
  no new palette is introduced.

## 4. Verification Plan

### Manual Verification

1. Open an Observation with at least one Numeric Metric and several Records spread across the last 30 days.
2. Verify a "TRENDS" section appears between "METRICS" and "RECENT RECORDS", with one chart per Numeric Metric,
   labeled by Metric name, matching [`design/numeric-trend-chart.html`](design/numeric-trend-chart.html).
3. Verify the line is smooth/curved, not sharp straight segments.
4. Add a new Record with today's date and a distinct value; reopen Observation Details and verify the chart
   reflects it.
5. Verify a Numeric Metric with fewer than two Records in the window shows an "insufficient data" message
   instead of a chart.
6. Verify an Observation whose Metrics are entirely Boolean/Enum/Text shows no "TRENDS" section.
7. Verify tapping anywhere on a chart has no effect (no navigation, no visual feedback implying interactivity).
8. Verify the existing "METRICS", "RECENT RECORDS", and "Add Record" behavior on this screen is unchanged.

### Automated Tests

* Unit tests for `GetRecordsByTimeRangeUseCase`: delegates to the repository with the given range, returns the
  repository's result unchanged.
* Unit tests for `SQLiteRecordRepository.getByObservationId`: correct filtering by Observation and by the
  half-open time range, correct ascending ordering.
* Unit tests for `NumericTrendChart`: builds a Path with one `moveTo` and `cubicTo` calls for the remaining
  points (using the existing Skia Vitest mock); renders the "insufficient data" message for 0 or 1 input points
  instead of a Path.
* Unit test confirming `rendererRegistry.get('Numeric')` returns `NumericTrendChart`.
* `ObservationDetailsScreen` tests: "TRENDS" section renders one chart per Numeric Metric; section is omitted
  when there are no Numeric Metrics; insufficient-data message shown for an under-populated Metric; existing
  "RECENT RECORDS" behavior is unaffected by the new section and data fetch.
