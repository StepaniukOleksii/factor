# Backlog — Features

This is an informal idea/issue capture list — not a specification. It exists to hold loose feature ideas
until they're ready to become a real spec.

1. Observation Visualization (3-observation-visualization epic), planned slices after 3-1 (foundation, already
   speced), 3-2 (numeric metric trend chart, already speced), and 3-3 (tap chart point to open Record detail,
   already speced) — keep each lean, one capability per spec, per the epic's stated preference:
    - Aggregated chart point tap should zoom instead of opening a Record: tapping a point that aggregates
      multiple Records should narrow the chart to that bucket's own time span at finer aggregation, rather than
      opening one arbitrary Record. Supersedes 3-3's "opens the earliest Record in the bucket" placeholder for
      aggregated points; depends on 3-4 (time range selector) for its range/aggregation state.
    - Two-phase chart tap: a first tap shows a vertical line mirrored across all of an Observation's charts at
      that time position; a second tap navigates to the Record detail view. Replaces 3-3's immediate-navigate-
      on-tap behavior and needs state shared across every chart on screen rather than per card; needs its own
      pass on exact tap semantics (what counts as "the second tap", how/when it resets) once picked up.
    - Boolean metric chart (tick/step renderer).
    - Enum metric chart (colored swimlane renderer).
    - Text metric markers (sparse markers, not a real trend — annotation only).
    - Per-metric visibility toggle, persisted per Observation (first real "customization" slice).
    - Not yet ready to spec: cross-Observation overlay/comparison (compare a metric from one Observation against
      another's). This is the product's core "discover relationships" thesis, deliberately deferred until the
      single-Observation slices above are built and proven.
2. On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
   already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.
3. When a user is editing existing Record and cancels the action by clicking the cancel or back buttons, and he already
   adjusted some metrics, a confirmation modal window should be displayed
4. implement record notes
5. on the ObservationListScreen should an observation be removed/edited via long press button like it is done on the
   ObservationDetailsScreen for the Records?
6. Metric units. An attribute set by user that contains unit information. Limit to three chars. Should be displayed in
   paratheses above the chart after the metric name.
