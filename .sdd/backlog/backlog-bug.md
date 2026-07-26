# Backlog — Bugs

This is an informal idea/issue capture list — not a specification. It exists to hold known bugs until
they're ready to become a real spec.

1. long press action on a Record tile on the Observation Details screen only works at the top of the tile, but should be
   applicable for the whole tile
2. do not use dismiss animation for modals
3. A second chart tap landing just after a window switch acts on the chart the switch is replacing. Reproduced
   on the emulator: at `1Y` on `mixed metrics`, tapping one aggregated `dense` point and then another ~200ms
   later zoomed to the first point's window (correct) and then opened a Record dated outside that window
   entirely — resolved against the previous window's series. `loadingTrends` is meant to swallow the second
   tap, and does not here: it is set inside `loadTrendData`, which runs from a `useFocusEffect`, so a render
   commits first in which the selection is already the new one, the fetched range and Records are still the
   old ones, and `loadingTrends` is still false. A tap in that gap is accepted against a chart drawn from
   stale data. Wide enough to hit reliably on the emulator, where five Skia charts re-render before the
   passive effect runs. Not specific to zoom — the TimeRangeSelector's own `disabled` reads the same flag,
   set the same way, so the presets likely have the same gap (not driven on-device, inferred from the code).
   Guarding on `loadingTrends` alone cannot close it; the tap handler would need to notice that the rendered
   window no longer matches the active selection, or the flag would have to be set before the render commits.
4. A Boolean Metric on the Record form cannot express `false` without toggling twice, and an untouched Switch
   is indistinguishable from one deliberately left off. `RecordFormScreen` renders `<Switch value={!!values[metric.id]}>`,
   so the control collapses three distinct states — not entered, `false`, `true` — onto two positions, and
   `undefined` and `false` both render as off. Consequences today: to record a `false` the user has to toggle
   on and then off again, since leaving the Switch alone stores nothing and `handleSave`'s required check
   rejects the Record with "This field is required" on a field that visibly reads "no"; and in edit mode a
   `true` can be changed to `false` but neither can be cleared back to no-value, because the Switch has no
   third position to return to. The fix needs a control with an explicit unset state — a tri-state
   (`Yes` / `No` / `—`) rather than a Switch — so that "no value" is something the user can both see and
   choose. Worth resolving before Metric values become optional: once a Record may carry a value for only
   some of its Metrics, "not entered" stops being a transient form state and becomes a stored one, and a
   control that cannot show it will misreport the data rather than just the form.
