# Backlog — Features

This is an informal idea/issue capture list — not a specification. It exists to hold loose feature ideas
until they're ready to become a real spec.

1. Observation Visualization — slices beyond what [Trend Charting](../features/trend-charting.md),
   [Trend Exploration](../features/trend-exploration.md) and
   [Trend Time Range Selection](../features/trend-time-range-selection.md) already cover. Keep each lean, one
   capability per spec:
    - Two-phase chart tap: a first tap shows a vertical line mirrored across all of an Observation's charts at
      that time position; a second tap navigates to the Record detail view. Replaces 3-3's immediate-navigate-
      on-tap behavior and needs state shared across every chart on screen rather than per card; needs its own
      pass on exact tap semantics (what counts as "the second tap", how/when it resets) once picked up.
    - Tap an Enum swimlane. The renderer ships inert — it reports no point and a tap does nothing, while every
      Numeric chart beside it navigates or zooms, which is where
      [Trend Exploration](../features/trend-exploration.md) currently draws the line. The screen's
      `handleChartPointPress` is already renderer-agnostic and reads only base fields of the point, so wiring
      it up is mostly hit-testing — reusing the tolerance
      [ADR-5](../adr/5-chart-tap-hit-testing-tolerance.md) settles rather than inventing a second one — but
      what a tap *means* on a swimlane needs its own pass first. A bucket
      column is the obvious target (nearest by x, ignoring y, since every mark in a
      column belongs to one bucket), which would make zoom the way to resolve a mixed bucket into its Records;
      whether a tap on one *lane* should mean something narrower is the open question.
    - A swimlane bucket's Record count in figures. Mark height is relative: a full lane means "the most this
      chart reaches", which is one Record on `no numeric` at 1M and several at 1Y, drawn the same both times.
      Two Metrics side by side each get their own scale, and nothing on the card says what either scale is.
      Height still ranks a chart's own buckets honestly, so what's missing is the anchor, not the ordering.
      The Numeric answer — the count written above a point, per
      [Trend Charting](../features/trend-charting.md) — doesn't transfer: it labels one mark per bucket where a
      swimlane has up to four, in 22px lanes at four values. Needs something belonging to the column rather
      than the mark, or an admission that relative height already says enough.
    - Text metric markers (sparse markers, not a real trend — annotation only).
    - Per-metric visibility toggle, persisted per Observation (first real "customization" slice).
    - Not yet ready to spec: cross-Observation overlay/comparison (compare a metric from one Observation against
      another's). This is the product's core "discover relationships" thesis, deliberately deferred until the
      single-Observation slices above are built and proven.
2. On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
   already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.
3. Metric units. An attribute set by user that contains unit information. Limit to three chars. Should be displayed in
   paratheses above the chart after the metric name.
4. Observation Editing — **Edit** beside **Delete** in the Observation's ⋮ menu
   ([Observation Viewing](../features/observation-viewing.md)), pairing both actions on one object the way the Record
   actions dialog already does, and reopening the Observation form pre-filled the way
   [Record Editing](../features/record-editing.md) reopens the Record form. Name and description only — metrics stay
   out, see the metric-editing entry below — so what the form does with the Metric cards Creation currently requires
   (read-only, or absent) is the first thing to settle. The rename rule is already provided for:
   `validateCreateObservation` takes the names a submission must not collide with, and
   [ADR-4](../adr/4-name-uniqueness-rule-placement.md) planned rename as the caller passing every name but the
   subject's own. What is missing is a write path — `ObservationRepository` has only an INSERT-only `save`.
5. Observation metadata on the Details screen — created date and record count on one small glanceable line.
   `createdAt` is already stored and already orders the Observation list, so nothing needs migrating or backfilling;
   it is simply dropped on the way out of `findAll`, and `Observation` has no field to carry it. The record count is
   new work — `RecordRepository` fetches recent Records and Records in a range, but cannot count them.
6. Metric editing on an existing Observation — add, remove, rename, or change bounds and Choice values. Deliberately
   not part of Observation Editing above. [Observation Creation](../features/observation-creation.md) frames metric
   declaration as one-time and complete ("every Metric it will ever ask for"), and stored Records are validated
   against the current constraint, so a narrowed bound or a dropped Choice value strands Records the Observation would
   now refuse, and removing a Metric deletes its stored values outright. What happens to those Records is the question
   to answer before this becomes a spec.
