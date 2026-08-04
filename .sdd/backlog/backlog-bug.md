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
4. A fraction cannot be typed into a Numeric Metric's value on the Record form. Typing `0`, `.`, `5` leaves
   the field reading `5`: the separator is dropped on the keystroke that enters it, and the leading zero goes
   with the next digit. Trailing zeros die the same way — `1.50` collapses to `1.5` while it is still being
   typed. `renderMetricInput` in `RecordFormScreen` parses on every keystroke and renders the parsed number
   back (`value={String(values[metric.id])}` against an `onChangeText` that stores `parseFloat(text)`), and
   `String(number)` cannot represent input mid-typing. A comma is worse than a dot: `parseFloat('0,5')` is
   `0` rather than `NaN`, so on a keyboard whose decimal separator is a comma the value saves as **0** with
   no error — wrong data rather than a refusal. Nothing catches it automatically because both the screen
   tests and the Maestro flows deliver text in one shot, which parses cleanly; only keystroke-by-keystroke
   entry reproduces it. Found while verifying Numeric Metric Boundaries, whose §4 step 4 (`0.5` into `dense`)
   cannot be performed until this is fixed. The fix is the model the authoring screen already uses — the form
   holds the text that was typed and parses once at save, with `Number(...)` rather than `parseFloat` so
   `0,5` is refused instead of truncated. The non-trivial part is the dirty check: `valuesDiffer` compares
   form values against the loaded Record's numbers, so `'7.2'` against `7.2` would read as an edit and raise
   the unsaved-changes dialog on an untouched form. The MIN and MAX fields on Create Observation are
   unaffected — they hold raw text and are parsed once, in `CreateObservationUseCase`.
