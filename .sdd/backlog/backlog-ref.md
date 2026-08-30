# Backlog — Refactors

This is an informal idea/issue capture list — not a specification. It exists to hold loose refactor notes until they're
ready to become a real spec.

1. Share the Observation form body between `CreateObservationScreen` and `EditObservationScreen`, rather than merging
   the screens the way one Record form serves both creating and editing. Extract the sticky name field and the
   scrolling description / METRICS / Add Metric section into one component in `components/`, and leave each screen its
   own header, footer, dialogs, load and save.

   What settles it is that the duplication and the difference do not overlap. 91 of the creation screen's 127
   meaningful lines appear verbatim in the edit screen, and all of them are that body — the two fields, the card list,
   the three metric handlers and the styles. Everything the two screens do differently sits outside it: the initial
   state, the load with its `Loading...` and `Not found` states, the taken names excluding its own, the header's right
   action, the footer's label and spinner, which validator and which use case, the discard listener, and the removal
   confirmation. One screen holding both would carry about ten branches to keep those apart, and would save only the
   second file's imports and props type. Extracting the body takes the whole overlap and branches on nothing.

   [The Record form](../../src/presentation/screens/RecordFormScreen.tsx) is the merged shape and prices it: eight
   `isEditMode` branches and a `recordId` check in its load, across 625 lines with a 1463-line test beside it — for a
   pair that differs less than this one, since a Record's fields are the same in both modes where an Observation's
   Metric cards are not.

   Metric removal is what made the body shareable. `onRemove={metrics.length > 1 ...}` is now the same line in both
   screens, and `stored={metric.id !== undefined}` is false for every draft a creation form holds, so the shared body
   needs no mode flag at all.

   Two drifts the copies have already accumulated, which sharing settles by construction: creation has no `saving`
   state, so its button carries no spinner and nothing stops a second tap landing mid-write, where editing has both;
   and `stickySection` is `padding: 16` in one screen and three padding properties around a wrapper `View` in the
   other. The dead ⋮ in creation's header belongs to the header rather than the body — it is bug 6 in
   [backlog-bug.md](backlog-bug.md).

   Merging would still hand creation the discard prompt only editing has today, which is a behaviour change and not a
   free one. Extraction leaves it alone: whether a half-filled creation form should ask before it closes is worth
   deciding on its own.

   Expected shape: creation drops to roughly 130 lines and editing to roughly 290. The screen tests reach in by field
   label and testID, so they survive the move, and the Maestro flows select on visible text and are untouched.

