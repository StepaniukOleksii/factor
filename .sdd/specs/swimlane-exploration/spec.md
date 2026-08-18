# Swimlane Exploration

* 2026-08-18
* Feature: trend-exploration.md

## 1. Goal

An Observation charting a Choice or Yes/No Metric beside a Numeric one puts two cards under one window, and
only one of them answers a tap: the Numeric card opens the Record behind a point or narrows onto the Records
behind several, while the swimlane next to it takes the same gesture and does nothing, with nothing on screen
saying why. Make a swimlane's bucket columns tappable, so a Record is reached the same way from every card the
Trends section draws.

## 2. Requirements

* A tap on a swimlane card is answered by the bucket whose drawn column is nearest it horizontally. A tap
  further from every column than [ADR-7](../../adr/7-swimlane-tap-target.md)'s tolerance allows leaves the
  card as it is, and which lane a tap landed in carries no meaning.
* A column standing for exactly one Record opens that Record for editing; a column standing for several
  narrows the whole Trends section onto the dates those Records fall on. Both are what a Numeric point already
  does ([Trend Exploration](../../features/trend-exploration.md)), including the point at which narrowing
  settles and the way the Android back button retraces it.
* A tap arriving while the section is fetching its Records is left where it fell, as one on a Numeric card
  is.
* A bucket that drew no mark is not a target.
* Everything the card draws is unchanged — lanes, marks, labels, colours and geometry — and no affordance is
  added to say the card can be tapped.
* Out of scope: any meaning for the individual lane or mark, and the per-value Record identity such a meaning
  would need. [ADR-7](../../adr/7-swimlane-tap-target.md) records why.

This replaces the rule [Trend Exploration](../../features/trend-exploration.md) currently states — that
exploration belongs to the Numeric card, a swimlane's marks being read rather than worked. That is a
deliberate change to shipped behaviour, not a correction of an out-of-date file, and its "Where taps apply"
paragraph is rewritten from this spec when the slice retires.

## 3. Technical Design

### 3.1 Hit-testing, shared

A new module, `src/presentation/charts/chartHitTest.ts`, becomes the one account of which mark a tap reaches.
It holds `TAP_TOLERANCE` and `nearestPointIndex`, both moved out of `NumericTrendChart.tsx` with the comment
citing [ADR-5](../../adr/5-chart-tap-hit-testing-tolerance.md) — so the two renderers cannot drift into two
tolerances, and so ADR-5's "the same box, or state why the marks are different" is answered in one file
rather than argued twice.

Nothing else is added to it. [ADR-7](../../adr/7-swimlane-tap-target.md) puts the swimlane on that same
nearest-by-x helper against that same tolerance, so what separates the two renderers is which coordinates
they hand it and which axes they check afterwards — not a second rule with a second constant to keep in
step. `nearestPointIndex` reads only the `x` of each candidate, so its parameter widens to `{x: number}[]`:
the Numeric renderer passes its screen points as before, the swimlane its column centres.

### 3.2 The swimlane renderer

`CategorySwimlaneChart` gains a `Pressable` around its `Canvas`, `testID="category-swimlane-chart-pressable"`,
mirroring `numeric-trend-chart-pressable` — a Skia canvas exposes no element of its own, so the wrapper is
what takes the press and what an E2E flow has to aim at.

The centres it hit-tests against come from the marks it already computes. Every mark of a bucket shares an
`x` and a `width`, both derived from the point's own time and `aggregation.bucketSizeMs` rather than from the
lane, so a bucket's centre is `x + width / 2` taken from any one of its marks. The horizontal half of
`toMark` is extracted into a helper that both `toMark` and the centre list call, rather than the formula
being written twice and clipped differently in each — the width is clipped at the plot's right edge, so a
bucket the window cuts short is centred on the bar actually drawn rather than on the one it would have been.
The list is built from `drawableCounts`' output grouped by point, in bucket order, which is what keeps a
bucket whose counts matched no lane out of the candidates.

`handlePress` reads `locationX` from the `GestureResponderEvent` and ignores `locationY`. It takes
`nearestPointIndex` over those centres and accepts the result when it is within `TAP_TOLERANCE` on that one
axis, then calls `onPointPress` with that column's whole `CategorySeriesPoint`. The renderer reports and
stops there; the screen decides what a tap means, as `rendererRegistry`'s contract already states.

The component's doc comment currently records that nothing here is tappable and that `onPointPress` is never
called. It is rewritten to state the column rule and cite ADR-7 — an implementer reading it must not be told
the opposite of what the code now does.

### 3.3 The screen

`ObservationDetailsScreen` needs no change. `handleChartPointPress` reads only the fields every series point
carries whatever its Metric's type — `recordCount`, `recordId`, `firstRecordAt`, `lastRecordAt` — so a
category point runs the same two branches a numeric one does, behind the same mid-fetch guard.

What that gives a swimlane is worth stating, because it is the answer to "how do I see what is in a mixed
bucket": a bucket is separated in time, never by value. A column folding several Records narrows the section
onto the days those Records fall on, where they redraw across finer buckets; a day-wide window buckets by the
hour, and a column still mixing values there stays one column. That is the same resting point the Numeric
ladder comes to, reached by the same arithmetic.

### 3.4 Deliberately unchanged

Nothing the card draws changes, so the slice has no mockup. `GetMetricSeriesUseCase` and `CategoryCount` are
untouched: no per-value Record identity is added, which is what keeps a lane-level meaning available to a
later slice rather than spent by this one.

## 4. Verification

### Seed Data

No new seed data. `no numeric` already carries the whole slice on one screen: two swimlanes and no Numeric
card, five one-Record day buckets each at `1M`, and two multi-Record columns at `1Y`. `mixed metrics` carries
`flag` and `category` beside five Numeric cards, which is where a swimlane tap narrowing every card in the
section can be seen.

[testing-data.md](../../../testing-data.md)'s manual checklist asserts on both those Observations that tapping a
mark does nothing. Those lines become untrue with this slice and are rewritten as part of it.

### Manual Verification

Reseed test data first.

1. Open `no numeric` at the default `1M`: `mood` draws five marks. Tap one — the Record behind it opens for
   editing, carrying both that mark's `mood` value and the same Record's `done` answer.
2. Cancel back, then tap the empty stretch midway between two marks: nothing moves and the selector still
   reads `1M`.
3. Tap near the top of the `mood` card, directly above one of its marks rather than on it: the same Record
   opens. A column is tapped anywhere down its height.
4. Tap `1Y`: both cards collapse to two columns near the right edge. Tap the older, wider one on `done` —
   every card in the section narrows to the days behind it, `mood` included, and the selector's last segment
   shows that range in place of the word `Custom`.
5. Press back once: `1Y` returns on both cards.
6. Open `mixed metrics`, tap `1Y`, and tap one of `category`'s two columns: the five Numeric cards above it
   narrow with it, over the same window, rather than staying where they were.

### Automated Tests

* **Unit** (`chartHitTest.test.ts`, new): `nearestPointIndex` keeps its own behaviour after the move — the
  nearest candidate by `x`, ties keeping the earlier one — over a list carrying no `y` at all, which is how
  the swimlane will call it.
* **Component** (`CategorySwimlaneChart.test.tsx`): the two tests asserting the card answers no press are
  replaced. A tap on a column's centre reports that bucket's point; a tap at the far end of a wide column
  still reports it, which is the case an anchor on the bucket's leading edge would have missed; a tap
  between two columns reports the nearer one, and nothing once it is beyond the tolerance of both; a tap
  left of the first column and right of the last, beyond tolerance, reports nothing; a tap at the top of the
  plot over a bucket whose marks are short still reports it; a bucket whose counts match no lane is not a
  target. The Boolean variant answers a press the same way.
* **Screen** (`ObservationDetailsScreen.test.tsx`): the test asserting an Enum card leaves the window and the
  Records alone is replaced by two — an Enum card's single-Record column navigates to `EditRecord` with that
  Record's id, and a multi-Record column narrows the window for every card in the section. A press arriving
  while the section is fetching still does nothing.
* **Regression:** `NumericTrendChart`'s existing press tests stay green unchanged, which is what proves the
  tolerance and nearest-point move did not alter the Numeric rule.

### E2E Flow

Extend [`.maestro/flows/trend-exploration/tap-a-chart-point.yaml`](../../../.maestro/flows/trend-exploration/tap-a-chart-point.yaml)
— the flow for what a tap on a chart does, and this is that same act on a second renderer.

* **Fixture:** `seed`, which the flow already opens from. Add a section on `no numeric`, which the flow does
  not currently visit.
* **Covers, newly:** at the default `1M`, a tap on a `mood` column opens the Record behind it — assert the
  Record form, then cancel back to the Observation. Then `1Y`, and a tap on the older of the two columns
  narrows the section: assert `time-range-custom` selected and the word `Custom` gone, as the flow already
  does for the Numeric ladder. Both branches, one representative pass each.
* **Handles:** `category-swimlane-chart-pressable` is new. `no numeric` draws two swimlane canvases sharing
  that id — `mood` above `done` — so the flow selects with an explicit `index: 0` rather than relying on the
  default first match.
* **Aim:** derived from the fixture's bucket grid and commented with that derivation, per
  [testing-android-e2e.md](../../../testing-android-e2e.md). A swimlane aim goes at the *middle* of a
  column where a Numeric one goes at a point, the target being 48px wide about that middle either way.
  `no numeric`'s Records sit at 09:00 on alternate days, 0 to 8 days back: at `1M` each falls in a day
  bucket of its own, about 3% of the plot wide, and at `1Y` the two oldest share the 30-day bucket running
  from roughly 90% to 99% across, so its middle is near 95%.
