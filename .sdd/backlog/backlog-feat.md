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
3. The Metric edits still left out: narrowing a Numeric bound, and removing or renaming a Choice value. Removing a whole
   Metric now works ([Observation Editing](../features/observation-editing.md)) and destroys every value stored against
   it ([ADR-6](../adr/6-observation-update-write-path.md)). These three keep the Metric, so that answer does not fit:
   each leaves behind a stored value the Metric no longer allows. Renaming a Choice value is the easy one to forget — a
   Record stores the value's text, not its position, so `Low` → `Lo` strands it just as deleting it would, while
   renaming a Metric costs nothing. Before deciding, check what a stranded value already does on the Record form and in
   the charts: Numeric and Choice differ there today, and neither behaviour was designed.
4. Events, beyond the model and the screens that first reach it. Each of these needs Events to exist before it can be
   specified.
    - Spans. An Event carries a single moment, because at the time of noting one the end usually hasn't happened yet. A
      Vacation or an Illness is a stretch though, and reads better as a band than as a rule at its start. Storage-wise
      the upgrade is a nullable end column and invalidates nothing already stored; the cost is that the chart overlay
      learns a second shape.
    - Tags, one per Event or several. A tag groups Events so the name doesn't have to, which stops a typo or a synonym
      splitting a group. Several are more expressive — `Vacation` and `Abroad` ask different things — but a colour has
      to pick one of them, and converting related Events has to decide which tag makes them related. Decide against a
      real form rather than in the abstract.
    - Colour. Every marker is drawn alike today. Whether Events should be told apart visually at all is open, and hangs
      on tags: a per-Event colour is decoration, a per-tag one carries information.
    - What was going on around this Record. A Record says what was entered and nothing about the circumstances. The
      Events falling near its timestamp are that context, and the Record view is where it is missed.
    - Tapping a marker narrows onto the Event. [Trend Exploration](../features/trend-exploration.md) already has a zoom
      ladder that back retraces; a marker would be another way onto it, producing the Event's own stretch of time rather
      than a bucket's.
    - During versus outside. The first thing here that would state something rather than draw it: a Metric's values
      while a tag was in effect, against its values the rest of the time. Needs tags, and enough Events under one tag
      for the comparison to mean anything.
    - Converting related Events into an Observation. An Event noted often enough under one tag is something the user
      turns out to be tracking, and tracking is what an Observation is for. What the Metrics would be, and what becomes
      of the Events afterwards, is wide open.
5. Groups as configurable views. [domain-overview.md](../project/domain-overview.md) models a Group as a collection of
   Observations for analysis, and nothing creates or shows one. The idea is still vague — closer to a saved, temporary
   view over a subset of Observations than a permanent structure. Worth leaving alone until cross-Observation comparison
   exists for a Group to scope.
6. Events, the slices that follow the model. Roughly this order, each small enough to spec on its own:
    - Listing. Where Events live in the navigation stack is undecided, and this is the slice that has to settle it.
    - Creation. The form and the use case, which is where the name and description limits the model declares first get
      enforced.
    - Deletion. Before editing, so a mistyped Event can be removed before it is drawn across every chart.
    - The chart overlay. Markers over an Observation's trend cards, sharing the window the section already has, with a
      single on/off for the lot. The payoff the rest of these exist to reach.
    - Editing.
