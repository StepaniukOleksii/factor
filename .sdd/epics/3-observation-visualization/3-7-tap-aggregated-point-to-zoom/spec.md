# Feature Spec: Tap an Aggregated Chart Point to Zoom

* Date: 2026-07-23

## 1. Goal

Let a user who taps a chart point representing several Records drill into that point instead of being sent to
one arbitrarily chosen Record. [Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md)
already flagged its own "opens the earliest Record in the bucket" rule as a placeholder for this; that
placeholder is superseded here. Tapping an aggregated point now narrows the Trends section's shared window to
that point's own bucket span and redraws every Numeric chart at a finer aggregation appropriate to that
narrower span, so the Records folded together become visible as their own points. A tap on a point that
already represents exactly one Record is unchanged.

The backlog listed this as depending on [Time Range Selector](../3-4-time-range-selector/spec.md) for its
range/aggregation state; that feature and [Custom Time Range Input](../3-5-custom-time-range-input/spec.md)
have both since shipped. This slice builds on them unchanged: zooming simply makes the tapped bucket's span
the Trends section's active Custom selection, exactly as if entered by hand through the Custom Time Range
modal — and, for now, never narrows past a single day (see the Requirements below).

## 2. Requirements

* [ ] **Aggregated Points Zoom to the Days Their Own Records Fall On:** Tapping a chart point that aggregates
  more than one Record narrows the Trends section's shared time window to the whole calendar days those
  Records occupy — from the start of the earliest one's day to the end of the latest one's. Not the bucket
  that happened to hold them: a bucket is a fixed grid laid over the window, so its edges rarely fall on a
  Record. A 30-day bucket holding a week of Records would zoom to a window three-quarters empty, and the last
  bucket of a window that reaches up to now runs on into the future, leaving the curve crammed against the
  left edge of a mostly blank chart. Zooming to the Records themselves gives a window the data fills. Two
  Records an evening and the following morning apart therefore give a two-day window, since a bucket is
  anchored at the window's end rather than at midnight and so can straddle one.
* [ ] **Zoom Stops Once a Day Is Displayed:** A tap zooms only when the window it would produce is narrower
  than the one on screen; otherwise it does nothing — no zoom, no navigation. Since a window is always whole
  calendar days, a day is the narrowest one reachable, and that is where zoom comes to rest: a one-day window
  is aggregated into hour-wide buckets, and every Record inside one of those shares a day, so aligning them
  again just asks for the same window back. No separate floor states this — the rule that a zoom must
  actually narrow the window is what enforces it, which also keeps the hour that `getAggregationForCustomRange`
  floors its buckets at from being restated here and drifting out of step. A point that still hides several
  Records at that resolution simply stays a single aggregated point; resolving it further is out of scope for
  now.
* [ ] **Zoom Is a Ladder, Not a Single Step:** Each tap narrows onto its own Records, so a window wide enough
  to have several days between them can be zoomed again, and again, until it reaches a day. From `1Y` a chart
  typically descends in two steps — a month of Records, then one of its days.
* [ ] **Single-Record Points Still Navigate:** Tapping a chart point that represents exactly one Record is
  unchanged — it still opens that Record's detail view, exactly as
  [Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md) already behaves.
* [ ] **Zoom Reuses the Custom Range Mechanism:** The narrowed window becomes the Trends section's active
  Custom selection — the same selection kind [Custom Time Range Input](../3-5-custom-time-range-input/spec.md)
  introduced for a user-entered range — so the TimeRangeSelector row behaves exactly as it does after any
  other custom range: its Custom segment is selected and shows the new window, the four presets show as
  unselected, tapping a preset returns to that preset's window, and tapping Custom re-opens the modal
  pre-filled from the zoomed range.
* [ ] **Applies to Every Numeric Chart, Not Just the Tapped One:** Since the Trends section's window is
  already shared across every Numeric chart on the screen, zooming from a tap on one metric's chart re-scopes
  every other Numeric chart in the section to the same narrower window too.
* [ ] **Day-Aligned, Exactly Like a Hand-Entered Range:** The zoomed window is aligned to calendar-day
  (midnight) boundaries, the same grid a range entered through the Custom Time Range modal lands on. Every
  window the user can reach is then a whole number of days, so a zoom is indistinguishable from a range they
  could have typed — and re-applying it through the modal reproduces it exactly, where a window ending at
  some Record's own instant would be silently rounded the moment the modal touched it. The alignment grows
  the window outwards at both ends, never inwards, so both of the tapped point's outermost Records stay
  inside it.
* [ ] **Zoom Ignored While Trends Are Loading:** A tap on a chart point — whether it would zoom or navigate —
  has no effect while a previous window switch's Record fetch is still in flight, the same `loadingTrends`
  state that already disables the TimeRangeSelector's own segments. This prevents a rapid double-tap from
  starting a second, overlapping reload.
* [ ] **Only the Numeric Chart Is Affected:** Numeric is still the only implemented chart type, so this
  feature only changes tap handling on `NumericTrendChart`. Boolean, Enum, and Text Metrics still render no
  chart at all, so there is nothing yet for this feature to change for them.
* [ ] **No Visual Change Beyond the Window:** A chart's curve, gradient fill, point markers, and axes (from
  [Trend Chart Axes](../3-6-trend-chart-axes/spec.md)) are otherwise unaffected — including no new marker
  style to tell a zoomable point from a navigable one before it's tapped. Axes already recompute from
  whatever window and points a chart is given, so a zoomed chart's axes update the same way they would after
  any other window change.
  * **Superseded by [Aggregated Point Record Count](../3-8-aggregated-point-record-count/spec.md).** The "no
    new marker style" half of this was always going to be revisited once it mattered whether a user could
    tell how large an aggregation was; an aggregated point's dot is still exactly this dot, but now carries a
    small muted number above it showing its count. Everything else this requirement covers — the curve,
    gradient fill, and axes staying unaffected by a zoom itself — still holds.

## 3. Technical Design

### 3.1 Data Models

No new domain entities. `MetricSeriesPoint` (in `GetMetricSeriesUseCase.ts`) gains three fields, all already
known wherever a bucket is reduced to a point but none currently exposed: `recordCount`, the number of Records
folded into the point — a point is aggregated exactly when this is greater than one — and `firstRecordAt` /
`lastRecordAt`, the timestamps of the earliest and latest of those Records, which are the zoomed window's two
ends. They are not derivable from `x`, which is the bucket's start rather than any Record's own time.
`recordId` is unchanged: still the bucket's earliest Record, still needed for the single-Record navigate path.

### 3.2 Application Layer

None beyond the `MetricSeriesPoint` field above. `GetRecordsByTimeRangeUseCase`, `GetMetricSeriesUseCase`, and
the Time Range Selector/Custom Time Range Input helpers (`getTimeRangeForSelection`, `getAggregationForSelection`,
`getAggregationForCustomRange`) are all reused unchanged to resolve and load the zoomed window once it becomes
the active Custom selection.

### 3.3 Storage Layer

None.

### 3.4 Chart Rendering

`NumericTrendChart`'s `onPointPress` callback widens from taking just the tapped point's `recordId` to taking
the whole tapped `MetricSeriesPoint`. The renderer's existing hit-testing (nearest point by horizontal
position, then a vertical-tolerance check) is unchanged — it only reports which point was hit; deciding what
that means is the screen's job, not the chart's.

### 3.5 User Interface — Observation Details Screen

`ObservationDetailsScreen` replaces its current wiring, which passes its Record-navigation handler straight
through as `onPointPress`, with a new handler branching on the tapped point:

* Single Record (`recordCount` of one): opens that Record's detail view, exactly as before.
* Aggregated (`recordCount` greater than one), the calendar days from `firstRecordAt` to `lastRecordAt` being
  narrower than the window on screen: sets those days as the Trends section's active Custom selection.
* Aggregated, those days no narrower than the window on screen: no effect.
* Any case, while `loadingTrends` is true: no effect.

The tapped point carries everything this needs, so the handler reads nothing from the section's aggregation
and the bucket width is not consulted. The width it compares against is `chartRange`, the window the charts
were actually drawn over, rather than one recomputed from the selection — for a preset that would resolve
against a fresh `now` and drift from what the user is looking at.

Day alignment is `chartDefaults.ts`'s to own, as `getDayAlignedRange`, built on the `floorToDay` and
`startOfNextDay` helpers `CustomTimeRangeModal` had defined privately and now imports from there instead —
the two features need the same calendar-day grid, and only one of them should define it.

No new fetch or render logic is needed: the existing effect already keyed on the active selection picks up the
change automatically, exactly as it does for a manually applied custom range. `CustomTimeRangeModal` keeps its
behavior exactly; only where its day helpers live changes. No change to `TimeRangeSelector`.

No mockup accompanies this feature — no new screen or component is introduced; only what a tap on an existing
point does changes.

## 4. Verification Plan

### Manual Verification

Run "Reseed test data" first (see [testing-data.md](../../../../testing-data.md)), and use the same
`mixed metrics` Observation earlier Trends specs cover. `dense` (one Record per day for 45 days) is what this
checklist relies on: at `1Y`'s 30-day buckets, its daily Records aggregate heavily into each of its three
points.

1. Open `mixed metrics` and switch to "1Y". Confirm `dense` renders three points, each an average of roughly a
   month of daily Records.
2. Tap the middle of `dense`'s three points. Confirm: no Record opens; the TimeRangeSelector's Custom segment
   becomes selected and displays a range covering the days from that point's earliest Record to its latest;
   `dense`'s chart redraws within that narrower window with visibly more points than the single tapped one,
   its daily Records now spread across the curve instead of averaged together, and reaching both edges of the
   chart rather than trailing off into empty space; the other Numeric metrics in the section (`sparse`,
   `hourly`, `yearly`, `insufficient`) re-scope to that same narrower window as well.
   Then tap `dense`'s **rightmost** point instead, the one whose bucket runs past now into the future. Confirm
   the window it zooms to ends around today rather than weeks ahead, since the bucket's last Record — not its
   far edge — is what bounds it.
3. From that zoomed-in view, tap one of `dense`'s now-finer points. Confirm this opens that Record's detail
   view — at this resolution each point represents a single day's Record, so the tap navigates exactly as
   [Tap Chart Point to Open Record Detail](../3-3-tap-to-record-detail/spec.md) already verifies.
4. Return to `mixed metrics` and switch to "1M", then scroll to `hourly`, whose Records bunch several to a day
   at the recent end of the window. Tap its rightmost point. Confirm the window narrows to the one or two days
   those Records fall on, and that tapping an aggregated point again there does nothing — a day is where zoom
   comes to rest. Tap several of `dense`'s 30 points too (one per day, never aggregated at this window) and
   confirm each still opens its own Record directly, unaffected by this feature.
5. From the zoomed-in state reached in step 2 (or by repeating it), tap the Custom segment. Confirm the modal
   opens pre-filled from the zoomed range, exactly as it would for any other applied custom range.
6. Tap two different aggregated `1Y` points in quick succession, before the first tap's data finishes loading.
   Confirm the second tap has no effect — the chart settles on the first tap's zoomed window, not a mix of
   both or an error.
7. Open `no numeric` (no Numeric Metrics). Confirm neither the Trends section nor the selector appears,
   unchanged from existing behavior.

Step 4 is where zoom coming to rest shows itself. Where the seeded data allows a second step it takes one;
where it is already down to a day, a further tap is either a navigation (a point standing for one Record) or
nothing at all (a point still hiding several). The full ladder — a year, down to a month of Records, down to
one of its days, then stopping — is pinned by the Automated Tests below, which can arrange Records the seed
set does not happen to contain.

### Automated Tests

* Unit tests for `GetMetricSeriesUseCase`: every returned `MetricSeriesPoint` carries a `recordCount` equal to
  the number of Records folded into its bucket — one for a bucket fed by a single Record, more than one for a
  bucket fed by several — along with `firstRecordAt` and `lastRecordAt` holding the earliest and latest of
  those Records' timestamps, both equal to the one Record's own timestamp where a bucket holds only one, and
  neither tied to the bucket's own edges.
* Unit tests for `NumericTrendChart`: a press that resolves to a given point calls `onPointPress` with that
  full point rather than a bare `recordId`; the existing suite of resolution cases (nearest point, vertical
  tolerance, first/last point, a miss) continues to pass, now asserting against the point returned.
* `ObservationDetailsScreen` tests, which pin the clock rather than working in "days ago" — whether two
  Records share a calendar day, and which bucket they land in given buckets are anchored at the window's end,
  would otherwise depend on the hour the suite ran at: tapping a chart point whose `recordCount` is one calls
  the existing Record-navigation path with that point's `recordId` and leaves the active time-range selection
  unchanged; tapping an aggregated point instead sets the selection to a Custom range covering the whole days
  its Records fall on — narrower than the bucket that held them, ending at the last Record's day rather than
  at the bucket's edge, one day where those Records share one and two where they straddle a midnight —
  triggers no navigation, and re-fetches/re-renders every Numeric chart in the section; re-applying a zoomed
  range through the Custom modal reproduces it unchanged; tapping on zooms again, and once the window is a
  single day a further tap on an aggregated point leaves the selection, navigation, and loaded data completely
  unchanged, as does any tap at `1D`, whose window is already one day; a tap of any kind while `loadingTrends`
  is true has no effect.
