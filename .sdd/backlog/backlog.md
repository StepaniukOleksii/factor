# Backlog

This is an informal idea/issue capture list — not a specification. It exists to hold loose feature ideas, known
bugs, and refactor notes until they're ready to become a real spec.

[SPEC]

1. Observation Visualization (3-observation-visualization epic), planned slices after 3-1 (foundation, already
  speced), 3-2 (numeric metric trend chart, already speced), and 3-3 (tap chart point to open Record detail,
  already speced) — keep each lean, one capability per spec, per the epic's stated preference:
   1. Time range selector (Day/Week/Month/Year): shared time-range state, per-bucket aggregation for Numeric.
   2. Aggregated chart point tap should zoom instead of opening a Record: tapping a point that aggregates
    multiple Records should narrow the chart to that bucket's own time span at finer aggregation, rather than
    opening one arbitrary Record. Supersedes 3-3's "opens the earliest Record in the bucket" placeholder for
    aggregated points; depends on the time range selector above for its range/aggregation state.
   3. Axis scale on trend charts (time on the x axis, value breakdown on the y axis): reverses 3-2's deliberate
    no-axis minimalism call, so treat it as a conscious design decision, not a drive-by addition. Needs Skia
    text rendering (unused anywhere in the app so far) and is best sequenced with/after the time range
    selector, since label granularity depends on the selected range.
   4. Two-phase chart tap: a first tap shows a vertical line mirrored across all of an Observation's charts at
    that time position; a second tap navigates to the Record detail view. Replaces 3-3's immediate-navigate-
    on-tap behavior and needs state shared across every chart on screen rather than per card; needs its own
    pass on exact tap semantics (what counts as "the second tap", how/when it resets) once picked up.
   5. Boolean metric chart (tick/step renderer).
   6. Enum metric chart (colored swimlane renderer).
   7. Text metric markers (sparse markers, not a real trend — annotation only).
   8. Per-metric visibility toggle, persisted per Observation (first real "customization" slice).
   9. Not yet ready to spec: cross-Observation overlay/comparison (compare a metric from one Observation against
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
