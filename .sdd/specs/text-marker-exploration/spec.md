# Text Marker Exploration

* 2026-08-21
* Feature: trend-exploration.md
* [ ] Implemented
* [ ] E2E tested

## 1. Goal

The Trends section draws three kinds of card and two of them answer a tap: a Numeric point and a swimlane column each
reach the Records behind them, while a Text card takes the same gesture and does nothing. That leaves the card saying
least about what it stands for — a mark reports that something was written, never what — as the only one that will not
open the Record where the writing actually is. Make a Text card's marks tappable, so every card in the section answers a
tap the same way.

## 2. Requirements

* A tap on a Text card is answered by the mark nearest it horizontally, and only when it falls within
  [ADR-5](../../adr/5-chart-tap-hit-testing-tolerance.md)'s tolerance of that mark on both axes. A tap further off
  leaves the card as it is.
* A mark standing for exactly one Record opens that Record for editing; a mark standing for several narrows the whole
  Trends section onto the days those Records fall on. Both are what a Numeric point already does ([Trend
  Exploration](../../features/trend-exploration.md)), including where narrowing settles and how the Android back button
  retraces it.
* A tap arriving while the section is fetching its Records is left where it fell, as one on either other card is.
* Everything the card draws is unchanged — the rule, the marks and their one size, the counts above them, the labels —
  and nothing is added to say the card can be tapped.
* Out of scope: putting what a Record's text says onto the card or beside it. A mark still reports only that something
  was written, and the Record a tap opens is where the writing is read.

This replaces the rule [Trend Exploration](../../features/trend-exploration.md) currently states — that Numeric, Yes/No
and Choice cards are the ones answering the gesture, a Text card's marks being read rather than worked. That is a
deliberate change to shipped behaviour, not a correction of an out-of-date file, and the feature's Goal, its "What a tap
lands on" paragraph and its Usage are rewritten from this spec when the slice retires.

## 3. Technical Design

### 3.1 What a tap reaches

A marker is a dot drawn on its bucket's start, which is exactly the mark
[ADR-5](../../adr/5-chart-tap-hit-testing-tolerance.md) was written for: the nearest candidate by `x`, ties keeping the
earlier one, accepted when it lies within `TAP_TOLERANCE` of the tap on both axes. ADR-5 asks a renderer hit-testing
after it either to take that same box or to state why its marks are different, and this one's are not — where the
swimlane needed [ADR-7](../../adr/7-swimlane-tap-target.md) because it draws a bar spanning its bucket, so that the
bucket's start is only where the bar begins, a marker sits on the anchor as a Numeric point does. The rule is therefore
taken whole, no ADR is written, and `chartHitTest.ts` is not touched.

The vertical comparison is written even though the card is currently too short for it to exclude anything. The rule the
marks sit on is 16px down a 40px card, so the box's lower bound falls exactly on the card's bottom edge and every tap
that can land on the canvas is within tolerance vertically: the target is the card's whole height, and a mark is reached
from directly above or below it as readily as from on it. That follows from the height rather than from a second rule —
a card a pixel taller would begin excluding its own bottom edge — so the comparison stays, with a comment saying why it
looks redundant, rather than being dropped for an x-only variant that would need its own justification.

### 3.2 The renderer

`TextMarkerChart` gains a `Pressable` around its `Canvas`, `testID="text-marker-chart-pressable"`, beside the existing
`numeric-trend-chart-pressable` and `category-swimlane-chart-pressable` — a Skia canvas exposes no element of its own,
so the wrapper is what takes the press and what an E2E flow has to aim at.

Its candidates are the marker points it already filters, in bucket order. Every one of them draws a mark, so unlike the
swimlane there is no drawn-versus-undrawn distinction to keep and the filtered list is the candidate list. Each mark's
screen `x` is computed once into a list the drawing and the hit test both read, rather than being derived inside the JSX
map as it is now and again in the handler — the discipline `toBar` already gives the swimlane, for the same reason: one
derivation cannot disagree with itself.

`handlePress` reads `locationX` and `locationY` from the `GestureResponderEvent`, takes `nearestPointIndex` over that
list, and calls `onPointPress` with the whole `MarkerSeriesPoint` when the nearest mark is within `TAP_TOLERANCE` on
each axis. It reports and stops there; what the tap means is the screen's, as `rendererRegistry`'s contract already
states.

The component's doc comment records that the card ships inert, that neither `metric` nor `onPointPress` is used, and
that a mark holds nothing a tap could reveal. The first two stop being true and the third is now answered by opening the
Record, so it is rewritten to the rule above — an implementer reading it must not be told the opposite of what the code
does. `metric` genuinely stays unused: the card has neither lanes nor a value axis to take from it.

The empty-window card is unchanged, returning `InsufficientData` ahead of the `Pressable`, so a window holding no text
has nothing to press — as on both other renderers.

### 3.3 The screen

`ObservationDetailsScreen` needs no change. `handleChartPointPress` reads only `recordCount`, `recordId`,
`firstRecordAt` and `lastRecordAt`, which a `MarkerSeriesPoint` carries like every other point, so a marker runs the
same two branches behind the same mid-fetch guard.

What that gives a Text card is worth stating, because it is the answer to "what did those entries say?". A mark folding
several Records narrows the section onto the days behind them, where they redraw as marks of their own until each stands
alone and can be opened — the only way this card separates them, a mark carrying no text to tell one from another. The
ladder rests where the Numeric one does: a day-wide window is bucketed by the hour, and a mark still folding several
Records at that resolution stays one mark.

### 3.4 Deliberately unchanged

Nothing the card draws changes, so the slice has no mockup. `GetMetricSeriesUseCase` and `MarkerSeriesPoint` are
untouched — no per-Record text is threaded onto the series, which is what keeps the card honest about folding several
Records into one mark and leaves a richer reading to a later slice that has a reason for one.

## 4. Verification

### Seed Data

No new seed data. `mixed metrics`' Text metric `note` carries both branches on one screen: ten one-Record marks at `1M`,
and at `1Y` two marks standing for seven Records and three. They are drawn over the same buckets as the `flag` and
`category` swimlanes above them, which is where a narrowing tap can be seen carrying every other card in the section
with it.

[testing-data.md](../../../testing-data.md)'s manual checklist asserts on `mixed metrics` that tapping a `note` mark
does nothing. That line becomes untrue with this slice and is rewritten as part of it. So is
[testing-android-e2e.md](../../../testing-android-e2e.md)'s `testID` rule, which enumerates the ids in use and already
misses the swimlane's.

### Manual Verification

Reseed test data first.

1. Open `mixed metrics` at the default `1M` and scroll to `note`: ten marks on the rule. Tap one — the Record behind it
   opens for editing, carrying its `flag` answer and `category` value beside its own text.
2. Cancel back, then tap the rule midway between two marks: nothing moves, and the selector still reads `1M`.
3. Tap the card's top edge directly above a mark, then its bottom edge below one: the same Record opens from either, the
   card being shorter than the target is tall.
4. Tap `1Y`: `note` collapses to two marks carrying `7` and `3`. Tap the one labelled `7` — every card in the section
   narrows onto the days behind those Records, the five Numeric cards and both swimlanes with it, and `note` redraws
   those seven as marks of their own.
5. Press back once: `1Y` returns on every card.

### Automated Tests

* **Component** (`TextMarkerChart.test.tsx`): the test asserting the card answers no press is replaced. A tap on a mark
  reports that bucket's point; a tap between two marks reports the nearer one, and nothing once it is beyond the
  tolerance of both; a tap left of the first mark and right of the last, beyond tolerance, reports nothing; a tap at the
  card's top edge and one at its bottom edge, both over a mark, each report it, which is what the card's height buys; a
  chart rendered tall enough for the vertical bound to bite reports nothing for a tap far off the rule, which is what
  shows the rule is ADR-5's box and not an x-only variant; and a window holding no text exposes no press handler at all.
* **Screen** (`ObservationDetailsScreen.test.tsx`): a Text card's single-Record mark navigates to `EditRecord` with that
  Record's id, and a multi-Record mark narrows the window for every card in the section — reached through a helper
  mirroring the existing `pressChartPoint` and `pressSwimlaneColumn`. A press arriving while the section is fetching
  still does nothing.
* **Regression:** `NumericTrendChart`'s and `CategorySwimlaneChart`'s press tests stay green unchanged, which is what
  shows the shared helper and its tolerance were not disturbed.

### E2E Flow

Extend [`tap-a-chart-point.yaml`](../../../.maestro/flows/trend-exploration/tap-a-chart-point.yaml) — the flow for what
a tap on a chart does, and this is that same act on a third renderer.

* **Fixture:** `seed`, which the flow already opens from. Add a section on `mixed metrics`, which the flow does not
  currently visit.
* **Covers:** one pass, at the default `1M` — a tap on a `note` mark opens the Record behind it: assert the Record form,
  then cancel back. The narrowing branch is not repeated here. The flow already walks it twice, and it runs through the
  screen's own handler either way; what is new, and what no Vitest press can see, is whether a 40px-tall canvas takes a
  press at all.
* **Handles:** `text-marker-chart-pressable` is new, and `mixed metrics` draws exactly one, so no `index` is needed. The
  card is the last of eight in the section, so the flow scrolls it into view first and requires it fully visible — an
  element-relative `point` is measured from the element's bounds, so a card half off-screen puts the aim somewhere else.
* **Aim:** derived from the fixture's bucket grid and commented with that derivation, per
  [testing-android-e2e.md](../../../testing-android-e2e.md). A marker is drawn on its bucket's start, where a Numeric
  point is drawn and not where a swimlane column's middle is, so `note`'s 09:00-on-alternate-days Records put the newest
  mark 29/30 across the plot: 96% of the canvas, the figure the flow already aims a `1M` day bucket at. 50% vertically,
  the rule running across the middle of the plot. A run starting before 09:00 leaves that newest Record in the future
  and outside the window, and the mark then nearest the aim is one day bucket to its left — well inside the tolerance,
  and it opens a Record just the same, which is why the assertion names the form rather than a particular value.
