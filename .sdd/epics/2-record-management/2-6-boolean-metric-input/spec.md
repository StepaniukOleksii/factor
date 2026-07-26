# Feature Spec: Boolean Metric Value Input

* Date: 2026-07-26

## 1. Goal

Replace the Record form's Boolean `Switch` with a deselectable two-segment `Yes`/`No` control, so a Boolean
Metric's three states — no value, `false`, `true` — are each visible and reachable.

Prerequisite for making Metric values optional, which is out of scope —
[Record Creation](../2-1-record-creation/spec.md)'s "Required Metric Values" rule still applies.

## 2. Requirements

* [ ] **Segmented Control Replaces the Switch:** Two segments, "Yes" then "No", under the Metric's name. The
  `Switch` is removed from the form.
* [ ] **Nothing Selected Until Chosen:** Both segments start unselected in create mode, visibly distinct from
  "No" being selected.
* [ ] **One Tap Per Value:** Tapping "Yes" stores `true`, "No" stores `false`, from any starting state.
* [ ] **Retap Clears:** Tapping the selected segment deselects it, returning the field to no value.
* [ ] **No Value Is Absent:** An unanswered or cleared Metric contributes no entry to the submitted values —
  never `undefined`, `null`, or `false`.
* [ ] **Required Rule Unchanged:** An unselected Boolean blocks saving with "This field is required" below
  the control. Selecting either segment clears the message.
* [ ] **`false` Saves as `false`:** Neither the required check nor type validation treats it as missing.
* [ ] **Edit Mode Pre-selects:** The stored value's segment is selected on load, and can be changed or
  cleared. Saving a cleared field is blocked by the required check.
* [ ] **Shared Component:** Implemented as `SegmentedField` in `src/presentation/components`, exported from
  its `index.ts`, agnostic about what its options mean.
* [ ] **Styling:** Per [the design specification](design/boolean-metric-input.html).
* [ ] **Accessible Selection State:** Each segment exposes its label and whether it is selected. The Switch's
  on/off semantics, which cannot express "unselected", are not carried over.
* [ ] **Unaffected:** Numeric, Text and Enum inputs, and how Boolean values display outside the Record form.
  Moving Enum onto `SegmentedField` is not part of this feature.

## 3. Technical Design

### 3.1 Data Models

None. `Metric.validateValue` rejects `undefined` and `null` for every type, so "no value" is the Metric's key
being **absent** from a Record's value map, never a key holding an empty marker.

### 3.2 Application Layer

None. Note that `Record.updateValues` sets keys and cannot remove one, so a cleared value could not be
persisted — not reachable here, because the required check blocks the save first. Tracked separately in the
bug backlog; do not fix it in this feature.

### 3.3 Storage Layer

None. A Metric with no value simply has no `record_values` row.

### 3.4 Shared Component — `SegmentedField`

A labelled single-select control, generic over its option value type.

Props:

* `label` — caption above the segments.
* `options` — ordered list, each carrying the value it stands for and its segment text.
* `selected` — the selected option's value, or a nothing-selected state.
* `onSelect` — called with the tapped option's value, or with the cleared state when that option was already
  the selected one.
* `error` — optional message rendered below the segments.
* `testID` — prefix; each segment derives its own from it and the option's value, following
  `TimeRangeSelector`'s `time-range-preset-1D` pattern.

Behavior: one segment per option in a row sharing the available width; zero or one selected at a time;
tapping reports through `onSelect` and the component holds no selection state of its own; each segment is a
button exposing its label and selected state to accessibility. Presentational only — no validation, no
Metric awareness.

### 3.5 User Interface — Record Form Screen

The Boolean branch of `renderMetricInput` renders `SegmentedField` with the Metric's name as label, "Yes"
for `true` and "No" for `false` as options, the Metric's current value as the selection, and its current
validation message as the error.

`handleValueChange` gains a clearing path that **removes** the Metric's key rather than setting it to
`undefined`. `handleSave` builds its command from `Object.keys(values)`, so a key left present with
`undefined` would be submitted and rejected by `Metric.validateValue` as an *invalid* value — a save-failure
alert instead of the intended required message.

`handleSave` itself is unchanged: its required check uses strict equality, so a stored `false` already
passes.

Remove the `Switch` import and the `label` / `inputWrapper` / `errorText` styles once `SegmentedField` owns
that presentation.

## 4. Verification Plan

### Manual Verification

1. Create a Record for an Observation with a Boolean Metric: two segments, neither selected.
2. Fill every other Metric and save: blocked, with "This field is required" below the unselected segments.
3. Tap "No" once: it selects, the message clears, and saving succeeds.
4. Re-open the Record for editing: "No" is pre-selected.
5. Tap "Yes", save, re-open: "Yes" is pre-selected.
6. Tap the selected segment: it deselects.
7. Save with it cleared: blocked with the required message.
8. Numeric, Text and Enum inputs are unchanged, as are the Observation Details Record tiles.
9. With a screen reader, each segment announces its label and whether it is selected.

### Automated Tests

* **`SegmentedField`:** renders one segment per option, none selected when the selection is empty; tapping an
  unselected option reports its value; tapping the selected option reports the cleared state; renders a
  supplied error; reports each segment's selected state to accessibility.
* **Record form, create mode:** renders `SegmentedField` rather than a `Switch`; saving untouched is blocked
  with the required message; one tap on "No" submits `false` (regression guard for the two-tap bug); one tap
  on "Yes" submits `true`; a cleared Metric is absent from the submitted values.
* **Record form, edit mode:** a stored `false` pre-selects "No" and `true` pre-selects "Yes"; changing the
  selection and saving submits the new value; clearing and saving is blocked.
* Update existing Record form tests that reach for the Boolean control by `Switch` type, and remove the test
  file's React Native `Switch` mock.
