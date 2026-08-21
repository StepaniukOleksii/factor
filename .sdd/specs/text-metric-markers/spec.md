# Text Metric Markers

* 2026-08-18
* Feature: trend-charting.md

## 1. Goal

A Text Metric is the one kind the Trends section passes over. An Observation that asks for a written entry every time
leaves no trace of that entry on any card, so the screen built to say how things have been going is silent about the
part of the record a user wrote in their own words — and an Observation whose Metrics are all Text gets no Trends
section at all. Give a Text Metric a card of its own: a marker per bucket holding text, saying when something was
written rather than what.

## 2. Requirements

* A Text Metric gets a trend card.
* The card sits in the Observation's Metric order and is drawn over the section's shared window, like every other card.
* It draws one mark per bucket holding at least one Record with text, at that bucket's place in time.
* Every mark is the same size, whatever its bucket holds.
* A mark standing for more than one Record shows that count, in the wording the Numeric card already uses.
* The card never shows the text itself.
* Tapping the card does nothing.
* Where the Metric has no text in the window, the card shows the section's existing placeholder.
* The card is shorter than the others, and stays the same height whether it draws marks or the placeholder.
* Numeric, Yes/No and Choice cards keep the height they have now.
* Every card's plot starts on the same left edge, this one included.
* An Observation whose Metrics are all Text now gets a Trends section, where before it got none. This deliberately
  changes what [Trend Charting](../../features/trend-charting.md) says about which Metrics chart and when the section
  appears.

## 3. Technical Design

### 3.1 Application

`GetMetricSeriesUseCase` stops throwing for Text and reduces a Text bucket to a marker point.

`MarkerSeriesPoint` joins the `MetricSeriesPoint` union with `kind: 'marker'` and nothing else — every field it needs,
`MetricSeriesPointBase` already carries. The discriminant with no payload beside it is the point: a bucket folds several
Records, so there is no one text for it to carry, and a card this size has nowhere to put prose in any case.
`isMarkerPoint` joins the two existing guards, and `SeriesPointValue` gains the `kind`-only member the `reduce` switch
returns for `Text`.

`charts()` gains an explicit `Text` case: a value belongs in the series when it is a string. A value of whitespace alone
needs no rule here — it is not stored as a value at all. The `default: return true` arm is left to Numeric. Nothing else
in the use case changes — bucketing, ordering and the base fields are type-agnostic already.

### 3.2 Presentation — the renderer

`TextMarkerChart` (`src/presentation/charts/TextMarkerChart.tsx`), registered under `Text`, which completes the registry
over `MetricValueType`.

It follows `CategorySwimlaneChart`'s shape: `useAxisFont` first so the hook order never varies, then narrow `points`
with `isMarkerPoint`, then `InsufficientData` when none survive. It takes its plot from `toPlotRect`, so the gutter
every other card reserves is reserved here too — unlabelled, there being neither a value axis nor lanes to name — and
closes with `TimeAxisLabels`.

Marks take `COLORS.primaryContainer`, the one colour the section's other charts accent with. A mark standing for more
than one Record carries `formatPointCount(recordCount)` centred above it — the same wording, the same `99+` cap and the
same muted treatment the Numeric card gives an aggregated point, since it is the same statement about the same thing.

**The card is 40px tall** where the others are 108, registered per §3.3. The number is what the drawing needs rather
than a fraction of the old one: `PLOT_TOP_PADDING` above, `TIME_AXIS_HEIGHT` below, and a 20px band between them — the
halo's 8px with room above it for a count label, which is the only thing here that needs vertical space it does not
occupy.

That band is what sets the floor, so the count label's offset is 7px rather than the Numeric card's 9: that one clears a
halo sitting on a curve, and there is no curve here. At 7px the label's glyphs rise into the top padding without leaving
the canvas, and the card cannot go much below 40 without clipping them.

**It ships inert.** It uses neither `metric` nor `onPointPress`, and no `Pressable` wraps the canvas, so a tap reaches
the ScrollView beneath rather than being swallowed. Not because a target could not be defined — a marker carries a
bucket's identity exactly as a Numeric point does, so one could — but because the capability this slice delivers is
annotation, and a marker holds nothing a tap could reveal that opening the Record would not show better.
[ADR-7](../../adr/7-swimlane-tap-target.md) requires a renderer added after it to say which target rule it follows: this
one follows neither, and a later slice giving it a tap takes [ADR-5](../../adr/5-chart-tap-hit-testing-tolerance.md)'s
box unchanged, a mark being a point at its bucket's start rather than an interval across it.

**The mark is a dot on a centred rule** — a faint gridline across the middle of the plot with a haloed dot on it per
bucket, at `POINT_RADIUS`/`POINT_HALO_RADIUS`, and the count above the halo. The Numeric card's point vocabulary with
the curve and the fill taken away, which is close to literally what this card is, and the one shape whose marks cannot
be mistaken for a quantity. The screen it produces is [design/trend-card-dots.html](design/trend-card-dots.html).

### 3.3 Presentation — card height and the registry

`rendererRegistry` stops mapping a `MetricValueType` straight to a component and maps it to a registration pairing the
component with the height its cards are drawn at — `{renderer, cardHeight}`. Numeric, Yes/No and Choice register at 108,
the height they have today; Text registers at 40.

Both heights are declared beside the registrations, and `TREND_CHART_HEIGHT` is deleted from `ObservationDetailsScreen`,
which stops holding a chart dimension: a card's width is the screen's column to decide and the renderer must accept it,
while how much vertical room a drawing needs belongs to the drawing.

A fixed number per type rather than one computed from the Metric. Nothing needs the latter yet — a swimlane sized by its
lane count is what would — and it is a one-line change at the screen's single call site when something does.

`rendererRegistry.has` is unaffected, so the filter deciding which Metrics get a card is untouched.

### 3.4 Presentation — shared chart geometry

Two things two charts now share move to `chartAxis.tsx`, which already exists so that no two charts can drift into two
versions of the same axis:

* `timeToX`, with `spanToWidth` and `spanOf` beside it, lifted out of `CategorySwimlaneChart`. A third private copy is a
  third place a card's x scale can drift from its neighbours', which is the one thing the shared gutter exists to
  prevent. `NumericTrendChart.toScreenPoints` takes its x from it too, leaving one function deciding where a moment is
  drawn.
* The muted colour a Record count is written in, currently `POINT_COUNT_LABEL_COLOR` inside `NumericTrendChart`. Two
  renderers now write the same annotation and it has to read the same on both. The vertical offset stays with each
  renderer: it is measured from the mark it sits above, which is what differs between them.

### 3.5 Presentation — the screen

`ObservationDetailsScreen` changes only where the height came from. It reads the registration for a Metric and applies
`cardHeight` in the three places the constant reached: the `Renderer`'s `height` prop, the `trendChart` box whose layout
reports the canvas width back, and the `trendEmpty` placeholder rendered in the renderer's stead. The last is what keeps
a card from resizing as its window empties and fills, so the height must be applied inline in all three rather than left
in the `StyleSheet` rules that hold it now — and that reason cannot be read off the result, so it earns a comment where
the placeholder takes its height.

Nothing else moves: the section still picks its cards by `rendererRegistry.has(metric.type)`, still falls to the
placeholder on an empty series, and still passes `onPointPress` to a renderer free to ignore it.

Its `chartedMetrics.length === 0` guard stays, but now catches only an Observation holding no Metrics at all — which
`validateCreateObservation` refuses and no route creates, leaving the guard defensive rather than reachable. The test
asserting the section is omitted for a Text-only Observation is inverted rather than deleted (§4).

### 3.6 Seed data and documentation

No new fixture. `mixed metrics` already carries the Text Metric `note` on the same Records as `flag` and `category`, so
it aggregates to the same point counts they do — ten marks at `1M`, and two at `1Y` standing for seven Records and
three, which is where the count label can be read off a screen. Both states this slice adds are therefore already
seeded.

The Text-only Observation is the one state no fixture covers, and after this slice it is no longer a state: nothing
hides the Trends section any more. `testing-data.md` loses the sentences saying `note` never charts and that a Text-only
Observation would leave the section off, gains a `note` row in its per-preset table, and gains the card — and its
shorter stature — to its `mixed metrics` walk. The comment in `devSeedData.ts` on the shared flag/category/note loop
says the same thing and stops being true with it.

## 4. Verification

### Seed Data

None added — §3.6.

### Manual Verification

Reseed test data first.

1. Open `mixed metrics` at `1M` and scroll to the bottom of TRENDS: below `category` is a card titled `note`, visibly
   shorter than every card above it, with ten marks in the newer two-thirds of the window, all the same size, sitting at
   the same positions across the card as `category`'s ten columns above it. Its plot starts on the same left edge as
   every card in the section, its left gutter carries no labels, and its time labels read the same as theirs.
2. Switch to `1Y`: the ten marks collapse to two near the right edge, one carrying `7` above it and the other `3` — the
   totals `category`'s two columns divide between their lanes, written the way a Numeric card writes an aggregated
   point's count. The card stays the height it was.
3. Switch to `1D`: `Not enough data yet`, or a single unlabelled mark if the reseed ran past 09:00 — the same rule
   `flag` and `category` follow. The placeholder stands in the same short card, so nothing below it moves as the window
   changes.
4. Tap a mark, and the empty stretch beside it: nothing happens and the window selector stays where it is, while tapping
   a dot on a Numeric card above still zooms.
5. Create an Observation with one Text Metric and no others. Its details screen carries a TRENDS section, a window
   selector and one short card, where a Text-only Observation previously had none of the three. The card reads `Not
   enough data yet`.
6. On it, add a Record whose value is a word: one mark appears, and the card does not change height. Add another whose
   value is only spaces: no second mark, that Record having stored no value, while RECENT RECORDS shows both Records.

### Automated Tests

* **Unit:** `GetMetricSeriesUseCase` returns marker points for a Text Metric instead of throwing, carrying the bucket's
  `recordCount`, representative `recordId` and first/last Record times, and bucketing as the other types do; it drops a
  non-string value. `isMarkerPoint` narrows a marker point and rejects the other two kinds. `timeToX` puts the range's
  start at the plot's left edge and its end at the right.
* **Component:** `TextMarkerChart` draws one mark per point, the same size whatever each point's `recordCount`; writes
  the count only above a mark standing for more than one, capped at `99+`; draws the placeholder for an empty series;
  never calls `onPointPress` when tapped; and places a mark at the same x a swimlane places one for the same moment and
  window.
* **Registry:** `Text` resolves to a registration holding `TextMarkerChart` — replacing the test asserting the type is
  unregistered — every `MetricValueType` now has one, and the Text card's height is below the height the other three
  share.
* **Screen:** `ObservationDetailsScreen` draws each card at its own registered height, and gives a Metric's placeholder
  the same height as its chart. It renders the section, its selector and one card for an Observation whose only Metric
  is Text, replacing the test that expected all three to be absent; that test is kept for an Observation holding no
  Metrics at all, which is what the guard now covers.
* **Seed:** `devSeedData.test.ts` — `note` aggregates to the same per-preset counts as `flag` and `category`, which is
  what makes the numbers in the manual walk true. The existing `it.each` over those two takes `note` as a third case.

### E2E Flow

Extend `.maestro/flows/trend-charting/trend-charting.yaml`. Which Metrics get a card is exactly what that flow covers,
and this slice changes the answer.

* **Fixture:** `seed`, which it already opens from.
* **Covers, newly:** on `mixed metrics`, `note` now has a card — `scrollUntilVisible` it below `category`, which the
  flow already scrolls to, and assert it visible. **The flow's existing `assertNotVisible: "note"` is made false by this
  slice and must be flipped when the renderer registers, whether or not the rest of this brief is done at the same
  time** — left alone it turns the suite red. The comment above that block, which names `note` as the Metric type
  without a renderer, goes with it.
* **Not covered:** what the card draws, and how tall it is. It is a Skia canvas, so the marks, their uniform size and
  the count labels never enter the view hierarchy Maestro reads, and card height is a style rather than a selectable
  fact — unit tests and the manual walk own both.
* **Handles:** none new. The card title is a platform `Text` and is the assertion.
