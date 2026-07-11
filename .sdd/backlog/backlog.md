# Backlog

This is an informal idea/issue capture list — not a specification. It exists to hold loose feature ideas, known
bugs, and refactor notes until they're ready to become a real spec.

[SPEC]

- Observation Visualization (3-observation-visualization epic), planned slices after 3-1 (foundation, already
  speced) — keep each lean, one capability per spec, per the epic's stated preference:
  - Numeric metric trend chart: one metric, smooth line, fixed/simple time window, on Observation Details.
  - Tap a chart point to open the existing Record detail view.
  - Time range selector (Day/Week/Month/Year): shared time-range state, per-bucket aggregation for Numeric.
  - Boolean metric chart (tick/step renderer).
  - Enum metric chart (colored swimlane renderer).
  - Text metric markers (sparse markers, not a real trend — annotation only).
  - Per-metric visibility toggle, persisted per Observation (first real "customization" slice).
  - Not yet ready to spec: cross-Observation overlay/comparison (compare a metric from one Observation against
    another's). This is the product's core "discover relationships" thesis, deliberately deferred until the
    single-Observation slices above are built and proven.
- On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
  already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.
- When a user is editing existing Record and cancels the action by clicking the cancel or back buttons, and he already
  adjusted some metrics, a confirmation modal window should be displayed
- A user should be able to edit the Record's timestamp
- implement record notes
- on the ObservationListScreen should an observation be removed/edited via long press button like it is done on the
  ObservationDetailsScreen for the Records?

[BUG]

- long press action on a Record tile on the Observation Details screen only works at the top of the tile, but should be
  applicable for the whole tile
- do not use dismiss animation for modals

[REF]

- make a reusable component for modals
