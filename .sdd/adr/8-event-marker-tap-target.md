# ADR-8: Event marker tap target

## Context

[ADR-5](5-chart-tap-hit-testing-tolerance.md) settled how much of a chart belongs to a point, on a premise it states
plainly: the charts are Skia canvases, nothing inside one is an element, no mark can carry a touch target of its own, so
every rule is arithmetic on the tap position. [ADR-7](7-swimlane-tap-target.md) extended that to the swimlane and closed
by requiring a renderer added later to follow the same 48x48px box or say why its marks are different.

An Event marker is not a renderer's mark. It stands for something owned by no Observation, drawn identically on every
card in the section; its position comes from a moment rather than from the series the card is drawing ([Trend Event
Overlay](../features/trend-event-overlay.md)); and what a tap on one means — naming the Events behind it — is not an
answer to "which of your marks did I hit".

Three facts bound the answer. A swimlane column already answers anywhere down the plot's height (ADR-7), so any marker
target living inside that canvas competes with a mark claiming the whole card at that position. Every renderer reports
through one shared callback carrying one series point, so a marker reported that way widens that contract into a union
for the sake of something no renderer owns. And a marker's position is continuous where a mark's is not: points sit on
the bucket grid, which is what lets ADR-5 count on them never being drawn closer than about 10px, while two Events may
fall at the same instant.

## Alternatives

1. **Hit-test markers inside each renderer, beside its own points.** The consistent reading: everything in a card is
   arithmetic, as ADR-5 requires. Ruled out because it spreads one rule across three renderers — each would need the
   marker geometry as well as its own, and each would answer the precedence question (a marker before a mark) again,
   with nothing forcing the three answers to match. It also widens the renderer callback to carry something that is not
   a series point, on every renderer, including any added later that draws no markers of its own.
2. **No target at all — a marker draws and names nothing.** Genuinely in contention, and the smallest thing that could
   have shipped: markers would say *when* something happened, and identity would wait for a slice that lists Events.
   Ruled out because the overlay's whole claim is that a dip lines up with something nameable, and a rule that cannot be
   asked what it is leaves two Events that share a name — which the domain allows — indistinguishable on the chart.
3. **One transparent layer over the card, picking the nearest handle by x.** ADR-5's own method, applied to markers: the
   layer takes the press, arithmetic names the handle, and crowding needs no grouping because nearest-by-x has already
   chosen. Ruled out because that layer is one element, so no handle is an element — and a handle that is not an element
   carries no `accessibilityLabel`, which is the only thing a screen reader can announce and the only thing an E2E flow
   can tap by ([testing-android-e2e.md](../../testing-android-e2e.md)). ADR-5 pays that price because a canvas leaves it
   no choice; a marker layer has a choice, and reachability is worth more here than the arithmetic saves.
4. **A handle over the plot, small enough not to reach far into it.** What a smaller box buys is a shallower band and
   less grouping; what it costs is the platform minimum, and a miss is not harmless — a tap falling outside the handle
   reaches the canvas, which answers by opening a Record. Ruled out because trading "this handle stands for two Events"
   for "the wrong screen opened" is the worse bargain, and Android flags sub-48dp targets besides.
5. **A handle over the plot at the full 48px.** What shipped first in this decision, and what the two above were weighed
   against. Ruled out by the cards themselves: the box covers the chart under it and wins every tap inside it, so a mark
   of the Metric's own falling there cannot be reached at all — and on a Text card, which stands 40px tall, the box is
   taller than the whole chart, so every tap at that position is the marker's. No placement on the plot avoids that,
   because the target is taller than the thing it sits on.
6. **A handle in a band of its own, above the plot.** Chosen.

## Decision

A marker is two layers over one position. The rule is drawn inside the renderer's own canvas, first, so it paints behind
that card's marks. The handle is a platform element in a layer over the card, transparent to touches except where a
handle sits, carrying ADR-5's tolerance on both axes — the same 48x48px box a Numeric point gets.

**The handle sits above the plot, not on it.** Every card reserves a shallow band between the Metric's name and the
plot, and the handle is drawn in it, at the top of its own rule. The band is the canvas's, carved off the top by
`toPlotRect` the way the time-label strip is carved off the bottom, so the rule is one line drawn by one system and the
renderers inherit the band without knowing what it is for.

The band is shallower than the target because **the target need not be centred on the handle.** Above a handle is the
Metric's name, which takes no taps, so a box reaching up over it costs nothing; below it is the chart, where every pixel
costs a tap. The box is therefore biased upward, and the band has only to be deep enough for the downward half — which
is what keeps a 48px target off the charts for a fraction of 48px of card.

Layering is what decides precedence: the handle takes the press before the chart's own `Pressable` sees it. With the box
clear of the plot there is nothing left for that to take, which is the point — a tap either meant the marker or meant
the chart, and its position says which. The renderers keep one callback with one meaning, and ADR-5 and ADR-7 are
untouched.

Both layers take their position from `timeToX` against the same plot rectangle, so the handle cannot drift off the rule
it belongs to unless the plot rectangle itself differs.

**Handles are grouped where their targets would overlap**, one handle standing for the Events under it, and what it
stands for is named when it is tapped. Grouping is not cosmetic: two overlapping targets are two elements, and an
overlap between elements is settled by which was drawn last, so without grouping an Event becomes unreachable rather
than merely fiddly. This is the rule ADR-5 does not need, because bucketing spaces its points and nothing spaces Events.
The rules are not grouped: each Event keeps its own at its true moment, because a grouped rule would sit at a moment
nothing happened at.

A grouped handle therefore covers its whole group rather than one point in it, and its target is that span where the
span is the wider. ADR-5's 48px is a floor here rather than a size — the minimum a handle may offer, not the most.

## Trade-offs

Benefits: precedence and geometry are stated once rather than per renderer; the renderer contract does not grow a second
kind of answer; a marker is reachable by a screen reader and selectable by name in an E2E flow, which nothing else drawn
on a card is; and no tap is taken from any chart, so the control costs the charts nothing but height.

Costs:

* **Every card grows by the band, on every card in the section at once.** The section is already a long scroll, and this
  lengthens it. Paid on a window holding an Event and not otherwise, so a card carrying nothing to mark is unchanged.
* **Grouping is the common case, not an edge case.** The threshold is the target's own width, which is a span of time
  rather than a fixed one: about five days across a month-wide window and about two months across a year. A wide window
  therefore shows few handles, each standing for several Events, and what a handle opens has to carry a list rather than
  an Event.
* The rule and the handle are drawn by two different systems over one position, which is a seam.

## Consequences

* A later slice giving a marker a second meaning — narrowing the section onto an Event's own stretch of time, which is
  what the backlog has next for Events — changes what the handle does and touches no renderer.
* An Event that carries an end as well as a start draws a band rather than a rule. That band is drawing, so it belongs
  in the canvas with the rules; where its handle goes is this decision's, and one handle per Event still holds.
* A renderer added after this one inherits the marker band and layer without doing anything, since the band is carved by
  the shared plot helper and the layer is the screen's. What it still owes ADR-5 and ADR-7 is unchanged.
* The seam holds only while both layers read the plot rectangle the chart is drawn in; a renderer that insets its own
  plot further would part them, and is the change that reopens this.
* A card whose chart is shorter than a target no longer has a worst case here, which is what makes the Text card
  ordinary. A renderer added later may draw a chart of any height without asking what that does to a marker.
