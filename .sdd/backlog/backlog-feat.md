# Backlog — Features

This is an informal idea/issue capture list — not a specification. It exists to hold loose feature ideas
until they're ready to become a real spec.

1. Observation Visualization (3-observation-visualization epic), planned slices after 3-1 (foundation, already
   speced), 3-2 (numeric metric trend chart, already speced), and 3-3 (tap chart point to open Record detail,
   already speced) — keep each lean, one capability per spec, per the epic's stated preference:
    - Two-phase chart tap: a first tap shows a vertical line mirrored across all of an Observation's charts at
      that time position; a second tap navigates to the Record detail view. Replaces 3-3's immediate-navigate-
      on-tap behavior and needs state shared across every chart on screen rather than per card; needs its own
      pass on exact tap semantics (what counts as "the second tap", how/when it resets) once picked up.
    - Tap an Enum swimlane. [Enum Metric Chart](../epics/3-observation-visualization/3-11-enum-metric-chart/spec.md)
      ships the renderer inert: it reports no point and a tap does nothing, while every Numeric chart beside it
      navigates or zooms. The screen's `handleChartPointPress` is already renderer-agnostic and reads only base
      fields of the point, so wiring it up is mostly hit-testing — but what a tap *means* on a swimlane needs its
      own pass first. A bucket column is the obvious target (nearest by x, ignoring y, since every mark in a
      column belongs to one bucket), which would make zoom the way to resolve a mixed bucket into its Records;
      whether a tap on one *lane* should mean something narrower is the open question.
    - A swimlane bucket's Record count. The Enum chart draws nothing for it, so twelve unanimous Records look
      like one — the state [Aggregated Point Record Count](../epics/3-observation-visualization/3-8-aggregated-point-record-count/spec.md)
      exists to prevent on the Numeric chart. Its answer doesn't transfer: it labels one mark per bucket where
      a swimlane has up to four, in 22px lanes at four values. Needs something belonging to the column rather
      than the mark, or an admission that share already says enough.
    - Boolean metric chart — folds into the Enum swimlane renderer rather than needing a tick/step one of its
      own: `done` is a two-value enum in all but name, and two lanes serve it. The 2-lane ramp and the
      `CategorySeriesPoint` shape are already there; what it needs is the `Boolean` branch of
      `GetMetricSeriesUseCase.reduce`, a registry entry, and decisions on lane wording (`Yes`/`No` from
      `BOOLEAN_METRIC_OPTIONS`?) and which of the two sits on top. `mixed metrics`' `flag` and `no numeric`'s
      `done` both start charting, so `testing-data.md` changes with it.
    - Text metric markers (sparse markers, not a real trend — annotation only).
    - Per-metric visibility toggle, persisted per Observation (first real "customization" slice).
    - Not yet ready to spec: cross-Observation overlay/comparison (compare a metric from one Observation against
      another's). This is the product's core "discover relationships" thesis, deliberately deferred until the
      single-Observation slices above are built and proven.
2. On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
   already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.
3. Metric units. An attribute set by user that contains unit information. Limit to three chars. Should be displayed in
   paratheses above the chart after the metric name.
