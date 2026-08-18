# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

1. E2E: Observation editing (from the Observation Editing slice). A new flow,
   `flows/observation-editing/observation-editing.yaml` — this is the capability's first slice, so the folder
   does not exist yet.

   * **Fixture:** `seed`.
   * **Covers:** open `no records` from the list, ⋮ → Edit, replace the name, **Save Observation**, and assert
     the Observation's header carries the new name and the list row does too. Then ⋮ → Edit again, type
     `stale records` over it, save, and assert the collision is marked with the form still up — the one refusal
     worth an emulator, since it is the only rule whose input comes from outside the screen.
   * **Handles:** none outstanding. The menu's Edit item carries `accessibilityLabel` `Edit observation`,
     matching the Delete item's, and the implementation ships it. Everything else on the path is reachable by
     visible text: the button labels (`Save Observation`), the header (`Edit Observation`), and the pre-filled
     name field, which is tapped by the text it holds.

2. E2E: Swimlane exploration (from the Swimlane Exploration slice). Extend
   [`flows/trend-exploration/tap-a-chart-point.yaml`](../../.maestro/flows/trend-exploration/tap-a-chart-point.yaml)
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
     [testing-android-e2e.md](../../testing-android-e2e.md). A swimlane aim goes at the *middle* of a
     column where a Numeric one goes at a point, the target being 48px wide about that middle either way.
     `no numeric`'s Records sit at 09:00 on alternate days, 0 to 8 days back: at `1M` each falls in a day
     bucket of its own, about 3% of the plot wide, and at `1Y` the two oldest share the 30-day bucket running
     from roughly 90% to 99% across, so its middle is near 95%.
