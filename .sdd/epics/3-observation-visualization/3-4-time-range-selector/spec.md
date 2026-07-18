# Feature Spec: Time Range Selector

* Date: 2026-07-18

## 1. Goal

Let users control the time window shown by an Observation's Numeric trend charts, replacing the fixed 30-day
window that [Numeric Metric Trend Chart](../3-2-numeric-metric-trend-chart/spec.md) deliberately left
non-configurable. A row of four preset controls — 1D, 1W, 1M, 1Y — sits above the Trends section; selecting one
re-fetches Records for that window and re-renders every Numeric chart on the screen against it, with a bucket
size chosen per preset so each chart stays readable regardless of span. Per the backlog's own framing of this
slice, the time-range state is shared across the whole Trends section rather than set per metric — one
selection drives every Numeric chart on the screen.

Per the epic's lean-slice preference — and because the backlog entry for this slice lists only the four fixed
presets — this feature deliberately excludes a fifth, arbitrary custom-range control. A validated custom-date
modal (input, parsing, validation, apply) is a meaningfully bigger, separable piece of work than four fixed
presets, so it has been split out as its own backlog idea for a future spec rather than folded in here. This
feature also excludes axis labels/gridlines and the aggregated-point-opens-zoom behavior — both are separate,
later slices already in the backlog.

## 2. Requirements

* [ ] **Time Range Selector Control:** The Trends section gains a row of four segmented controls — "1D", "1W",
  "1M", "1Y" — rendered once above the per-metric chart cards, shared by every Numeric chart in the section
  rather than repeated per metric.
* [ ] **Default Selection:** "1M" is selected by default when the screen loads, reproducing exactly the fixed
  30-day/1-day-bucket window [Numeric Metric Trend Chart](../3-2-numeric-metric-trend-chart/spec.md) already
  ships today, so this feature is additive to what users currently see.
* [ ] **Preset Definitions:** Each preset maps to a fixed window ending now, paired with a bucket size for
  aggregation:
    * **1D** — last 24 hours, 1-hour buckets (24 buckets).
    * **1W** — last 7 days, 1-day buckets (7 buckets).
    * **1M** — last 30 days, 1-day buckets (30 buckets) — identical to today's fixed default.
    * **1Y** — last 365 days, 30-day buckets (~12 buckets).
* [ ] **Selecting a Preset Reloads Records:** Tapping a preset re-fetches Records for that Observation scoped to
  the new window (via the existing `GetRecordsByTimeRangeUseCase`) and recomputes every Numeric chart's series
  (via the existing `GetMetricSeriesUseCase`) using the preset's bucket size.
* [ ] **Applies to Every Numeric Chart:** The selected preset drives all Numeric Metric charts in the Trends
  section simultaneously — one shared window/aggregation, not an independent one per metric.
* [ ] **Insufficient-Data State Still Applies Per Metric:** A Metric with fewer than two aggregated points in the
  selected window still shows the existing "Not enough data yet" placeholder, independent of whether other
  Metrics on the same screen have enough data for that preset.
* [ ] **Selector Disabled While Loading:** The four preset controls are disabled while a preset switch's Record
  fetch is in flight, preventing overlapping reloads from rapid re-tapping.
* [ ] **Other Sections Unaffected:** The "METRICS" chip row and "RECENT RECORDS" section are unaffected by preset
  selection — they keep using their own existing, independent data (`GetRecentRecordsUseCase`, unchanged).
* [ ] **No Numeric Metrics:** If the Observation has no Numeric Metrics, neither the Trends section nor the
  selector is rendered, consistent with the existing behavior established by
  [Numeric Metric Trend Chart](../3-2-numeric-metric-trend-chart/spec.md).
* [ ] **No Custom Range:** A fifth, arbitrary-range control is explicitly out of scope for this slice (see
  Goal).
* [ ] **No New Chart Visuals:** Apart from the new selector control, the charts' appearance (smooth curve,
  gradient fill, record markers, no axes/gridlines/legend) is unchanged; this feature only changes which
  window/bucket size feeds them.
* [ ] **Preset Resets on Screen Remount:** Consistent with this screen's existing local UI state (expanded
  Record, scroll positions), the selected preset is not persisted — returning from Record edit/creation, or
  reopening the Observation, resets the selection to the "1M" default.

## 3. Technical Design

### 3.1 Data Models

No new domain entities. `TimeRange` and `AggregationStrategy` (both already defined in
`src/application/GetMetricSeriesUseCase.ts`) are reused unchanged.

A new presentation-layer type `TimeRangePreset` and a preset configuration table are added to
`src/presentation/charts/chartDefaults.ts`, replacing the fixed-window constants/helpers this feature
supersedes: `NUMERIC_TREND_WINDOW_DAYS`, `NUMERIC_TREND_BUCKET_SIZE_MS`, `getDefaultNumericTrendRange`, and
`defaultNumericAggregation` are removed.

```ts
export type TimeRangePreset = '1D' | '1W' | '1M' | '1Y';

interface TimeRangePresetConfig {
  windowMs: number;
  bucketSizeMs: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const TIME_RANGE_PRESETS: Record<TimeRangePreset, TimeRangePresetConfig> = {
  '1D': {windowMs: DAY_MS, bucketSizeMs: HOUR_MS},
  '1W': {windowMs: 7 * DAY_MS, bucketSizeMs: DAY_MS},
  '1M': {windowMs: 30 * DAY_MS, bucketSizeMs: DAY_MS},
  '1Y': {windowMs: 365 * DAY_MS, bucketSizeMs: 30 * DAY_MS},
};

export const DEFAULT_TIME_RANGE_PRESET: TimeRangePreset = '1M';

export function getTimeRangeForPreset(preset: TimeRangePreset, now: Date = new Date()): TimeRange {
  return {
    start: new Date(now.getTime() - TIME_RANGE_PRESETS[preset].windowMs),
    end: now,
  };
}

export function getAggregationForPreset(preset: TimeRangePreset): AggregationStrategy {
  return {bucketSizeMs: TIME_RANGE_PRESETS[preset].bucketSizeMs};
}
```

`1M`'s window/bucket values are unchanged from today's fixed default, so selecting "1M" (the default)
reproduces today's chart exactly — a regression guard, not just a convenience.

### 3.2 Application Layer

None. `GetRecordsByTimeRangeUseCase` and `GetMetricSeriesUseCase` — both already time-range- and
aggregation-parametrized since Visualization Foundation and Numeric Metric Trend Chart — are reused unchanged.
This feature only changes which `TimeRange`/`AggregationStrategy` values the screen passes to them.

### 3.3 Chart Rendering

None. `NumericTrendChart` and `rendererRegistry` are reused unchanged — they already accept `timeRange` and
`points` as props and scale generically over whatever window/bucket size produced those points.

### 3.4 User Interface

New component `TimeRangeSelector` (`src/presentation/charts/TimeRangeSelector.tsx`):

```ts
export interface TimeRangeSelectorProps {
  selected: TimeRangePreset;
  onSelect: (preset: TimeRangePreset) => void;
  disabled?: boolean;
}
```

* Renders one pressable segment per entry in `TIME_RANGE_PRESETS`, in `1D`/`1W`/`1M`/`1Y` order, each labeled
  with its preset name.
* The segment matching `selected` is visually distinguished (e.g. filled `primaryContainer` background) from the
  rest (`surfaceContainerLow`), reusing the existing palette — no new colors are introduced. Exact spacing/sizing
  should follow the design mockup once supplied (see note below); until then, implement using the same
  chip/card visual language as this screen's existing `metricChip`/`trendCard` styles for consistency.
* When `disabled`, segments are non-interactive and visually muted (e.g. reduced opacity), matching this
  screen's existing disabled-button treatment (e.g. `modalDeleteButtonDisabled`).
* Each segment has an `accessibilityLabel` (e.g. "Show last day", "Show last week", "Show last month", "Show
  last year").

> Visual design for this control will be supplied separately. The structure and behavior above are normative;
> exact spacing, sizing, and color detail should follow the supplied mockup once available, added under this
> feature's own `design/` folder.

`ObservationDetailsScreen` (`src/presentation/screens/ObservationDetailsScreen.tsx`) changes:

* New state: `timeRangePreset` (`useState<TimeRangePreset>(DEFAULT_TIME_RANGE_PRESET)`) and `loadingTrends`
  (`useState(false)`).
* `loadTrendData` is parametrized by the current preset instead of calling the removed
  `getDefaultNumericTrendRange()`, and gets its own loading flag:
  ```ts
  const loadTrendData = async (preset: TimeRangePreset) => {
    try {
      setLoadingTrends(true);
      const range = getTimeRangeForPreset(preset);
      const rangeRecords = await getRecordsByTimeRangeUseCase.execute(observationId, range);
      setChartRange(range);
      setChartRecords(rangeRecords);
    } catch (error) {
      console.error('Failed to load trend data', error);
    } finally {
      setLoadingTrends(false);
    }
  };
  ```
* `loadData()` keeps calling `loadRecentRecords()` (unrelated to preset selection) but no longer calls
  `loadTrendData()` itself. A new effect owns the trend fetch, keyed on the Observation being loaded and the
  current preset:
  ```ts
  useEffect(() => {
    if (observation) {
      loadTrendData(timeRangePreset);
    }
  }, [observationId, timeRangePreset, observation]);
  ```
  This covers both the initial load (fires once `observation` is set, using the default preset) and every
  subsequent preset switch, without re-fetching the Observation or Recent Records.
* Each Numeric Metric chart's series computation replaces `defaultNumericAggregation` with
  `getAggregationForPreset(timeRangePreset)`.
* The "TRENDS" section renders `<TimeRangeSelector selected={timeRangePreset} onSelect={setTimeRangePreset}
  disabled={loadingTrends} />` once, directly below the "TRENDS" caption and above the per-metric chart cards —
  inside the same conditional block that already guards the whole section on at least one Numeric Metric
  existing.

## 4. Verification Plan

### Manual Verification

1. Open an Observation with at least one Numeric Metric and Records spread across the last year.
2. Verify the Trends section shows a "1D / 1W / 1M / 1Y" selector above the chart cards, with "1M" selected by
   default, and the chart(s) match exactly what
   [Numeric Metric Trend Chart](../3-2-numeric-metric-trend-chart/spec.md) already renders today (same 30-day
   window).
3. Tap "1W". Verify the selector shows "1W" as selected and the chart(s) re-render using only the last 7 days of
   Records with daily buckets.
4. Tap "1D", then "1Y". Verify each re-renders with its own window/bucket size (hourly buckets over the last
   24h; ~monthly buckets over the last 365 days).
5. For a Metric with fewer than two Records in a given preset's window (e.g. "1D" for sparse data), verify that
   preset shows the "Not enough data yet" placeholder while a denser preset (e.g. "1M") shows a real chart for
   the same Metric.
6. Verify the "METRICS" chip row and "RECENT RECORDS" section are unaffected by switching presets.
7. Tap a chart point on a non-default preset to open its Record (existing tap-to-detail), then return. Verify
   the screen reloads with the selector reset to "1M" (consistent with this screen's existing reset-on-remount
   behavior for its other local state).
8. Verify an Observation with no Numeric Metrics shows neither the Trends section nor the selector.

### Automated Tests

* Unit tests for the new `chartDefaults.ts` helpers: `getTimeRangeForPreset` returns the correct window per
  preset (and defaults `now` to the current time); `getAggregationForPreset` returns the correct bucket size per
  preset; the `'1M'` preset's values match today's previous fixed 30-day/1-day-bucket constants exactly
  (regression guard).
* Unit tests for `TimeRangeSelector`: renders one segment per preset in order; pressing a segment calls
  `onSelect` with that preset; the `selected` segment is structurally distinguishable from the rest (e.g. via
  `accessibilityState.selected` or an equivalent testable marker); segments neither respond to press nor call
  `onSelect` when `disabled`.
* `ObservationDetailsScreen` tests: default rendered preset is "1M"; selecting each preset calls
  `getRecordsByTimeRangeUseCase.execute` with the expected computed range and re-renders charts using the
  expected aggregation; the "RECENT RECORDS" section's data/behavior is unaffected by preset changes; an
  Observation with no Numeric Metrics renders neither the Trends section nor the selector.
