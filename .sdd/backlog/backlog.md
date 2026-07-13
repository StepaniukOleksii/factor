# Backlog

This is an informal idea/issue capture list — not a specification. It exists to hold loose feature ideas, known
bugs, and refactor notes until they're ready to become a real spec.

[SPEC]

1. Observation Visualization (3-observation-visualization epic), planned slices after 3-1 (foundation, already
  speced) and 3-2 (numeric metric trend chart, already speced) — keep each lean, one capability per spec, per
  the epic's stated preference:
   1. Tap a chart point to open the existing Record detail view.
   2. Time range selector (Day/Week/Month/Year): shared time-range state, per-bucket aggregation for Numeric.
   3. Boolean metric chart (tick/step renderer).
   4. Enum metric chart (colored swimlane renderer).
   5. Text metric markers (sparse markers, not a real trend — annotation only).
   6. Per-metric visibility toggle, persisted per Observation (first real "customization" slice).
   7. Not yet ready to spec: cross-Observation overlay/comparison (compare a metric from one Observation against
    another's). This is the product's core "discover relationships" thesis, deliberately deferred until the
    single-Observation slices above are built and proven.
2. On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
  already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.
3. When a user is editing existing Record and cancels the action by clicking the cancel or back buttons, and he already
  adjusted some metrics, a confirmation modal window should be displayed
4. A user should be able to edit the Record's timestamp
5. implement record notes
6. on the ObservationListScreen should an observation be removed/edited via long press button like it is done on the
  ObservationDetailsScreen for the Records?

[BUG]

1. long press action on a Record tile on the Observation Details screen only works at the top of the tile, but should be
  applicable for the whole tile
2. do not use dismiss animation for modals

[REF]

1. make a reusable component for modals

[DOC]

1. Create git commit conventions. Describe labels and commit content.
