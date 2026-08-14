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
4. A preset and a custom range covering the same span bucket their Records differently, so switching from `1Y`
   to the custom range the modal pre-fills from it redraws every chart at a different resolution without the
   window having moved. Seen on `mixed metrics`: `yearly` draws 13 points labelled `2`/`3` at the preset and
   ~26 unlabelled ones at the custom range; the Enum `category` redraws its marks at a fifth of their width,
   and Records that shared one bucket stop stacking as shares of a lane. Bucket size is chosen two ways —
   [`TIME_RANGE_PRESETS`](../../src/presentation/charts/chartDefaults.ts) pins 30 days to `1Y`, while
   `getAggregationForCustomRange` ignores tiers and targets ~30 buckets across whatever span it is given,
   so 366 days becomes `366 d / 30 = 292.8 h → 293 h` ≈ 12.2-day buckets, 2.4× finer. The time axis already
   does it the other way: `getTimeAxisTier` picks labels from the span alone "never from which preset produced
   it", which is why both charts read `Aug '25 … Aug '26` while bucketing differently. Both halves are the
   behaviour as described — [Trend Charting](../features/trend-charting.md) carries the preset table and the
   ~30-bucket rule side by side — so closing it is a change to what the app does rather than a fix of code
   against a document, and it changes what every existing custom range draws. The obvious shape is one
   span-keyed tier table both paths call, the way the axis labels already work; zoom would inherit it, since a
   zoomed window is a custom range.
5. The Create Observation screen marks no field as required until a save is refused. Requiredness is only
   inferable from a placeholder *not* reading `Optional — ...`, and MIN/MAX carry no placeholder at all, so
   optional bounds read as required on the same reasoning. Unmarked: OBSERVATION NAME, METRIC NAME, and a
   Choice Metric's first two VALUE rows.
6. The Create Observation screen's header carries a ⋮ button that does nothing — it has no press handler and
   no accessibility label, so it is a control in name only. Either give it the menu it implies or remove it;
   the Observation Details screen's ⋮ is the real one.
7. A failed Observation list load is indistinguishable from an empty one. The load logs and leaves the list
   as it was, which on first load is empty, so `No observations created yet.` is shown to a user whose
   Observations simply could not be read — with `Tap the + button to create one.` under it.
8. A failed Observation deletion tells the user nothing: the confirmation stays open with its buttons live
   again and the error only reaches the console. Record deletion, one screen away, alerts on the same
   failure.
9. Deleting an Observation is not atomic, though its spec asked for "a single atomic operation to prevent
   partial data removal". `DeleteObservationUseCase` awaits two independent writes: the Records go first,
   through a bare `DELETE FROM records WHERE observationId = ?`, and the Observation follows in a
   transaction of its own. A failure between them leaves the Observation holding nothing, with every Record
   already gone and no way to tell that from an Observation nobody ever recorded against. The fix is
   probably a deletion rather than a transaction: `records.observationId` is declared
   `ON DELETE CASCADE` and `PRAGMA foreign_keys` is on, so deleting the Observation alone already takes its
   Records with it, and dropping the first write makes the whole thing one statement.
