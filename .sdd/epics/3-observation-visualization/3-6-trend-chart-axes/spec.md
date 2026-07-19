# Feature Spec: Trend Chart Axes

* Date: 2026-07-19

## 1. Goal

Give each Numeric trend chart a visible scale — a row of time labels along the bottom and a handful of
value labels with faint reference gridlines along the left — so a chart's numbers can be read directly
instead of only its shape. This reverses [Numeric Metric Trend Chart](../3-2-numeric-metric-trend-chart/spec.md)'s
deliberate no-axis minimalism call, so per the backlog's own framing it is treated here as a conscious
design decision rather than a drive-by addition: axis labels are kept as visually quiet as possible,
leaning on the product's minimalism and signal-over-noise principles rather than abandoning them.

Label granularity depends on the chart's currently selected time window, so this feature is sequenced
after [Time Range Selector](../3-4-time-range-selector/spec.md) and
[Custom Time Range Input](../3-5-custom-time-range-input/spec.md), both already shipped. It is also the
app's first user of Skia's text rendering — `NumericTrendChart` draws entirely inside a Skia `Canvas`,
which cannot composite a platform `Text` element, so axis labels must be drawn with Skia's own text
primitives rather than an RN `Text` overlay. Since `Numeric` is still the only implemented chart type,
this feature only changes `NumericTrendChart`; Boolean, Enum and Text charts remain future slices with
nothing yet for this feature to add axes to.

## 2. Requirements

* [ ] **Time Axis (X) — Tiered by Span:** Each Numeric trend chart's bottom edge shows time-axis ticks
  whose format and count are chosen from the chart's current `timeRange`'s total span — not from which
  preset (or custom range) produced it — so one rule serves `1D`, `1W`, `1M`, `1Y`, and any custom range
  uniformly, in four tiers:
    * Span ≤ 1 day — **Hour tier:** 8 ticks, each labelled with a bare 24-hour hour-of-day number (e.g.
      "14"); no AM/PM suffix.
    * 1 day < span ≤ 7 days — **Week tier:** one tick per calendar day in the range, up to 7, each
      labelled with a single uppercase weekday-initial letter (e.g. "M", "T", "W").
    * 7 days < span ≤ roughly 2 months — **Month tier:** 5 ticks, each labelled with a short date (e.g.
      "Jul 19").
    * Span > roughly 2 months — **Year tier:** 5 ticks, each labelled with a month name and a
      **2-digit** year — never the full 4-digit year (e.g. "Jul '26", not "Jul 2026").

  Exact tier boundaries and format strings are an implementation detail, but the four tick counts
  (8 / up to 7 / 5 / 5) and the 2-digit-year rule are normative.
* [ ] **Two Tick-Positioning Modes:** The Hour and Week tiers divide the span into N equal slices (an
  hour or a calendar day) and place each tick at the **centre** of its own slice, not its start or the
  span's exact end — so no tick sits at either the plot's left or right edge, and the row reads as N
  evenly-weighted labels rather than N boundary markers. This also sidesteps a duplicate label: an hour
  scale's 24th hour and a week's 7th day both wrap back to the tier's own start, so a tick placed at the
  span's exact end would repeat the first label instead of adding information. The Month and Year tiers
  place their 5 ticks at 5 points evenly spanning the full range, the first at `timeRange.start` and the
  last at `timeRange.end`, since those are two genuinely different dates both worth labelling exactly at
  the edges.
* [ ] **Custom Ranges Use the Same Tiers as Presets:** A custom range's time-axis format and tick count
  are governed by the same four span tiers above, exactly as if that span had been a preset all along —
  e.g. a 5-day custom range reads as Week tier (5 day-letters, not forced to 7), a 45-day one as Month
  tier. There is no separate, custom-only label format.
* [ ] **Value Axis (Y):** Each Numeric trend chart shows 5 evenly spaced horizontal gridlines spanning
  its own plotted value range (its series' min to max, the same domain the curve is already scaled
  against), each paired with a value label at the chart's left edge.
* [ ] **No Vertical Gridlines:** Only the 5 horizontal value gridlines are drawn; the time axis is
  labels only, with no vertical gridlines running up from them, keeping the added scale as visually
  quiet as possible.
* [ ] **Axes Are Per-Chart, Not Shared:** Since each Numeric Metric's chart already scales its own
  y-axis independently (a `dense` chart and a `sparse` chart on the same screen can have very different
  value ranges), axis value labels and gridlines are computed independently per chart, not shared or
  aligned across the Trends section.
* [ ] **Labels Drawn Inside the Canvas:** Axis labels and gridlines are drawn with Skia's text and
  drawing primitives inside the same `Canvas` as the curve, gradient fill, and record-point markers —
  not as a separately positioned RN `Text` overlay.
* [ ] **Plotting Area Shrinks to Fit:** The curve, gradient fill, record-point markers, and tap
  hit-testing all operate within a plotting rectangle reduced from the chart's full `{width, height}`
  box to leave room for the bottom time-label strip and left value-label column — not overlapping them.
* [ ] **Tap-to-Detail Still Works:** Tapping a chart point still opens the correct Record
  ([Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md)), now resolved against
  the reduced plotting rectangle's coordinates instead of the full chart box.
* [ ] **Font Loads Without Breaking the Chart:** Skia's font loading is asynchronous. While it is still
  loading, the chart renders its curve, fill, and markers exactly as it does today, simply omitting the
  axis labels and gridlines until the font resolves — the chart is never blank or broken while waiting.
* [ ] **Insufficient-Data State Unaffected:** A Metric shown in its "Not enough data yet" placeholder
  state (fewer than two aggregated points) still renders no canvas at all, and therefore no axis of any
  kind.
* [ ] **Only Numeric Charts Affected:** Boolean, Enum, and Text Metrics still render no chart at all,
  unchanged.
* [ ] **Axes Recompute With the Chart:** Switching the selected preset or applying a custom range
  recomputes each chart's axis ticks alongside its series, through the same reactive data flow that
  already recomputes the curve today — no separate refresh mechanism is needed.
* [ ] **No New Colours:** Axis text and gridlines reuse the existing palette — muted text
  (`onSurfaceVariant`, matching the existing "Not enough data yet" label) and a faint, low-contrast
  gridline stroke — no new colour token is introduced.
* [ ] **Chart Appearance Otherwise Unchanged:** Apart from the new axis elements and the resulting
  reduction in plotting area, the curve, gradient fill, and record-point markers are visually unchanged.

## 3. Technical Design

### 3.1 Data Models

No new domain entities. New presentation-layer helpers are added in a new file
`src/presentation/charts/axisTicks.ts`, co-located with the existing `chartDefaults.ts` and
`formatTimeRange.ts` chart-presentation helpers rather than `src/domain/`, since axis ticks are a
chart-drawing decision, not a domain rule:

* `AxisTick` — `ratio: number` (the tick's fractional position along its axis, `0` to `1`) and
  `label: string` (the formatted text to draw at that position).
* `TimeAxisTier` — `'hour' | 'week' | 'month' | 'year'`, the four span tiers Requirement "Time Axis (X)
  — Tiered by Span" defines.
* `getTimeAxisTier(spanMs: number): TimeAxisTier` — maps a span in milliseconds to one of the four
  tiers, applying that requirement's thresholds (≤ 1 day / ≤ 7 days / ≤ roughly 2 months / longer).
* `getTimeAxisTicks(timeRange: TimeRange): AxisTick[]` — resolves `timeRange`'s tier via
  `getTimeAxisTier`, then produces that tier's ticks per Requirement "Two Tick-Positioning Modes":
  `hour` and `week` tiers divide the range into N equal slices and place each tick at its slice's
  centre, so `ratio` never reaches exactly `0` or `1` (slice count: 8 for `hour`; for `week`, the number
  of calendar days the range spans, capped at 7); `month` and `year` tiers space exactly 5 ticks with
  `ratio: 0` at `timeRange.start` and `ratio: 1` at `timeRange.end`. Each tick's `label` comes from
  `formatAxisTimeLabel`, given the tick's own timestamp and the resolved tier.
* `getValueAxisTicks(minValue: number, maxValue: number, tickCount: number): AxisTick[]` — returns
  `tickCount` ticks evenly spaced across `[minValue, maxValue]`, `ratio: 0` at `minValue` and `ratio: 1`
  at `maxValue`; handles `minValue === maxValue` (a flat series) without dividing by zero. Each tick's
  `label` is produced by `formatAxisValueLabel`.
* `formatAxisTimeLabel(date: Date, tier: TimeAxisTier): string` — formats `date` per `tier`: `hour` as
  a bare 24-hour hour-of-day number; `week` as a single uppercase weekday-initial letter; `month` as a
  short date; `year` as a month name with a 2-digit year. This one helper drives every preset and any
  custom range uniformly, since `tier` already encodes span, not which preset produced it.
* `formatAxisValueLabel(value: number): string` — formats a numeric value for display, trimmed to a
  sensible number of decimal places so labels stay short and legible.

Centring Hour/Week ticks within their slice means they no longer land at the same `ratio` as the curve's
own data points: `GetMetricSeriesUseCase` positions each aggregated point at its bucket's *start*
(`x: startMs + index * bucketSizeMs`), not its centre. This is a deliberate, accepted divergence — axis
labels read as evenly-spaced slice captions (closer to a calendar's day-of-week header than to a ruler's
tick marks), while the curve's points keep their existing, unrelated positioning. No change to
`GetMetricSeriesUseCase` or to how points are plotted follows from this.

### 3.2 Application Layer

None. No use case or repository changes — axis ticks are derived entirely from data
`NumericTrendChart` already receives (`points`, `timeRange`), the same inputs that already drive the
curve.

### 3.3 Storage Layer

None.

### 3.4 Chart Rendering

`NumericTrendChart` (`src/presentation/charts/NumericTrendChart.tsx`) changes:

* Two new layout constants define the label gutters carved out of the chart's existing `{width,
  height}` box: a bottom strip height for time labels and a left column width for value labels, each
  sized to comfortably fit the axis font at its chosen size.
* The existing pixel-mapping logic (`toScreenPoints`, today mapped across the full `{width, height}`
  box) is changed to map the curve within the reduced plotting rectangle instead — offset right by the
  value-label column's width and reduced in height by the time-label strip's height. Because tap
  hit-testing (`nearestPointIndex`, the vertical-tolerance check) already operates on that same computed
  point array, it stays correct automatically once the array reflects the reduced rectangle; no separate
  hit-testing change is required.
* A Skia font is loaded (via `useFont` or equivalent font-matching API — the exact mechanism is an
  implementation detail) against a bundled font file, since the `Canvas` needs its own font to draw
  glyphs and cannot composite a platform `Text` element. While the font is unresolved (`null`), the
  chart renders its curve, fill, and markers as it does today and simply omits the axis elements until a
  later render once the font is ready.
* Five horizontal gridlines are drawn across the plotting rectangle's width at the positions
  `getValueAxisTicks(minY, maxY, 5)` resolves to (`minY`/`maxY` being the same per-chart value domain
  `toScreenPoints` already computes for the curve), in a faint, low-contrast stroke reusing
  `COLORS.outlineVariant` at low alpha via the existing `withAlpha` helper. Each gridline's value label
  is drawn inside the reserved left column, vertically centred on its gridline.
* Time labels are drawn along the bottom strip at the positions `getTimeAxisTicks(timeRange)` resolves
  to — 8 for the Hour tier, up to 7 for the Week tier, 5 for the Month/Year tiers. Hour/Week labels are
  all horizontally centred on their tick, since per "Two Tick-Positioning Modes" none of them sit at the
  plot's exact edge. Month/Year labels are centred too, except the first (inset/left-aligned so it
  doesn't overflow the card's left edge, since it sits exactly at `timeRange.start`) and the last
  (inset/right-aligned at `timeRange.end`, for the same reason at the opposite edge).
* All label text uses `COLORS.onSurfaceVariant`, matching the colour already used for the "Not enough
  data yet" placeholder text elsewhere on this chart.

This is the app's first use of Skia text rendering, so a font file must be bundled as a project asset
and loaded by `NumericTrendChart`. A short entry should be added to `tech-stack.md`'s existing Data
Visualization section documenting the bundled font and that Skia's text rendering is now in use,
following the precedent [Custom Time Range Input](../3-5-custom-time-range-input/spec.md) set for
documenting a new rendering capability added to an already-approved dependency.

### 3.5 User Interface

* No changes outside the trend chart cards themselves — the Trends section's layout, the
  `TimeRangeSelector` row, and `CustomTimeRangeModal` are unchanged.
* The overall chart box height (`TREND_CHART_HEIGHT` in `ObservationDetailsScreen`) may need to grow
  slightly so the plotted curve area doesn't feel cramped once a label strip is carved out of it; the
  exact value is an implementation detail, tuned by eye against the note below.
* Visual design is provided in [`design/trend-chart-axes.html`](design/trend-chart-axes.html): an
  interactive preview of all four presets plus a Custom range, a side-by-side comparison of all five,
  a dedicated panel demonstrating the Custom range's dynamic tier selection across three example spans,
  and an annotated diagram of the plotting-rectangle/gutter layout. Exact margins, font size, and
  gridline opacity should follow that mockup; the structure and behavior described above are normative.
  Per the Goal, this is a conscious, deliberate exception to the product's minimalism principle — thin,
  muted gridlines and small, low-emphasis labels, not a bordered or fully gridded "spreadsheet" look.

## 4. Verification Plan

### Manual Verification

Run "Reseed test data" first (see [testing-data.md](../../../../testing-data.md)); reuses the same
`mixed metrics` Observation earlier Trends specs already cover.

1. Open `mixed metrics` at the default "1M" selection. Verify each Numeric chart (`dense`, `sparse`,
   `hourly`, `yearly`) shows 5 short-date time labels (Month tier) along the bottom spanning roughly
   "30 days ago" to "today", and 5 value labels with faint horizontal gridlines spanning that chart's
   own min-to-max value — independently per chart (e.g. `dense`'s value labels differ from `sparse`'s).
2. Switch to "1D". Verify `hourly`'s time labels are 8 bare hour-of-day numbers (Hour tier) — no AM/PM,
   no dates — each centred within its hour's slice: the first and last labels sit visibly inset from
   the chart's left/right edges, by roughly equal margins on both sides, rather than flush against
   either edge.
3. Switch to "1W". Verify time labels are 7 single uppercase weekday-initial letters (Week tier), one
   per day, with the same centred, edge-inset placement as "1D" above.
4. Switch to "1Y". Verify `yearly`'s time labels are 5 month labels with a **2-digit** year (Year tier,
   e.g. "Jul '26", never "Jul 2026"), spanning roughly the last 12 months, and its value labels/
   gridlines reflect its own value range at that window.
5. Apply a short custom range (e.g. 3-5 days). Verify it reads as Week tier — day-letters, scaled to
   the actual number of days in the range rather than forced to 7.
6. Apply a medium custom range (e.g. 40-50 days). Verify it reads as Month tier — 5 short-date labels.
7. Apply a long custom range (e.g. 200+ days, ideally crossing a calendar year boundary). Verify it
   reads as Year tier — 5 month/2-digit-year labels, with the year digits changing partway across the
   ticks if the range crosses a year boundary.
8. Verify `insufficient` still shows the "Not enough data yet" placeholder with no axis of any kind, at
   every preset and custom tier above.
9. Tap a chart point on `dense` as in [Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md)'s
   existing checklist. Verify it still opens the correct Record — tap-to-detail is unaffected by the new
   plotting-area offset.
10. Visually compare axis text/gridlines against the curve: confirm the curve remains the visually
    dominant element on each card, with labels and gridlines clearly secondary, even at the Hour tier's
    denser 8-label row.
11. Open `no numeric`. Confirm neither the Trends section nor any axis renders, unchanged.
12. Confirm no chart ever renders visibly blank or broken on first paint while the font loads.

### Automated Tests

* Unit tests for `axisTicks.ts`: `getTimeAxisTier` returns the correct tier for a span just inside and
  just outside each of the three boundaries (1 day, 7 days, ~2 months). `getTimeAxisTicks` returns 8
  ticks for an `hour`-tier range, each `ratio` at the centre of its 1/8 slice (never exactly `0` or
  `1`, e.g. the first tick at `ratio: 1/16`); returns `min(daysInRange, 7)` ticks for a `week`-tier
  range, same centred-slice spacing, including a range shorter than 7 days (e.g. 3 days) to confirm the
  count isn't hardcoded to 7; returns exactly 5 endpoint-spaced ticks (`ratio: 0` at `start`, `ratio: 1`
  at `end`) for `month`- and `year`-tier ranges.
  `formatAxisTimeLabel` produces a bare hour-of-day number for `hour`, a single weekday-initial letter
  for `week`, a short date for `month`, and a month name with a 2-digit (never 4-digit) year for `year`.
  `getValueAxisTicks` returns the requested tick count spanning `[minValue, maxValue]`, including
  `minValue === maxValue` without dividing by zero; `formatAxisValueLabel` trims decimal noise for
  representative values.
* Unit tests for `NumericTrendChart` (extending its existing Skia-mock-based suite): point/marker
  coordinates shift to account for the new axis margins; tap hit-testing (`onPointPress`) still resolves
  to the correct `recordId` against the offset plotting rectangle, exercising the same near-first/
  near-last/miss cases [Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md)'s
  suite already covers; gridlines and labels are omitted while the font is unresolved (font-loading hook
  mocked to return `null`) and drawn once it resolves.
* Regression: the existing `ObservationDetailsScreen` and `rendererRegistry` suites continue to pass
  unchanged, confirming this feature doesn't alter which chart renders or when the Trends section
  appears.
