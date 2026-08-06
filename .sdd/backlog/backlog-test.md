# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

1. E2E for [3-11 Enum Metric Chart](../epics/3-observation-visualization/3-11-enum-metric-chart/spec.md):
   `.maestro/3-11-enum-metric-chart.yaml`, on the `seed` fixture — open `no numeric` and see the TRENDS
   section, the presets and a `mood` card where the screen previously had none, with its Records still
   reachable below. What the swimlane draws is inside the canvas and out of a flow's reach.
   `.maestro/1-3-observation-details.yaml` asserts `MOOD` is *not* visible before a Record is expanded,
   and the new card's title is the lowercase `mood` — whether those collide depends on Maestro's case
   sensitivity, which only a run settles.
2. E2E for [3-12 Boolean Metric Chart](../epics/3-observation-visualization/3-12-boolean-metric-chart/spec.md):
   `.maestro/3-12-boolean-metric-chart.yaml`, on the `seed` fixture — open `no numeric` and see a `done`
   card beside the `mood` one, with RECENT RECORDS and its Records still reachable below both. What either
   swimlane draws is inside the canvas and out of a flow's reach. `1-3` asserts `DONE` is not visible
   before a Record is expanded, where the new card's title is the lowercase `done` — the same case
   collision entry 1 leaves open, and whichever of the two runs first settles both.
3. `.maestro/3-2-numeric-metric-trend-chart.yaml` and `.maestro/3-4-time-range-selector.yaml` both end by
   opening `no numeric` and asserting it shows no TRENDS section and no time range selector — true only
   until 3-11 gave its Enum `mood` a card. Both tails need rewriting or dropping; neither has been run
   since.
