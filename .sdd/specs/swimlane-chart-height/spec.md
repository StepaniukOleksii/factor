# Swimlane Chart Height

* 2026-08-21
* Feature: trend-charting.md
* [ ] Implemented
* [n/a] E2E tested

## 1. Goal

Every swimlane card stands the same height whatever its Metric declares, so its lanes divide one fixed plot between
them: 44px each on a Yes/No card, 22px on a four-value Choice. The Metric asking about the most things gets the least
room to answer in, and a mark of a given height stands for a different share of a lane on every card. Size a swimlane
from its lanes instead — one fixed lane height everywhere, and a card as tall as its lane count asks for.

## 2. Requirements

* Every lane on every swimlane card is 32px tall, whatever Metric the card draws.
* A swimlane card is as tall as its lanes plus the padding and time-label strip every chart already reserves: 84px at
  two lanes, 116px at three, 148px at four.
* Lane count comes from the Metric's declared values rather than from the values its Records took, so a Choice declaring
  four draws four lanes at every window, including one where only two were recorded.
* A card stands the same height whether it draws marks or `Not enough data yet`.
* Numeric and Text cards keep the heights they have.
* Nothing else about a swimlane changes: lane order, the colour ramp, the per-card height scale, the minimum mark
  height, and where a tap lands are all as they are.

## 3. Technical Design

### 3.1 The registry contract

`ChartRegistration.cardHeight` becomes `(metric: Metric) => number` — the change its own comment anticipates, having
declared one number per type because "nothing needs the latter yet". `NumericTrendChart` and `TextMarkerChart` return
their existing constants and ignore the argument; both swimlane registrations return `swimlaneCardHeight(metric)`.

The argument is the `Metric` and never the series, and the field's comment should say why rather than leaving the
signature to imply it: the screen needs a height before it knows whether the Metric has anything to draw, the `Not
enough data yet` placeholder standing in a box of the same size, and a height that moved with the data would reflow the
whole column every time the window changed. That is also what rules out giving a card only the lanes its Records
happened to take — a four-value Choice would come out two lanes tall on one window and four on the next.

### 3.2 Lane height and card height

`chartLanes.ts` gains `SWIMLANE_LANE_HEIGHT = 32` and `swimlaneCardHeight(metric: Metric): number`, beside
`getChartLanes` — lane count and lane height are one subject, and putting them there keeps `rendererRegistry.ts` from
taking a value import out of a module it already imports a component from.

A card's height is `PLOT_TOP_PADDING + laneCount * SWIMLANE_LANE_HEIGHT + TIME_AXIS_HEIGHT`, both constants
`chartAxis.tsx`'s and both exactly what `toPlotRect` carves back out — so `CategorySwimlaneChart`'s existing
`(plot.bottom - plot.top) / lanes.length` divides to 32 rather than to something near it. Neither that division nor any
of the mark geometry around it changes.

Lane count is floored at two. `getChartLanes` answers `[]` for a Metric it has no lanes for, and the renderer already
falls back to the placeholder in that case; the floor is what gives that placeholder the shortest legitimate swimlane
box rather than a 20px sliver. Two is also the fewest a real card can carry, a Choice declaring at least two and a
Yes/No exactly two.

32px is the smallest lane in which a mark still reads as tall or short: it leaves 26px between the lane's insets against
the 3px `MIN_MARK_HEIGHT` floor, where the four-lane card had 16. It also takes 24px off the Yes/No card, which is the
intended other half of the trade — 44px of lane is more ink than a binary answer carries.

### 3.3 The screen

`ObservationDetailsScreen` calls `cardHeight(metric)` where it read a number. Both the chart `View` and the `trendEmpty`
placeholder beside it already take that one value, so both follow with no further change. The shared `trendChartWidth`
measured by `onLayout` is unaffected: cards still differ in height alone.

`CategorySwimlaneChart`'s class comment should state that its lanes are a fixed height and its card is sized from them,
rather than leaving that to be inferred from a division.

[trends-swimlane-heights.html](design/trends-swimlane-heights.html) draws the section at `1M` with a Numeric card above
both swimlanes and the marker card below them, which is every height a column can now hold at once.

### 3.4 ADR-7's lane figure

[ADR-7](../../adr/7-swimlane-tap-target.md) rejects a lane-level tap target partly because it would put two meanings
inside "a lane 22px tall on a three-lane card, under the platform's minimum touch target". The conclusion survives
untouched, 32px being under 48 as well — but the figure stops being true, and 22px was the four-lane card's rather than
the three-lane card's to begin with. Correct it to the fixed lane height as part of this slice.

### 3.5 Seed data

In `devSeedData.ts`, `category` on `mixed metrics` declares `a`, `b`, `c`, `d` rather than `a`, `b`, `c`, and its
generator draws from the four. That puts every lane count a swimlane can have into the dataset — `flag` and `done` at
two, `mood` at three, `category` at four — where four is today unreachable without building an Observation by hand.
Aggregation counts Records per bucket and does not care which value one took, so `devSeedData.test.ts`'s per-preset
point counts are untouched.

The existing flows survive the fixture change. Only `trend-charting.yaml` names `category`, and only to assert its card
is on screen; `tap-a-chart-point.yaml` drives `no numeric`, whose two Metrics keep their lane counts, and aims at a
percentage of a card's own box, which a change of height does not move.

## 4. Verification

### Seed Data

`category`'s fourth value, per 3.5. `testing-data.md`'s `mixed metrics` row, its `category` and `note` checklist entries
and its account of what the swimlane fixtures cover are rewritten to match.

### Manual Verification

Reseed test data first.

1. Open `no numeric`: `mood` is the taller card and `done` below it the shorter, by one lane's worth, and a lane on
   either is the same height as a lane on the other.
2. Switch to `1D`, where both drop to `Not enough data yet` — or, after a reseed run past 09:00, to a single mark each.
   Each card keeps the height it had, so `done` stays shorter than `mood` and RECENT RECORDS below them does not move.
3. Open `mixed metrics` and scroll to the swimlanes: `flag` is the shortest card in the section, shorter than the five
   Numeric ones above it; `category` carries four lanes labelled `a`, `b`, `c`, `d` and is the tallest card on the
   screen; `note` below it is shorter than all of them and unchanged.
4. Every plot in that column still starts on the same left edge and spans the same time labels, so one moment sits at
   one place down the whole section however the cards differ in height.
5. Tap a column on `category`: the Record behind it opens, as before. Tap the empty stretch beside one, and nothing
   moves.

### Automated Tests

* **Unit:** `swimlaneCardHeight` returns 84, 116 and 148 for Choice Metrics declaring two, three and four values, 84 for
  a Yes/No, and 84 for a Metric it can find no lanes for.
* **Component:** `CategorySwimlaneChart`, given the height its registration declares, draws its lane separators exactly
  32px apart at two, three and four lanes, and keeps every mark inside its own lane.
* **Registry:** every registration's `cardHeight` is a function; Numeric and Text answer with their constants for any
  Metric; both swimlane registrations answer with their Metric's lane count height. The existing test asserting one
  shared height across the three plotted types is replaced by one asserting the swimlane's height varies with its Metric
  where the other two do not.
* **Screen:** `ObservationDetailsScreen` gives two swimlane Metrics of different lane counts cards of different heights,
  and gives a Metric's placeholder card the height its chart card would have had.
* **Seed:** `devSeedData` declares four values on `category`.
