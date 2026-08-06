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
