# Feature Spec: Custom Time Range Input

* Date: 2026-07-18

## 1. Goal

Let users chart an arbitrary Start/End window, rather than being limited to the four fixed presets
[Time Range Selector](../3-4-time-range-selector/spec.md) shipped. A fifth "Custom" control sits at the
end of the same preset row and opens a modal where the user picks a Start and End, each to the nearest
calendar day — a day is the smallest selectable window; applying it re-scopes every Numeric chart in the
Trends section to that window, exactly as selecting a preset does today, and the control itself then
displays the applied range instead of the word "Custom". Per the backlog's framing of this slice, this
feature only adds the input mechanism —
bucket size for the chosen window is computed automatically from its span, following the same
"keep every chart readable regardless of the window" intent the four presets already establish, rather
than exposing aggregation as a separate choice.

## 2. Requirements

* [ ] **Custom Control in the Selector Row:** The existing preset row gains a fifth segment, "Custom",
  rendered after "1Y" in the same row, same visual language as the four preset segments, but wider
  (roughly double their width) to accommodate a date range as its label.
* [ ] **Opening the Modal:** Tapping the Custom segment — whether it currently reads "Custom" or is
  showing a previously applied range — opens the Custom Time Range modal. Like the four presets, it is
  disabled (non-interactive) while a preset/custom switch's fetch is in flight.
* [ ] **Modal Pre-fill:** The modal opens with Start and End pre-filled from whatever selection is
  currently active — the concrete Start/End the active preset resolves to, or the exact Start/End of the
  currently applied custom range.
* [ ] **Day-Only Precision:** Start and End are each set to a specific calendar date; the modal offers no
  way to specify an hour, minute, or second for either endpoint — a single date picker per endpoint, no
  time-of-day control at all.
* [ ] **Day Is the Minimum Range:** Start and End may be the same calendar day — that is a valid selection
  and yields the smallest possible custom window, one full day. There is no way to select a narrower
  range.
* [ ] **End Cannot Be in the Future:** End's latest selectable date is today. Start has no lower bound.
* [ ] **Start Must Not Be After End:** The modal's Apply action is disabled, and an inline message is
  shown, whenever End is earlier than Start. Start and End being the same day is valid (see Day Is the
  Minimum Range above), so this only blocks End being strictly *before* Start.
* [ ] **Applying Updates the Charts:** Pressing Apply closes the modal, makes Custom the active selection
  (deselecting whichever preset — or previous custom range — was active), and re-fetches/re-renders every
  Numeric chart in the Trends section for the chosen window, through the same
  `GetRecordsByTimeRangeUseCase` fetch and `loadingTrends`-disables-the-row mechanics a preset switch
  already uses.
* [ ] **Canceling Discards Edits:** Dismissing the modal (Cancel button or backdrop/back gesture) closes
  it without changing the active selection and without triggering a reload.
* [ ] **Custom Aggregation:** The bucket size for a custom range is computed from its span — targeting
  roughly 30 buckets, with a 1-hour minimum bucket size, rounded up to a whole hour — rather than exposed
  as a separate control to the user. This is independent of the day-level precision Start/End are entered
  at: a short custom range (e.g. two or three days) still aggregates into sub-day buckets for a readable
  chart, exactly as the presets already do.
* [ ] **Control Displays the Applied Range:** While Custom is the active selection, its segment shows the
  applied Start/End on one line (e.g. "Jul 15 – Jul 18") instead of the word "Custom" — no time-of-day is
  shown, matching Day-Only Precision above. As soon as selection moves elsewhere (a preset is tapped), the
  segment reverts to reading "Custom" — it does not keep displaying a stale previously-applied range once
  deselected.
* [ ] **Only One Selection Active:** Exactly one segment is visually selected at a time across all five —
  the four presets and Custom are mutually exclusive, matching the existing preset behavior.
* [ ] **Insufficient-Data State Still Applies:** A Metric with fewer than two aggregated points in the
  custom window shows the existing "Not enough data yet" placeholder, independently per Metric — unchanged
  from preset behavior.
* [ ] **Other Sections Unaffected:** RECENT RECORDS keeps using its own independent data, unaffected by
  Custom selection.
* [ ] **No Numeric Metrics:** Consistent with existing behavior, an Observation with no Numeric Metrics
  renders neither the Trends section nor the selector row (so no Custom control either).
* [ ] **Selection Lasts as Long as the Exploration:** The chosen window belongs to one continuous
  exploration of one Observation, not to the Details screen (which unmounts on the way to a Record) and
  not to the session. Screens reached *from* an Observation — Record creation and editing today, an
  Observation Config or Info screen later — are part of that exploration, so returning from them
  restores the window that was active, an applied custom range and a preset alike. Leaving the
  Observation entirely — back to the Observation list, after a deletion, or via any future Home
  affordance — ends the exploration: coming back in, even to the *same* Observation, starts at the "1M"
  default. Nothing is persisted across app restarts.
* [ ] **No Manual Aggregation Control:** Exposing bucket size as its own user-facing choice is explicitly
  out of scope for this slice (see Goal).

## 3. Technical Design

### 3.1 Data Models

No new domain entities. `TimeRange` (from `GetMetricSeriesUseCase.ts`) is reused unchanged to represent a
custom Start/End pair — the same type the four presets already resolve to.

`src/presentation/charts/chartDefaults.ts` gains a selection type that generalizes "which window is
active" beyond a bare preset, plus the custom-range aggregation rule:

```ts
export type TimeRangeSelection =
  | {kind: 'preset'; preset: TimeRangePreset}
  | {kind: 'custom'; range: TimeRange};

export const DEFAULT_TIME_RANGE_SELECTION: TimeRangeSelection = {
  kind: 'preset',
  preset: DEFAULT_TIME_RANGE_PRESET,
};

const CUSTOM_RANGE_TARGET_BUCKETS = 30;

/**
 * Bucket size for an arbitrary custom range: targets ~30 buckets across the
 * range's span, floored at 1 hour and always a whole number of hours, so a
 * short custom range doesn't collapse to too few buckets and a long one
 * doesn't explode into thousands of them. Independent of the day-level
 * precision Start/End are selected at (3.5) — bucket size and input
 * granularity are separate concerns, same as they are for the four presets.
 */
export function getAggregationForCustomRange(range: TimeRange): AggregationStrategy {
  const spanMs = range.end.getTime() - range.start.getTime();
  const rawBucketMs = spanMs / CUSTOM_RANGE_TARGET_BUCKETS;
  const bucketSizeMs = Math.max(HOUR_MS, Math.ceil(rawBucketMs / HOUR_MS) * HOUR_MS);
  return {bucketSizeMs};
}

export function getTimeRangeForSelection(selection: TimeRangeSelection, now: Date = new Date()): TimeRange {
  return selection.kind === 'preset'
    ? getTimeRangeForPreset(selection.preset, now)
    : selection.range;
}

export function getAggregationForSelection(selection: TimeRangeSelection): AggregationStrategy {
  return selection.kind === 'preset'
    ? getAggregationForPreset(selection.preset)
    : getAggregationForCustomRange(selection.range);
}
```

`TimeRangePreset`, `TIME_RANGE_PRESETS`, `DEFAULT_TIME_RANGE_PRESET`, `getTimeRangeForPreset` and
`getAggregationForPreset` are all kept unchanged — `TimeRangeSelection` wraps them rather than replacing
them, since a preset is still the default and the common case.

New `src/shared/formatTimeRange.ts`, alongside the existing `formatRelativeTime.ts`:

```ts
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString([], {month: 'short', day: 'numeric'});
}

/**
 * `range.end` is the exclusive half-open boundary (3.5: the start of the day
 * *after* the last day the user selected), not a day the user actually
 * picked — so it's stepped back one millisecond before formatting. A
 * Start=Jul 15/End=Jul 18 selection is stored as
 * `{start: Jul 15 00:00, end: Jul 19 00:00}` and must display as
 * "Jul 15 – Jul 18", not "Jul 15 – Jul 19".
 */
export function formatTimeRange(range: TimeRange): string {
  const lastIncludedDay = new Date(range.end.getTime() - 1);
  return `${formatShortDate(range.start)} – ${formatShortDate(lastIncludedDay)}`;
}
```

`formatShortDate` omits the year, mirroring `formatRelativeTime`'s treatment of recent dates — fine for a
control whose whole premise is a bounded, recent-ish window. `formatShortDate` is also reused directly by
the modal's two Date fields (3.5), so the same date string never gets formatted two different ways within
this feature.

### 3.2 Application Layer

None. `GetRecordsByTimeRangeUseCase` and `GetMetricSeriesUseCase` are reused unchanged — both already
accept an arbitrary `TimeRange`/`AggregationStrategy` pair with no assumption that it came from a preset.

### 3.3 Storage Layer

None. No repository or schema changes — Records are already queried by an arbitrary time window.

### 3.4 Chart Rendering

None. `NumericTrendChart` and `rendererRegistry` are reused unchanged, as they were for presets.

### 3.5 User Interface

Visual design is provided in [`design/custom-time-range.html`](design/custom-time-range.html): the
selector row with the fifth "Custom" segment in both its unselected ("Custom") and applied-range label
states, and the `CustomTimeRangeModal` in both its valid-selection and validation-error states. Exact
spacing/sizing/copy should follow that mockup; the structure and behavior described below are normative.

**New dependency:** `@react-native-community/datetimepicker`, installed via
`npx expo install @react-native-community/datetimepicker` (the Expo-pinned version for SDK 54, per this
project's existing convention for RN-native dependencies — see `react-native-reanimated` in
[tech-stack.md](../../../project/tech-stack.md)). This is the project's first UI dependency outside Skia;
implementation should add a short entry documenting it to tech-stack.md alongside the existing Data
Visualization entry.

**`TimeRangeSelector` (`src/presentation/charts/TimeRangeSelector.tsx`) — modified.** Its public props
change to carry a selection rather than a bare preset, and it gains a fifth, wider segment:

```ts
export interface TimeRangeSelectorProps {
  selected: TimeRangeSelection;
  onSelectPreset: (preset: TimeRangePreset) => void;
  onPressCustom: () => void;
  disabled?: boolean;
}
```

* This is a breaking change to an already-shipped component: `selected: TimeRangePreset` becomes
  `selected: TimeRangeSelection`, and `onSelect` is renamed/split into `onSelectPreset` (for the four
  presets) and `onPressCustom` (for the new segment, which opens the modal rather than selecting
  anything directly). `TimeRangeSelector.test.tsx` needs updating for the new props and the added
  segment, not just extending.
* Renders the four existing preset segments unchanged (`flex: 1` each, `isSelected` when
  `selected.kind === 'preset' && selected.preset === preset`), followed by a fifth `Custom` segment with
  `flex: 2`.
* Custom segment's label: `selected.kind === 'custom' ? formatTimeRange(selected.range) : 'Custom'`,
  `numberOfLines={1}` — the date-only format is short enough to always fit on one line within the
  segment's `flex: 2` width. `textAlign: 'center'`.
* Custom segment `isSelected`: `selected.kind === 'custom'` — same selected/unselected visual treatment
  (`primaryContainer`/`surfaceContainerLow`) as the preset segments.
* `testID="time-range-custom"`; `accessibilityLabel` is `'Choose a custom time range'` when unselected,
  or `` `Custom range: ${formatTimeRange(selected.range)}. Edit.` `` when a custom range is applied.
* `onPress`, when not `disabled`, is always `onPressCustom` — never `onSelectPreset` — regardless of
  whether Custom is already the active selection, so tapping it again reopens the modal to adjust the
  current range.
* Respects `disabled` exactly as the preset segments do (non-interactive, muted, `onPress={undefined}`).

**New `CustomTimeRangeModal` (`src/presentation/charts/CustomTimeRangeModal.tsx`):**

```ts
export interface CustomTimeRangeModalProps {
  visible: boolean;
  initialRange: TimeRange;
  onApply: (range: TimeRange) => void;
  onCancel: () => void;
}
```

* Internal state: `startDay: Date`, `endDay: Date` — each a floored calendar day (local midnight), not an
  exact instant, naming them distinctly from `TimeRange.start`/`.end` to keep the "day the user picked" vs.
  "half-open query boundary" distinction explicit throughout this component.
* A local helper, `floorToDay(date: Date): Date`, zeroes hours/minutes/seconds/ms
  (`new Date(date.getFullYear(), date.getMonth(), date.getDate())`) — used both to normalize whatever a
  native picker's `onChange` reports and to convert the picked days into a query `TimeRange` on Apply.
* Reset from `initialRange` whenever `visible` transitions from `false` to `true` (a `useEffect` keyed on
  `visible`), so each open reflects whatever is currently active rather than a stale, cancelled edit from a
  previous open. `initialRange` is a half-open `TimeRange`, not a pair of days, so deriving the day pickers
  requires the same "step back before flooring" treatment as `formatTimeRange` (3.1):
  ```ts
  setStartDay(floorToDay(initialRange.start));
  setEndDay(floorToDay(new Date(initialRange.end.getTime() - 1)));
  ```
* Uses the existing `Modal` + `modalOverlay`/`modalContent`/`modalActions`/`modalCancelButton` styling
  already established in `ObservationDetailsScreen`'s delete-confirmation modals (`transparent`,
  `animationType="fade"`, `statusBarTranslucent`, `navigationBarTranslucent`), so this modal looks and
  behaves like every other modal in the app.
* Two labeled sections, "Start" and "End", each a single pressable Date field — styled like
  `CreateObservationScreen`'s existing `typeSelector`/`typeText` pattern (a labeled value that opens a
  picker on tap, rather than a `LabeledTextField`, since this isn't free-text entry) — showing
  `formatShortDate(value)` and opening `DateTimePicker` with `mode="date"` on tap. `testID`s
  `custom-range-start-date`, `custom-range-end-date`. There is no Hour field — see
  [`design/custom-time-range.html`](design/custom-time-range.html) for the exact layout.
* Every value coming back from either picker's `onChange` is passed through `floorToDay` before being
  stored, so day-only precision is guaranteed by this component regardless of what a given platform's
  native date picker itself returns.
* End's picker is given `maximumDate={floorToDay(new Date())}` so a future date cannot be selected. Start
  has no `minimumDate`/`maximumDate` — ordering between Start and End is enforced only by the Apply-time
  validation below, not by constraining either picker's selectable range against the other (constraining
  them dynamically would make the selectable range shift confusingly as the user edits).
* Validation: whenever `endDay.getTime() < startDay.getTime()`, an inline message ("End can't be before
  start") renders below the fields and the Apply button is disabled. `startDay` equal to `endDay` is valid
  (Day Is the Minimum Range) and does not trigger this message.
* On Apply, the selected days are converted into the half-open `TimeRange` the rest of the app expects —
  `end` is bumped forward one day past `endDay` so the entire End day is included, not just its midnight
  instant:
  ```ts
  const DAY_MS = 24 * 60 * 60 * 1000;
  const range: TimeRange = {
    start: floorToDay(startDay),
    end: new Date(floorToDay(endDay).getTime() + DAY_MS),
  };
  ```
* Footer: `Cancel` (`onCancel`, no state change) and `Apply` (disabled per the validation above; calls
  `onApply(range)` and does not itself close the modal — the parent closes it by flipping `visible` in the
  same state update that applies the new selection, matching how the parent already owns modal visibility
  for the screen's other modals).

**`ObservationDetailsScreen` (`src/presentation/screens/ObservationDetailsScreen.tsx`) changes:**

* `timeRangePreset: TimeRangePreset` state is replaced with a `timeRangeSelection: TimeRangeSelection`
  **prop**, paired with an `onTimeRangeSelectionChange` callback — the screen renders the window it is
  handed and reports every change rather than holding one, since it unmounts on the way to a Record
  (see Selection Survives a Record Round Trip). `customModalVisible: boolean` (`useState(false)`) stays
  local: an open modal should not survive navigation.
* `AppNavigator` owns the window as a single `TimeRangeSelection` — it is the only component that
  outlives the Details screen. Its lifetime is tied to an exploration rather than cleared at each exit
  point, which would leave every future way out of an Observation to remember to clear it:
  * `exploredObservationId(screen: ScreenState): string | null` classifies each screen as belonging to
    an Observation's exploration (`ObservationDetails`, `CreateRecord`, `EditRecord`) or outside one
    (`ObservationList`, `CreateObservation`).
  * A single `navigate(next)` funnel, which every `navigateToX` helper goes through, resets the window
    to `DEFAULT_TIME_RANGE_SELECTION` whenever `exploredObservationId` differs between the current and
    next screen — covering leaving to the list, deletion, and switching Observations in one rule.
  * The `switch` in `exploredObservationId` is exhaustive over `ScreenState` with an `assertNever`
    default, so adding a screen fails to typecheck until it is placed inside or outside an exploration.
    That is the point of the design: a later Config, Info or Home screen cannot silently inherit the
    wrong behavior by omission. (Verified by adding a screen variant and observing the compile error.)
* `loadTrendData` takes a `TimeRangeSelection` instead of a `TimeRangePreset`, and resolves it via
  `getTimeRangeForSelection`:
  ```ts
  const loadTrendData = async (selection: TimeRangeSelection) => {
    try {
      setLoadingTrends(true);
      const range = getTimeRangeForSelection(selection);
      const rangeRecords = await getRecordsByTimeRangeUseCase.execute(observationId, range);
      setChartRange(range);
      setChartRecords(rangeRecords);
    } catch (error) {
      console.error('Failed to load trend data', error);
    } finally {
      setLoadingTrends(false);
    }
  };
  ```
* The trend-fetch effect is keyed on `timeRangeSelection` instead of `timeRangePreset`; unchanged
  otherwise (still fires on initial load once `observation` is set, and on every subsequent selection
  change).
* Each Numeric chart's aggregation uses `getAggregationForSelection(timeRangeSelection)` in place of
  `getAggregationForPreset(timeRangePreset)`.
* The Trends section renders:
  ```tsx
  <TimeRangeSelector
    selected={timeRangeSelection}
    onSelectPreset={preset => onTimeRangeSelectionChange({kind: 'preset', preset})}
    onPressCustom={() => setCustomModalVisible(true)}
    disabled={loadingTrends}
  />
  <CustomTimeRangeModal
    visible={customModalVisible}
    initialRange={getTimeRangeForSelection(timeRangeSelection)}
    onCancel={() => setCustomModalVisible(false)}
    onApply={range => {
      onTimeRangeSelectionChange({kind: 'custom', range});
      setCustomModalVisible(false);
    }}
  />
  ```
  in the same place `TimeRangeSelector` renders today, inside the same conditional block guarding the
  whole section on at least one Numeric Metric existing.

## 4. Verification Plan

### Manual Verification

Run "Reseed test data" first (see [testing-data.md](../../../../testing-data.md)); reuses the same
`mixed metrics` Observation 3-4's checklist already covers.

1. Open `mixed metrics`. Confirm the selector row now shows five segments — 1D/1W/1M/1Y/Custom — with
   Custom visibly wider than the other four, and "1M" selected by default.
2. Tap "Custom". Confirm the modal opens with Start showing a date ~30 days ago and End showing today
   (today's 1M window, since that's the active selection), and that neither field offers an hour, minute,
   or time control of any kind.
3. Try to set End past today. Confirm no later date is selectable.
4. Set Start to a date after the current End. Confirm Apply is disabled and an inline message appears;
   correct Start back to on/before End and confirm Apply re-enables. Then set Start to the exact same date
   as End and confirm Apply is enabled — same-day is a valid, minimum-size range.
5. Set Start to 4 days ago and End to today, then Apply. Confirm: the modal closes; the Custom segment
   now reads the applied range on one line (e.g. "Jul 14 – Jul 18") instead of "Custom"; none of the four
   presets is shown as selected; `dense` and `sparse` chart with visibly fewer points than at "1M" (per
   [testing-data.md](../../../../testing-data.md)).
6. Tap "1W". Confirm "1W" becomes selected, the Custom segment reverts to reading "Custom" (not the range
   applied in step 5), and charts update to the 1W window.
7. Tap "Custom" again. Confirm the modal reopens pre-filled from 1W's concrete range (7 days ago to
   today), not the range from step 5.
8. Apply the same day for both Start and End (today only). Confirm Apply is enabled and this produces the
   smallest possible custom window, one day: `hourly` (several Records inside the last 21 hours per
   [testing-data.md](../../../../testing-data.md)) still charts, since its bucket size stays sub-day
   regardless of the one-day input span, while `dense`/`sparse` fall back to "Not enough data yet".
9. Confirm RECENT RECORDS is unaffected by any of the above.
10. With the custom range from step 5 still applied, tap a chart point to open its Record, then return.
    Confirm the Custom segment still reads that range and the charts are still scoped to it — not reset
    to "1M". Repeat with "1W" selected, and again via "Add Record" instead of a chart point, to confirm
    a preset and the creation path survive the same trip.
11. Still with a custom range applied, go back to the Observation list, then reopen `mixed metrics`.
    Confirm it starts at "1M": leaving the Observation ends the exploration, so the window is not
    carried into the next one even for the same Observation.
12. Open `no numeric`. Confirm neither the Trends section nor the selector (Custom included) appears.

### Automated Tests

* Unit tests for `chartDefaults.ts` additions: `getAggregationForCustomRange` returns a whole-hour bucket
  size targeting ~30 buckets across a range's span, floored at 1 hour, for a range of representative spans
  (one day — the shortest span the UI can actually produce, a few days, a year);
  `getTimeRangeForSelection`/`getAggregationForSelection` branch correctly for `'preset'` vs `'custom'`
  selections; `DEFAULT_TIME_RANGE_SELECTION` resolves to the same values as the pre-existing
  `DEFAULT_TIME_RANGE_PRESET` (regression guard).
* Unit tests for `formatTimeRange.ts`: `formatShortDate` produces the expected `"Mon D"` string;
  `formatTimeRange` produces `"<start day> – <last included day>"`, correctly stepping the half-open
  `range.end` back to the calendar day before it (e.g. `{start: Jul 15 00:00, end: Jul 19 00:00}` formats
  as `"Jul 15 – Jul 18"`, not `"Jul 15 – Jul 19"`).
* `TimeRangeSelector` tests (migrated + extended): renders five segments in order, Custom last; Custom's
  rendered style carries a larger flex value than the presets'; pressing a preset calls `onSelectPreset`
  with that preset and never `onPressCustom`; pressing Custom calls `onPressCustom` and never
  `onSelectPreset`, whether or not Custom is already selected; when `selected` is a custom selection, only
  the Custom segment is marked selected and its label equals `formatTimeRange(selected.range)`; when
  `selected` is a preset selection, only the matching preset segment is selected and Custom's label is the
  literal string `"Custom"`; `disabled` disables all five segments including Custom.
* `CustomTimeRangeModal` tests: fields are pre-filled from `initialRange` on open, correctly deriving the
  displayed Start/End calendar days from a half-open range (including the exclusive-end-minus-one-day case
  above); a value simulated as sub-day from either picker's `onChange` is stored/displayed floored to the
  calendar day; the End field's `maximumDate` is today, floored; Apply is disabled with a validation
  message visible whenever End is before Start, and enabled when End equals or is after Start (same-day is
  valid); pressing Apply calls `onApply` with a half-open `TimeRange` whose `start` is the selected Start
  day at midnight and whose `end` is the day *after* the selected End day at midnight (e.g. Start=Jul 15 /
  End=Jul 18 produces `{start: Jul 15 00:00, end: Jul 19 00:00}`); pressing Cancel calls `onCancel` and
  never `onApply`; reopening after a Cancel re-syncs fields to the (possibly different) `initialRange`
  passed on the next open, rather than retaining the discarded edit.
* `ObservationDetailsScreen` tests: applying a custom range reports `{kind: 'custom', range}` to
  `onTimeRangeSelectionChange`, calls `getRecordsByTimeRangeUseCase.execute` with that exact range, and
  aggregates via `getAggregationForCustomRange`; selecting a preset after a custom range clears the custom
  selection (preset segment selected, Custom reverts to reading "Custom"); the screen renders whichever
  `timeRangeSelection` it is handed rather than defaulting, so a restored window shows up as the active
  one; RECENT RECORDS is unaffected by opening/applying/canceling the Custom modal; an Observation with no
  Numeric Metrics renders neither the Trends section nor the selector.
* `AppNavigator` tests, with every screen stubbed to the props the navigator drives it with, covering
  both sides of the exploration boundary: a freshly opened Observation starts at
  `DEFAULT_TIME_RANGE_SELECTION`; a window chosen, then left via tap-to-Record (asserting the Details
  screen really does unmount, so the state genuinely could not have survived locally) and returned to,
  comes back intact — for a preset and a custom range alike, and via Record creation as well as edit;
  while going out to the Observation list, or having the Observation deleted, drops it, so reopening
  even the *same* Observation starts at the default, as does opening a different one.
