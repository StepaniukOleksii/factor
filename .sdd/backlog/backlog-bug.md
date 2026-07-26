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
4. `Record.updateValues` can add or overwrite a Metric value but never remove one — it iterates the incoming
   map and `set`s each key, so a Metric absent from the map keeps whatever value it already had rather than
   being cleared. `Record.removeValue` exists for exactly this and has no production caller (only its own
   unit test). Not reachable today: every Metric value is required, so `RecordFormScreen` never submits a
   Record with a value missing, and `UpdateRecordUseCase` always passes a full map. It becomes reachable the
   moment Metric values may be optional — a user clearing a value in edit mode would see the save succeed and
   the old value still there on re-open. Fix is either to have the update path replace the value map wholesale
   or to diff it and call the existing `removeValue`; the storage layer already deletes and re-inserts
   `record_values` rows on update, so nothing below the domain needs to change. Prerequisite for optional
   Metric values — see `2-6-boolean-metric-input`, which gives the Record form a control that can express
   "no value" but deliberately stops short of persisting one.
