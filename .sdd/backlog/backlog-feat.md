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
    - Enum metric chart (swimlane renderer) — explored in
      [enum-metric-chart-exploration.html](enum-metric-chart-exploration.html): one lane per allowed value,
      last-declared on top, each bucket's mark sized by that value's share so the chart survives both bucket
      regimes (one Record per bucket at 1D, a dozen mixed ones at 1Y — anything reducing a bucket to a single
      winning value lies in the second). Color is an ordinal one-hue ramp on the existing green rather than a
      categorical palette, since lane position already carries identity; validated at 3 and 5 steps, fails at
      7. Lane geometry caps at the same ~5 values for a 108px card. Open: a bucket's Record count has nowhere
      to go in a swimlane, so 12 unanimous Records look like 1. Open: the exploration's 34px lane-label gutter
      holds about six narrow characters at 10px type, but
      [Enum Metric Input](../epics/2-record-management/2-11-enum-metric-input/spec.md) lets a value run to 12 —
      `outstanding` measures 53px there and twelve wide characters 114px, so this slice picks between a wider
      gutter, labels above the lanes, and tightening that limit.
    - Boolean metric chart — folds into the Enum renderer above rather than needing a tick/step one of its own:
      `done` is a two-value enum in all but name, and two lanes serve it.
    - Both of the above need `MetricSeriesPoint` widened first — `y: number` cannot carry per-value shares, and
      this is the first renderer that doesn't fit the shape the visualization foundation shipped. Charting
      `no numeric` also falsifies that fixture's seeded description, so it and `testing-data.md` change with it.
    - Text metric markers (sparse markers, not a real trend — annotation only).
    - Per-metric visibility toggle, persisted per Observation (first real "customization" slice).
    - Not yet ready to spec: cross-Observation overlay/comparison (compare a metric from one Observation against
      another's). This is the product's core "discover relationships" thesis, deliberately deferred until the
      single-Observation slices above are built and proven.
2. On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
   already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.
3. Metric units. An attribute set by user that contains unit information. Limit to three chars. Should be displayed in
   paratheses above the chart after the metric name.
