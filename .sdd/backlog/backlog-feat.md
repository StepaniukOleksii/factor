# Backlog — Features

This is an informal idea/issue capture list — not a specification. It exists to hold loose feature ideas until they're
ready to become a real spec.

1. Observation Visualization — slices beyond what [Trend Charting](../features/trend-charting.md), [Trend
   Exploration](../features/trend-exploration.md) and [Trend Time Range
   Selection](../features/trend-time-range-selection.md) already cover. Keep each lean, one capability per spec:
    - Two-phase chart tap: a first tap shows a vertical line mirrored across all of an Observation's charts at that time
      position; a second tap navigates to the Record detail view. Replaces 3-3's immediate-navigate-on-tap behavior and
      needs state shared across every chart on screen rather than per card; needs its own pass on exact tap semantics
      (what counts as "the second tap", how/when it resets) once picked up.
    - Text marker cards are the only ones inert on tap. Give a mark the tap behaviour every other card has.
    - A swimlane bucket's Record count in figures. Mark height is relative: a full lane means "the most this chart
      reaches", which is one Record on `no numeric` at 1M and several at 1Y, drawn the same both times. Two Metrics side
      by side each get their own scale, and nothing on the card says what either scale is. Height still ranks a chart's
      own buckets honestly, so what's missing is the anchor, not the ordering. The Numeric answer — the count written
      above a point, per [Trend Charting](../features/trend-charting.md) — doesn't transfer: it labels one mark per
      bucket where a swimlane has up to four, in 22px lanes at four values. Needs something belonging to the column
      rather than the mark, or an admission that relative height already says enough.
    - Per-metric visibility toggle, persisted per Observation (first real "customization" slice).
    - Not yet ready to spec: cross-Observation overlay/comparison (compare a metric from one Observation against
      another's). This is the product's core "discover relationships" thesis, deliberately deferred until the
      single-Observation slices above are built and proven.
2. On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
   already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.
3. Metric units. An attribute set by user that contains unit information. Limit to three chars. Should be displayed in
   paratheses above the chart after the metric name.
4. Metric editing on an existing Observation — add, remove, rename, or change bounds and Choice values. Deliberately not
   part of Observation Editing, which covers name and description alone. [Observation
   Creation](../features/observation-creation.md) frames metric declaration as one-time and complete ("every Metric it
   will ever ask for"), and stored Records are validated against the current constraint, so a narrowed bound or a
   dropped Choice value strands Records the Observation would now refuse, and removing a Metric deletes its stored
   values outright. What happens to those Records is the question to answer before this becomes a spec. Two decisions
   taken by Observation Editing are worth reopening here rather than inheriting: whether the edit screen should merge
   with the create form once both carry Metric editors (it was kept separate precisely because edit had no Metric half),
   and whether [ADR-6](../adr/6-observation-update-write-path.md)'s deliberately narrow `update` should widen or gain a
   path beside it.
