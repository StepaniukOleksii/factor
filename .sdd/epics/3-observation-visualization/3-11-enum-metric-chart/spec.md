# Enum Metric Chart

* 2026-08-05

## 1. Goal

An Enum Metric records perfectly and shows nothing.
[Enum Metric Input](../../2-record-management/2-11-enum-metric-input/spec.md) gave a Metric a fixed set of
values and a Record a way to pick one, and ruled visualization out of scope; the TRENDS section still appears
only for Numeric Metrics, so someone tracking mood as `low`/`ok`/`high` can answer it every day and never see
how it moved.

Chart an Enum Metric as a swimlane.

The chart ships inert: what a tap on a *lane* means deserves the pass the Numeric chart's own tap behaviour
got across three slices, and is on the backlog. So is the Boolean chart, which folds into this renderer
rather than needing one of its own.

## 2. Requirements

* The Trends section renders a chart for every Metric whose type has a registered renderer, in the
  Observation's own Metric order rather than grouped by type. It and the time range selector are omitted only
  when no Metric on the Observation charts at all.
* An Enum chart draws one lane per allowed value, in declared order, the last-declared value in the top lane,
  coloured by a one-hue ordinal ramp over the app's existing green — darkest at the first-declared value,
  lightest at the last. No legend is drawn.
* Each bucket holding Records draws one mark per value those Records took, in that value's own lane, its
  height that value's share of the bucket and its width the bucket's own span. A bucket whose Records all
  took one value draws a single mark filling that lane, and a share too small to draw is drawn at a minimum
  height rather than rounded away.
* Each lane is labelled at the chart's left edge, in a gutter sized for a short value; a value too long to fit
  is truncated with an ellipsis, and never overruns the plot.
* The chart carries the same time axis, at the same span tiers, as the Numeric chart, and no value axis.
* A Metric with no Records in the window, and a Metric with no declared values, show the same "Not enough data
  yet" placeholder a Numeric Metric with no points shows.
* A Record whose value is not one of the Metric's declared values is excluded from the series, as one carrying
  no value already is.
* A bucket's Record count is not shown: twelve unanimous Records draw the same mark as one.
* The Enum chart reports no point and responds to no tap — it opens no Record, zooms nothing, and leaves the
  section's window alone.
* Layout per [`design/enum-metric-chart.html`](design/enum-metric-chart.html).

## 3. Technical Design

### 3.1 Domain

Unchanged. `EnumConstraint.allowedValues` already carries the lane list in declaration order, and
`METRIC_ENUM_MAX_VALUES` already caps it at 4 — a cap
[Enum Metric Input](../../2-record-management/2-11-enum-metric-input/spec.md) §3.4 chose for this chart before
it existed, so no Metric a user can create needs more lanes than the card can give it.

### 3.2 Application

`MetricSeriesPoint` (`src/application/GetMetricSeriesUseCase.ts`) becomes a discriminated union over a shared
base: `y: number` cannot carry per-value shares, and this is the first renderer that doesn't fit the shape
[Visualization Foundation](../3-1-visualization-foundation/spec.md) shipped.

* The base keeps `x`, `recordId`, `recordCount`, `firstRecordAt` and `lastRecordAt` unchanged. Each is about
  *which Records* a point stands for rather than what they reduced to, and the screen's tap handling reads
  only these — so nothing about navigation or zoom is touched.
* `NumericSeriesPoint` — `kind: 'numeric'` and the existing `y`.
* `CategorySeriesPoint` — `kind: 'category'` and `shares: CategoryShare[]`, where
  `CategoryShare = {value: string; share: number}`. Listed in declared value order, each in `(0, 1]`, summing
  to 1, with a value no Record took absent rather than present at zero, so a renderer draws exactly the marks
  the list holds. `'category'` rather than `'enum'` because the Boolean slice will produce this same shape.
* Type guards `isNumericPoint` and `isCategoryPoint` beside them, since the registry gives a renderer no
  type-level guarantee about which kind it is handed.

`GetMetricSeriesUseCase.reduce` returns the kind-specific half of the point rather than a bare number, the new
Enum branch counting each declared value's occurrences and dividing by the bucket's Record count. `Boolean`
and `Text` keep throwing.

Its in-range filter, which already drops Records carrying no value, additionally drops one whose Enum value is
not among `allowedValues` — which drops every Record when the constraint is absent. Unreachable from the UI,
but it keeps `recordCount` equal to the number of Records the shares are computed over and every share's lane
lookup total.

### 3.3 Storage

None.

### 3.4 Chart Rendering

**A shared axis module comes first.** `NumericTrendChart` privately owns the time axis, the font, the
plot-rectangle arithmetic and the Skia text helpers, and a second chart needs all of them drawn identically;
copying them would leave two definitions to drift. A new `src/presentation/charts/chartAxis.tsx` holds one,
taking over unchanged: the axis constants (`PLOT_TOP_PADDING`, `PLOT_RIGHT_INSET`, `TIME_AXIS_HEIGHT`,
`TIME_LABEL_BASELINE_OFFSET`, `AXIS_FONT_SIZE`, `AXIS_LABEL_COLOR`, `GRIDLINE_COLOR`, `GRIDLINE_WIDTH`),
`measureWidth`, `baselineCentreOffset`, `timeLabelX`, and `PlotRect` with `toPlotRect` — the last gaining its
left gutter as a parameter, since the two charts reserve different widths there. It adds `useAxisFont()`, so
both charts load the same bundled typeface at the same size and both tolerate its `null` first renders;
`truncateToWidth(font, text, maxWidth)`, returning a fitting string unchanged and otherwise the widest prefix
that fits with an ellipsis; and `TimeAxisLabels`, the bottom label strip exactly as drawn today.

`NumericTrendChart` moves onto all of it, passing `VALUE_AXIS_WIDTH` as its gutter, and keeps everything else —
curve, gradient fill, value axis, markers, count labels, hit-testing. It also narrows `points` once through
`isNumericPoint`; the registry pairs each renderer with the type whose reduction produces its kind, so that
narrowing exists to make the code legal rather than to handle a real case.

**`ChartRendererProps` gains `aggregation: AggregationStrategy`.** A mark is as wide as its bucket is long,
and bucket span is derivable from nothing a renderer currently receives — gaps between consecutive points are
multiples of it on any Metric that doesn't record every bucket. The screen already has it in hand.
`NumericTrendChart` ignores it.

**The lane ramp** lives in `src/presentation/charts/laneColors.ts` as `getLaneColors(laneCount)`, returning
the ramp bottom lane first:

* 2 lanes — `#5a8a45`, `#b6f09c`
* 3 lanes — `#5a8a45`, `#86bd68`, `#b6f09c`
* 4 lanes — `#5a8a45`, `#75a85b`, `#95ce79`, `#b6f09c`

All three span the same endpoints — the dim end at 4.22:1 against `surfaceContainerLow`, the light end
`COLORS.primaryContainer` exactly — in fewer steps than the five-step ramp these were sampled from, so each
inherits its monotone lightness and clears its 0.06 adjacent-gap floor with room to spare. A count outside 2
to 4 cannot occur, so the function returns the 4-lane ramp above 4 rather than throwing; a chart is not worth
crashing a screen over. The three darker greens stay in this module rather than joining `COLORS`: they encode
one chart's ordinal scale, and nothing else in the app has an ordinal scale to share them with.

**`EnumSwimlaneChart`** (`src/presentation/charts/EnumSwimlaneChart.tsx`) implements `ChartRenderer` for
`Enum` and registers in `rendererRegistry` beside the Numeric entry. Its lanes come from `allowedValues`: the
value at declared index *i* takes lane *i* counted from the plot's bottom, and colour *i* from the ramp. With
no values or no points it renders `TREND_INSUFFICIENT_MESSAGE` in the same block `NumericTrendChart` uses for
its zero-point case — unreachable, since the screen gates first, but it keeps the two interchangeable.

Geometry:

* The plot rectangle is `toPlotRect(width, height, 48)` — a 48px left gutter against the value axis's 24,
  which is what buys the labels their extra characters. Lane height is the plot's height over the lane count,
  so 2, 3 and 4 lanes each fill the same card.
* `laneCount + 1` separators span the plot's width at the lane boundaries, in the shared gridline colour and
  width, and are the only horizontal rules the chart draws.
* A mark's `x` maps its bucket start across `timeRange` as the Numeric chart maps a point's; its width is
  `aggregation.bucketSizeMs` through the same scale less a 2px gap, floored at 2px and clipped at the plot's
  right edge — the newest bucket of a window ending mid-bucket would otherwise run past it.
* A mark's height is its share of the lane less a 3px inset top and bottom, floored at 3px so a value that
  occurred at all is visible. The floor distorts nothing: each lane is measured against itself, so unlike a
  stacked bar there is no total for a floored mark to steal from. Marks grow up from their lane's floor, with
  a 4px corner radius clamped to half the smaller side so a thin mark reads as a bar rather than a lozenge.
* Lane labels sit in the gutter, left-aligned and vertically centred on their lane via `baselineCentreOffset`,
  through `truncateToWidth` against the gutter less a 5px gap, at the time labels' own size and colour so the
  chart introduces no new type size. They wait for the font like every other glyph, but the gutter is reserved
  whether or not it has resolved, so nothing shifts when it does.

Nothing wraps the canvas in a `Pressable` and `onPointPress` is never called, which is how "not tappable" is
expressed; the prop stays because the contract is shared. Nothing draws `recordCount` either.
[Aggregated Point Record Count](../3-8-aggregated-point-record-count/spec.md)'s answer does not transfer — it
labels one mark per bucket where a swimlane has up to four, in 22px lanes at four values — so the gap is left
open rather than solved badly, and is on the backlog.

The 48px gutter is what settles the open question
[Enum Metric Input](../../2-record-management/2-11-enum-metric-input/spec.md) §3.4 left for whichever spec
picked up the chart. `METRIC_ENUM_VALUE_MAX_LENGTH` stays at 12: a gutter fitting twelve wide characters would
take a third of the plot, and lane position and the ramp already carry a lane's identity.

### 3.5 Presentation — Observation Details Screen

`ObservationDetailsScreen` stops asking which Metrics are Numeric and starts asking which ones something can
draw: the Trends filter becomes `rendererRegistry.has(metric.type)`, and the renderer is looked up per Metric
inside the map rather than once outside it. The Observation's Metric order is preserved, so cards interleave
by declaration. Each renderer additionally receives the `aggregation` the screen already computes. Everything
else — the `hasEnoughData` gate, the inline placeholder, `TimeRangeSelector`, `CustomTimeRangeModal`,
`TREND_CHART_HEIGHT`, the single measured `trendChartWidth` — is unchanged, `handleChartPointPress` included:
it reads only base fields and the Enum chart never calls it.

`NUMERIC_TREND_INSUFFICIENT_MESSAGE` in `chartDefaults.ts` is renamed `TREND_INSUFFICIENT_MESSAGE`, value
unchanged. A second chart type now shows it, and a name saying "numeric" would be the only thing on screen
claiming otherwise.

## 4. Verification

### Seed Data

No new Observation or Metric: `mixed metrics` carries `category` (`a`/`b`/`c`) and `no numeric` carries `mood`
(`low`/`ok`/`high`). At `1M` both draw one lane-filling mark per day-bucket — ten and five, across the newer
part of the window. At `1Y` every Record of either falls inside the newest 30-day bucket, giving one column
carrying all three shares. At `1D` both hang on the hour the seed ran: their Records sit at 09:00 on alternate
days and a 24-hour window holds exactly one 09:00, so a reseed after 09:00 leaves one mark and one before it
leaves the placeholder — both correct.

A year of *mixed* buckets is not reachable by hand, and neither fixture stretches to it: `no numeric`'s Record
count is load-bearing for `.maestro/2-3-record-deletion.yaml`, which deletes all five and asserts the empty
state, and `category`'s Records are shared with `flag` and `note`. Share sizing across many buckets is pinned
by unit tests instead.

Three things stop being true:

* `no numeric`'s seeded Observation description and the block comment above it both say the details screen
  renders neither the TRENDS section nor the selector. Both now do. Its new job is charts coming entirely from
  an Enum Metric, with a Boolean beside it still rendering none.
* `mixed metrics`' block comment describes its non-numeric Metrics as ones that never chart. `flag` and `note`
  still don't; `category` does.
* Five flows — `1-3-observation-details`, `2-2-record-actions-presentation`, `2-3-record-deletion`,
  `2-4-record-editing`, `2-8-unsaved-record-changes-confirmation` — open `no numeric` under a comment saying
  it has no TRENDS section, which is why its Records sit at the top. One card is short enough to leave the
  three tiles they reach for on the first screen, so only the reason needs rewriting: one chart rather than
  five. `1-3` also asserts `MOOD` is *not* visible before a Record is expanded, and the new card's title is
  the lowercase `mood` — whether that collides depends on Maestro's case sensitivity, which the E2E run
  settles.

No seeded Observation hides the TRENDS section any more. Accepted rather than paid for with a Text-only
Observation: Text metric markers is the last uncharted type on the backlog, and would close that state for
every Observation with any Metric the moment it lands. An `ObservationDetailsScreen` test keeps it covered.

[testing-data.md](../../../../testing-data.md) needs its `mixed metrics` and `no numeric` rows and
details-screen checklists updated to match.

### Manual Verification

Run **Reseed test data** first. No storage change, so there is nothing to clear.

1. Open `no numeric`. A TRENDS section and its selector now appear, with one card titled `mood` and none for
   `done`: three lanes labelled `high`, `ok`, `low` top to bottom, five marks each filling its lane, and lane
   separators but no value labels down the left. A `low` mark is the darkest green on the card and a `high`
   mark the lightest.
2. RECENT RECORDS and its first Records are still on the first screen below the card.
3. Switch to `1Y`: the five marks collapse into one column near the right edge carrying one mark per value
   recorded, each a fraction of its lane and together about one lane's worth of height. Switch to `1D` and
   confirm either a single mark or `Not enough data yet`, per the hour rule above.
4. Open `mixed metrics` at `1M`. `category`'s card sits after the five Numeric cards, in declaration order;
   `flag` and `note` still get none. Ten marks in the newer two-thirds of the window, lanes labelled `c`, `b`,
   `a` top to bottom.
5. Switch to `1Y`: `category` becomes one column of three sized marks, and every Numeric chart is exactly as
   before — curve, gradient fill, axes, dots, count labels.
6. Tap a `category` mark, and the empty space in its lanes: nothing happens, and the Numeric charts do not
   redraw. Then tap an aggregated `dense` point and confirm it still zooms, and a single-Record `sparse` point
   at `1M` that it still opens that Record.
7. Create an Observation by hand with a Choice Metric of four values, the longest 12 characters, and add two
   Records taking different ones: four lanes, four distinguishable greens, and the long value truncated inside
   the gutter rather than running over the marks.
8. Open `stale records` and `no records`: unchanged. Throughout, no card paints blank while the font loads —
   marks and separators are there before labels.

### Automated Tests

* **Unit — `GetMetricSeriesUseCase`:** an Enum Metric yields `kind: 'category'` points whose `shares` are in
  declared order, sum to 1, omit a value no Record took, and give a unanimous bucket one share of 1; a value
  outside `allowedValues` is dropped from the series and from `recordCount`, and a Metric with no constraint
  yields no points; base fields match what the same Records give a Numeric Metric; Numeric points are
  unchanged but for `kind`; `Boolean` and `Text` still throw.
* **Unit — `laneColors`:** the stated ramp for 2, 3 and 4 lanes, bottom lane first, each starting and ending
  on the shared endpoints, falling back to the 4-lane ramp above 4.
* **Unit — `chartAxis`:** `truncateToWidth` on a fitting string, a longer one, and a width too small for even
  an ellipsis; `toPlotRect` honours the gutter it is given and still collapses rather than inverting.
* **Unit — `EnumSwimlaneChart`** (on the existing Skia mock): a bucket's shares become one mark per share, in
  its value's lane counted from the bottom and coloured from that lane's ramp entry; a unanimous bucket draws
  one lane-filling mark and a tiny share lands on the minimum height; width follows `bucketSizeMs` and never
  crosses the plot's right edge; `laneCount + 1` separators, no value gridline or label; lane labels truncate
  to the gutter, are omitted while the font is `null`, and leave the plot rectangle identical either way; zero
  points and a Metric with no values render `TREND_INSUFFICIENT_MESSAGE`; no press ever calls `onPointPress`.
* **Unit — `rendererRegistry`:** `get('Enum')` returns `EnumSwimlaneChart`, `Boolean` and `Text` still absent.
* **Regression — `NumericTrendChart`:** its existing suite passes unaltered but for the `kind` its fixture
  points gain, which is what shows the axis extraction changed nothing it draws.
* **Screen — `ObservationDetailsScreen`:** Numeric and Enum Metrics each get a card, in declaration order; an
  Enum-only Observation renders the section and selector where before it rendered neither; an all-Boolean/Text
  one renders neither; a tap on an Enum card leaves selection, data and navigation untouched, with the
  existing tap, zoom and back-unzoom suites unchanged.
* **Unit — `devSeedData`:** `category` and `mood` each reduce to a single `1Y` bucket holding more than one
  Record and more than one share — the mixed regime the manual checklist relies on being reachable.
* **E2E:** `.maestro/3-11-enum-metric-chart.yaml`, on the `seed` fixture — opening `no numeric` and seeing the
  TRENDS section, the presets and a `mood` card where the screen previously had none, its Records still
  reachable below. What the swimlane draws is inside the canvas and out of a flow's reach.
