# Boolean Metric Chart

* 2026-08-06

## 1. Goal

A Boolean Metric answers the plainest question there is — did it happen — and shows nothing for it.
[Boolean Metric Input](../../2-record-management/2-6-boolean-metric-input/spec.md) gave it a pair of segments to
answer with, and [Enum Metric Chart](../3-11-enum-metric-chart/spec.md) built the renderer a two-value Metric
wants, then registered it for `Enum` alone. So `no numeric`'s `done` sits beside a `mood` swimlane drawing
exactly the shape it needs, with nothing in it.

Chart a Boolean Metric as a two-lane swimlane, through that same renderer.

## 2. Requirements

* A Boolean Metric charts wherever a Metric with a registered renderer does: a card in the Trends section, in
  the Observation's own Metric order. An Observation whose only chartable Metric is Boolean gets the section
  and the time range selector.
* The chart draws two lanes — `Yes` above, `No` below — labelled with the words the Record form's own segments
  carry and in the order that form presents them, which is the rule an Enum chart's lanes already follow. The
  existing two-lane ramp colours them, and since a lane's colour and its position are the same index, `Yes`
  takes the dark end.
* Each bucket holding Records draws one mark per answer given in it, in that answer's lane and as tall as the
  Records that gave it. Everything else about the drawing is the Enum chart's, unchanged: the shared height
  scale and the rest of the mark geometry, the lane gutter and its labels, the time axis, the absent count
  label, and the "Not enough data yet" placeholder at zero points.
* A Record whose stored value for the Metric is not a boolean is excluded from the series, as one carrying no
  value already is.
* The Boolean chart reports no point and responds to no tap, as the Enum chart already doesn't — what a tap on
  a swimlane means is one decision for both, and still open.
* No new layout: the chart is the two-lane case of the Enum chart's
  [design](../3-11-enum-metric-chart/design/enum-metric-chart.html).

## 3. Technical Design

### 3.1 Domain

Unchanged. A Boolean Metric's two values are fixed by its type — `validateValue` refuses anything else — so it
carries no constraint, and its lanes come from the type rather than from `metric.constraint` as an Enum's do.

### 3.2 Application

`GetMetricSeriesUseCase` reduces `Boolean` to the `CategorySeriesPoint` shape `Enum` already produces. That
shape was named `'category'` rather than `'enum'` for this slice
([Enum Metric Chart](../3-11-enum-metric-chart/spec.md) §3.2), so nothing about the point union changes.

* `reduce` — `Boolean` joins `Enum` in returning `{kind: 'category', counts}`. Only `Text` still throws.
* **`CategoryCount.value` carries the value's canonical string form**: an Enum value verbatim, `'true'` or
  `'false'` for a Boolean. Not `Yes`/`No` — those words are presentation's, single-sourced in
  `metricDisplay.ts`, and a series carrying them would be a second place they were decided. A renderer matches
  a lane on this string and never on the label.
* The order `counts` is listed in becomes per-type where it read `allowedValues` outright: an Enum's declared
  order as before, and `'true'` before `'false'` for a Boolean — the order the Record form presents the two
  answers in, which is the relationship to the lanes that declared order already has (§3.4).
* The in-range filter, which drops a Record whose Enum value is not among `allowedValues`, additionally drops
  one whose Boolean value is not a boolean. Unreachable through the domain, like its Enum half, and kept for
  the same reason: `recordCount` stays equal to the number of Records the counts were taken over.

### 3.3 Storage

None.

### 3.4 Chart Rendering

**`EnumSwimlaneChart` becomes `CategorySwimlaneChart`** — file, component and test — and registers for
`Boolean` beside its `Enum` entry, one component under two keys. The same rename
[Enum Metric Chart](../3-11-enum-metric-chart/spec.md) §3.5 made to `TREND_INSUFFICIENT_MESSAGE`, for the same
reason: once the registry hands it Boolean Metrics, the old name is the only thing left claiming it draws
Enums. `Category` because that is the point kind it draws.

**A new `src/presentation/charts/chartLanes.ts`** answers the question the renderer can no longer put to
`metric.constraint`: which lanes a Metric has. `getChartLanes(metric)` returns `ChartLane[]` —
`{value: string; label: string}` — top lane first, so a lane's index is both its position counted down from
the plot's top and its entry in `getLaneColors`, exactly as a declared index is today.

* `Enum` — `toEnumOptions(metric.constraint as EnumConstraint | null)`, which already returns that shape in
  declared order, and nothing for a Metric with no constraint.
* `Boolean` — `BOOLEAN_METRIC_OPTIONS` with its values stringified, in the order it already declares them:
  `true`/`Yes` at index 0, `false`/`No` at index 1.
* Any other type — nothing, so a renderer handed a Metric it isn't registered for falls to the placeholder
  rather than dividing by a lane count of zero.

No reordering anywhere: both types hand over the list the Record form presents, and
[Enum Metric Chart](../3-11-enum-metric-chart/spec.md) draws that list downward from the top. `Yes` therefore
sits above `No`, which is also how a binary series reads wherever it is drawn — true is the high state. The
words come from `BOOLEAN_METRIC_OPTIONS`, so the chart and the Record form cannot disagree about them.

That leaves `Yes` on the ramp's dark end, where an Enum's first-declared value sits. The ramp is ordinal
rather than semantic — an index in the presented order, not a judgement about the answer — and one index
serving both position and colour is what keeps a single rule for both types. Giving `No` the dark end instead
would mean either putting `No` on top or reading the ramp backwards for one Metric type alone.

The module sits in `charts/` rather than in `metricDisplay.ts`, where the wording it reads lives: which lanes a
Metric has, and the canonical strings they match a series on, are this chart's business — `metricDisplay` owns
only how a value is spoken.

**`CategorySwimlaneChart`** takes its lanes from `getChartLanes(metric)` in place of `allowedValues`, draws
`lane.label` in the gutter, and finds a count's lane by matching `lane.value`. A count matching no lane is
skipped rather than drawn — and skipped before the shared height scale is taken, so it cannot silently set it:
lanes and series are now derived in two places, from the Metric's type here and from the same Metric's values
in the use case, and a mark at lane `-1` would paint above the plot instead of failing visibly.

Nothing else moves. The 48px gutter stays although `Yes` and `No` would fit a narrower one — one renderer with
one geometry is what keeps `no numeric`'s two cards, and `mixed metrics`' two, drawing their plots from the
same left edge. `getLaneColors(2)` already exists and already spans the same endpoints as the 3- and 4-lane
ramps. Nothing wraps the canvas in a `Pressable`, so the Boolean chart inherits the Enum chart's inertness
along with the rest.

### 3.5 Presentation — Observation Details Screen

Unchanged. `rendererRegistry.has(metric.type)` is what decides which Metrics get a card, so a Boolean one
starts charting the moment the registry entry exists — declaration order, the `hasEnoughData` gate, the
placeholder, the selector and `handleChartPointPress` all behaving as they already do.

## 4. Verification

### Seed Data

No new Observation or Metric: `mixed metrics`' `flag` and `no numeric`'s `done` both start charting, and that
is the whole of the change. `flag`'s Records share `category`'s timestamps exactly, so its card carries the
same bucket counts at every preset — 0-or-1, 4, 10, 2 — and the same 09:00 rule at `1D`; `done`'s share
`mood`'s, so five day-buckets at `1M` and two 30-day ones at `1Y`. Every `1M` bucket holds one Record, so every
count there is 1 and every mark fills its lane. At `1Y` each Metric folds into two columns of several Records,
where two answers in one bucket at different counts draw at different heights — the regime the shared scale
exists for. Which answers the fixture's Records carry is drawn from its seeded RNG, so a run in which every
`1Y` bucket splits evenly is possible; the height rule itself is pinned by unit tests rather than by the
fixture.

Three pieces of seeded prose stop being true, each of them user-visible or load-bearing:

* `no numeric`'s Observation description ends "the Boolean beside it still renders no card", and the block
  comment above it says the same. Its job becomes an Observation that charts without a Numeric Metric at all:
  one Enum swimlane and one Boolean.
* `flag`'s Metric description — shown in the Record form's info dialog — opens "Boolean, so it never charts".
  It is the only described non-Numeric Metric and should stay one, so it keeps its length and its dialog and
  changes its claim.
* `mixed metrics`' block comment, and the comment on its flag/category/note loop, both count `flag` among the
  Metrics that never chart. Only `note` still doesn't.

[testing-data.md](../../../../testing-data.md) needs `flag` added to the per-preset count table, both
observation rows and both details-screen checklists rewritten around the second card, the 09:00 paragraph
extended to `flag` and `done`, and its "only a Text- or Boolean-only observation would leave the section off"
narrowed to Text-only — the last remaining way to reach that state.

Five flows — `1-3-observation-details`, `2-2-record-actions-presentation`, `2-3-record-deletion`,
`2-4-record-editing`, `2-8-unsaved-record-changes-confirmation` — open `no numeric` under a comment saying it
charts only `mood`, one card. Two now, and the comments are the only change: a second card adds about 180px
above RECENT RECORDS, which leaves it and the first Records on a Pixel 7's first screen, and no flow scrolls
to reach them.

`1-3` also asserts `DONE` is not visible before a Record is expanded, where the new card's title is the
lowercase `done`. That is the collision [Enum Metric Chart](../3-11-enum-metric-chart/spec.md) left for its own
E2E run to settle — for `MOOD`/`mood`, in that same flow — and the run has not happened:
`.maestro/3-11-enum-metric-chart.yaml` is still on the [test backlog](../../../backlog/backlog-test.md).
Whichever flow runs first settles both.

### Manual Verification

Run **Reseed test data** first. No storage change, so there is nothing to clear.

1. Open `no numeric` at `1M`. Two cards: `mood` as before, and a new `done` below it — two lanes labelled `Yes`
   above `No`, five marks each filling one lane or the other (every bucket holds one Record), `Yes` the darker
   green. Both plots start at the same left edge.
2. RECENT RECORDS and its first Records are still on the first screen, below both cards.
3. Switch to `1Y`: `done` becomes two columns near the right edge. Each mark is as tall as the Records that
   gave that answer, measured against the busiest mark on the card — so an answer given twice where another
   was given once draws twice the lane, and only where the two columns split evenly do all four marks match.
   Switch to `1D` and confirm either a single mark or `Not enough data yet`, per the same 09:00 rule `mood`
   follows.
4. Tap a `done` mark, and the empty space in its lanes: nothing happens, and no chart on the screen redraws.
5. Open `mixed metrics` at `1M`. `flag`'s card sits between `insufficient` and `category`, in declaration
   order; `note` still gets none. Ten marks, each filling `Yes` or `No`.
6. Switch to `1Y`: `flag` collapses to two columns whose marks are sized by how many Records gave each answer,
   and every Numeric and Enum chart is exactly as before.
7. Tap **Add Record** on `mixed metrics`: `flag` still shows Yes/No segments beside its info button, and those
   are the words its chart labels its lanes with.
8. Create an Observation by hand with one Yes/No Metric and one Record: the TRENDS section and its selector
   appear for an Observation that would previously have had neither, with one two-lane card carrying a single
   mark in the answered lane and nothing in the other.

### Automated Tests

* **Unit — `GetMetricSeriesUseCase`:** a Boolean Metric yields `kind: 'category'` points whose counts are keyed
  `'true'`/`'false'`, listed `'true'` first, sum to `recordCount`, omit an answer no Record gave, and give a
  unanimous bucket one count of every Record in it; a stored value that is not a boolean is dropped from the
  series and from `recordCount`; base fields match what the same Records give a Numeric Metric; Enum points are
  unchanged; `Text` still throws.
* **Unit — `chartLanes`:** an Enum Metric's lanes are its declared values in declared order, label and value
  alike, and none at all without a constraint; a Boolean Metric's are `true`/`Yes` then `false`/`No` whatever
  its constraint; a Numeric or Text Metric has none.
* **Unit — `CategorySwimlaneChart`:** the existing Enum suite passes under the new name, unaltered; a Boolean
  Metric draws two lanes labelled `Yes` over `No`, coloured from `getLaneColors(2)` with `Yes` on the dark
  entry; a bucket where one answer was given more often than the other draws the two marks at heights in that
  ratio, on the same scale as the rest of the series; a count matching no lane is neither drawn nor allowed to
  set that scale; no press ever calls `onPointPress`.
* **Unit — `rendererRegistry`:** `get('Boolean')` and `get('Enum')` both return `CategorySwimlaneChart`;
  `Text` is still absent.
* **Screen — `ObservationDetailsScreen`:** a Boolean Metric gets a card, interleaved by declaration among
  Numeric and Enum ones; an Observation whose only Metric is Boolean renders the TRENDS section and selector
  where before it rendered neither; a Text-only one still renders neither — the last case left, and previously
  covered by the Boolean one.
* **Unit — `devSeedData`:** `flag` and `done` each reduce to at least one `1Y` bucket holding both answers —
  the mixed regime steps 3 and 6 rely on being reachable. Not that the two answers differ in count there:
  which answer each seeded Record carries comes from the RNG, and an assertion on that would pass or fail
  with the order the fixture happens to be built in.
* **E2E:** `.maestro/3-12-boolean-metric-chart.yaml`, on the `seed` fixture — opening `no numeric` and seeing a
  `done` card beside the `mood` one, with RECENT RECORDS and its Records still reachable below both. What
  either swimlane draws is inside the canvas and out of a flow's reach.
