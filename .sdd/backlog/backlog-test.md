# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

## Text Metric Markers — E2E flow

Queued from the implemented `text-metric-markers` slice. Its renderer is registered, so the flow's
`assertNotVisible: "note"` is false as it stands and turns the suite red until this is done.

Extend `.maestro/flows/trend-charting/trend-charting.yaml`. Which Metrics get a card is exactly what that flow
covers, and this slice changes the answer.

* **Fixture:** `seed`, which it already opens from.
* **Covers, newly:** on `mixed metrics`, `note` now has a card — `scrollUntilVisible` it below `category`,
  which the flow already scrolls to, and assert it visible. **The flow's existing `assertNotVisible: "note"`
  is made false by this slice and must be flipped when the renderer registers, whether or not the rest of this
  brief is done at the same time** — left alone it turns the suite red. The comment above that block, which
  names `note` as the Metric type without a renderer, goes with it.
* **Not covered:** what the card draws, and how tall it is. It is a Skia canvas, so the marks, their uniform
  size and the count labels never enter the view hierarchy Maestro reads, and card height is a style rather
  than a selectable fact — unit tests and the manual walk own both.
* **Handles:** none new. The card title is a platform `Text` and is the assertion.
