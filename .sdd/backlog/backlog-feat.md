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
      it up is mostly hit-testing — but what a tap *means* on a swimlane needs its own pass first. A bucket
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
