# ADR-5: Chart tap hit-testing tolerance

* Date: 2026-08-15

## Context

A trend chart renderer reports which of its points a tap hit; what that means — opening a Record, narrowing the
window — belongs to the screen ([Trend Exploration](../features/trend-exploration.md)). This decision settles
the other half: how much of a chart belongs to a point.

The charts are Skia canvases, so nothing inside one is an element and no point can carry a touch target of its
own. The whole canvas takes the press and the renderer works out, from one pair of coordinates, which point was
meant — every rule here is arithmetic on the tap position, not layout.

Two forces bear on the answer. Points sit on the bucket grid laid over the window, so their spacing is decided
by the window rather than by the data: about 10px apart across a month of day buckets on a phone-width card,
about 24px across a year of 30-day ones. And a chart drawing a single dot has no neighbour to be nearer than,
so whatever bounds the tap is the whole of what stops it acting from across the canvas.

## Alternatives

1. **Nearest point by x, bounded vertically only.** What the chart shipped with. Ruled out: it is the defect —
   with no horizontal bound a tap reaches a point however distant, so on a single-point chart every tap within
   a comfortable distance of the dot's *height* acts, which is most of the canvas.
2. **Each point owns its bucket's horizontal slab.** The principled model: a bucket is a slab of time, a tap
   inside one unambiguously names it, and a bucket holding no Records is inert for free. Ruled out because it
   makes the target a function of the window rather than of the finger — a slab is about 10px wide at the day-
   and custom-bucketed windows and about 12px across an hour-bucketed day, a quarter of the platform's 48dp
   minimum touch target, so the same gesture would be comfortable at one window and impossible at the next.
3. **One tolerance, compared per axis.** Chosen.

## Decision

A tap lands on the point nearest it horizontally when it falls within one fixed tolerance of that point on both
axes, compared independently: a 48x48px box centred on the point, from a tolerance of 24px — the platform's
minimum touch target, and the value the vertical bound already used. A tap outside it lands on nothing, and the
renderer reports nothing.

Which point a tap is tested against is unchanged: nearest by x, ties keeping the earlier one. The tolerance
decides only whether that nearest point is close enough.

## Trade-offs

Benefits: a point's target is the same size at every window and on every device; the rule states in one sentence
and transfers to any renderer that puts marks on a plot; and empty stretches are inert, which is what makes a
tap mean "this point" rather than "this chart".

Costs:

* **On a dense chart the boxes overlap**, several points being within 24px of one tap. Harmless, since
  nearest-by-x has already chosen before the box is consulted — but the box is therefore not a partition of the
  chart, and reasoning about it as one will mislead.
* **A wide window drawing few points leaves most of its canvas inert**, with nothing on screen to say so.
  Accepted: the alternative is a tap that acts from a distance.
* The number is in pixels, so a chart drawn much larger than a phone card keeps a target sized for one.

## Consequences

* A renderer added later hit-tests against the same box, or states why its marks are different.
* **An E2E flow tapping a chart must aim inside the canvas** rather than take its centre, at a position derived
  from the fixture's bucket grid. [testing-android-e2e.md](../../testing-android-e2e.md) carries that rule; it
  applies to every chart flow from here on, not to one fixture.
* A seeded fixture is free to place its Records anywhere: where a chart draws them decides where a flow aims,
  never whether a tap can reach them.
