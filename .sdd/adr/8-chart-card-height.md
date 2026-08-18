# ADR-8: A chart's card height belongs to its renderer registration

* Date: 2026-08-18

## Context

Every trend card is drawn at one height, from a `TREND_CHART_HEIGHT` constant private to
`ObservationDetailsScreen`. That held while every renderer filled its card the same way — a plot spanning it,
occupied by a value axis or by lanes.

A marker card has neither: one row of uniform marks over a time axis is the whole drawing, so at that height
most of the card is blank, and blank canvas inside a bordered card reads as a chart that failed to draw.

The question is where a card's height is decided, not what any one number is. It is worth settling rather than
special-casing because the pressure runs both ways: a Choice Metric at four values divides the same height
into 22px lanes, and a slice giving those lanes more room would want a height following the Metric rather than
only its type.

## Alternatives

1. **One height for every card.** Uniformity is worth something — the section reads as a column of equal
   cards. Ruled out because the alignment that matters is horizontal, the shared left gutter putting a moment
   at the same x on every card, and nothing is read vertically across cards. Appearance, bought with 60px of
   blank canvas per Text Metric.
2. **The renderer declares its own height and the screen measures the result.** The obvious move, and it
   fails on the placeholder: the screen renders that *instead of* the renderer when a window holds nothing, so
   a height only the renderer knows leaves an empty card standing at a different size than a drawn one.
3. **The registration carries a height computed from the Metric.** What a lane-sized swimlane would
   eventually want, and a guess until one exists — a signature settled by a function returning a constant for
   all four types.
4. **The registration carries a fixed height per Metric value type.** Chosen.

## Decision

`rendererRegistry` maps a `MetricValueType` to a registration pairing the renderer with the height its cards
are drawn at. The screen takes both from there, and applies that height to the canvas and to the placeholder
standing in for it, so a card is the same size whether it drew or not.

Height is declared where width is measured, deliberately: a card's width is the screen's column to decide and
the renderer must accept it, while how much vertical room a drawing needs is a property of the drawing.

## Trade-offs

* A renderer needing less room takes less, without the screen knowing anything about what it draws, and the
  registry stays the single per-type seam [ADR-1](1-visualization-rendering-foundation.md) set up.
* A section's cards are no longer all the same height — a visible change to a screen whose cards have always
  matched, accepted per alternative 1.
* A height that ought to depend on the Metric cannot be expressed, which is the deferred case below.

## Consequences

* A slice wanting a per-Metric height changes the registration's height from a number to a function of the
  Metric: one call site on the screen, no renderer touched. That is why taking the narrower shape now costs
  nothing later.
* A renderer added after this one is registered with a height chosen for its drawing, stated where the
  registration is rather than on a screen.
