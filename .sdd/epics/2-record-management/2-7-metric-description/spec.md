# Feature Spec: Metric Description

* Date: 2026-07-26

## 1. Goal
A Metric name is capped at 15 characters — enough to label a field, nowhere near enough to say that `Mood` runs
1-5 where 1 is "barely functioning" and 5 is "great", or that `Duration` means minutes of actual sleep rather
than time in bed. With nowhere to write that down, a Metric gets recorded against a drifting private
definition, and the trend it produces is noise dressed as signal.

Give each Metric optional descriptive text, written when the Metric is defined and available on the Record form
at the moment a value is chosen.

## 2. Requirements
* [ ] `Metric` supports an optional `description`, entered per Metric on the Create Observation screen and
  persisted alongside it.
* [ ] Limited to 500 characters, enforced both in the input and by the use case. Line breaks the user types are
  preserved and displayed, so a per-value legend reads as a list rather than one run-on paragraph.
* [ ] On the Record form, a described Metric shows an info button beside its label; tapping it opens a dialog
  carrying the Metric's name and its description. Identical for every Metric type — the text fields Numeric,
  Text and Enum use, and the `Yes`/`No` segments Boolean uses.
* [ ] The dialog is dismissed by its own action, by tapping outside it, and by the Android back gesture. It
  leaves the form exactly as it was, values already entered included.
* [ ] A Metric with no description shows no button and no gap where one would be. A described Metric's field is
  otherwise laid out exactly as it is today — the button is the only difference, and nothing on the form moves
  when the dialog opens or closes.
* [ ] A screen reader announces the description without the user having to open the dialog.
* [ ] Identical on both Record form routes — creating a Record and editing one.
* [ ] Not shown on the Observation List or Details screens, trend cards included. The Record form is the only
  place it appears.
* [ ] Editing an existing Metric's description is out of scope — no Observation- or Metric-editing feature
  exists, so a description can only be set when the Metric is first defined.

## 3. Technical Design

### 3.1 Domain
* `Metric` (`src/domain/Metric.ts`) gains `description: string | null` defaulting to `null`, the same
  optional-field pattern as `Observation.description`. Appended after `constraint`, so existing call sites keep
  working — with the consequence that a caller setting a description but no constraint must pass `constraint`
  explicitly to reach it. A plain mutable field like `name`, and no part of `validateValue`: it guides the
  person entering a value rather than constraining the value.
* `validationLimits.ts` gains `METRIC_DESCRIPTION_MAX_LENGTH = 500` — generous by design, enough for a
  per-value legend for a 1-10 scale plus a sentence of framing.

### 3.2 Application
`CreateObservationUseCase`: each entry of `CreateObservationInput.metrics` gains `description?: string`,
validated in the existing `metrics.map(...)` pass beside the metric name — trimmed, normalized to `null` when
empty or whitespace-only, and rejected over the limit with
`Error('Metric description cannot exceed 500 characters')`, matching the manual-`throw` style already there.
`trim()` leaves interior newlines intact, so preserving them needs no special handling; the length check counts
newline characters, as the input's own `maxLength` does.

`ObservationRepository` and `GetObservationByIdUseCase` are unchanged — both already move whole entities.

### 3.3 Storage
Add a nullable `description TEXT` column to the `metrics` table in `Database.ts`, and carry it through
`SQLiteObservationRepository`: the metric `INSERT` in `save()`, and `MetricRow`, the `SELECT`, and the `Metric`
constructor call in `findAll()`. SQLite stores the text verbatim, so newlines round-trip without escaping.

No migration runner is added, and any database created before this change must be wiped rather than upgraded —
the same decision, for the same reasons and with the same reseeding caveat, as
[Observation Description](../../1-observation-management/1-5-observation-description/spec.md) §3.3.

### 3.4 Shared Components
Since [Boolean Metric Value Input](../2-6-boolean-metric-input/spec.md) replaced the `Switch`, every Metric on
the Record form renders through one of two shared components — `LabeledTextField` for Numeric, Text and Enum,
`SegmentedField` for Boolean. Showing the description in a dialog rather than inside the field means neither
component needs a new layout slot: all that lands in the field is a button in its label row, and the text
itself appears in a window above the form. Nothing on the form reflows, and a 500-character description needs
no truncation, no clamping, and no "more" affordance.

**New shared component — `FieldHelpButton`** (`src/presentation/components`, exported from its `index.ts`): an
info button that opens a dialog explaining the field it sits in. Props: `title` (the dialog's heading, normally
the field's own label), `text` (the body), and `testID`. It owns whether its dialog is open — no caller needs
to read that, and only one dialog can be open at a time by nature, so there is nothing to coordinate.

* **Button:** `MaterialIcons` `info-outline`, ~18px, `COLORS.onSurfaceVariant`, with `hitSlop` bringing the
  touch target to at least 40x40 since the glyph is far smaller. `accessibilityRole="button"` and an
  `accessibilityLabel` naming the field it explains.
* **Dialog:** styled after the confirmation dialogs already on the Observation Details screen — `rgba(0,0,0,0.6)`
  overlay, `surfaceContainerLow` content at `RADIUS.xl` with `24px` padding, `ELEVATION.dialog`, capped at
  384px wide, `statusBarTranslucent` and `navigationBarTranslucent`. `title` as the heading, `text` as the body
  in a single `Text` so the user's newlines render as line breaks, and one trailing dismiss action ("Close").
  Dismissed by that action, by pressing the overlay, and through `onRequestClose` for the Android back gesture.
  The body scrolls if it outgrows the available height — 500 characters fits comfortably at the default text
  size, but need not at the largest accessibility ones.
* Deliberately not built on a generic modal component. There isn't one, and creating one is already tracked in
  the refactor backlog; this follows the existing dialogs' styling rather than pre-empting that work.

**Both field components** gain one optional prop, `helpText?: string` — role-named rather than named after
`Metric.description`, like `error` is, since neither component knows anything about Metrics and neither should
start to. When it is set, each renders a `FieldHelpButton` in its label row, passing its own `label` as the
dialog heading; absent or empty, both render exactly what they render today.

* **Placement:** against the label text, not in `LabeledTextField`'s trailing `labelAccessory` slot, where the
  Create screen's per-metric delete button lives. That row pins its two children apart with
  `justifyContent: 'space-between'`, so the label and the button need wrapping in a left-hand group for that to
  keep holding. `SegmentedField`'s label is a bare `Text`, which gains a row of its own.
* **Screen readers:** `LabeledTextField` sets its input's `accessibilityHint` from `helpText`, applied before
  the existing `{...rest}` spread so an explicit caller hint still wins. `SegmentedField` hints its label
  instead of its segments — one focusable element per option means hinting each would read the whole
  description out once per segment.
* **Test hooks:** each passes its own `testID` down, so the button and the dialog derive theirs by suffix, as
  `SegmentedField` already does for segments. `LabeledTextField` needs a `testID` prop for this.

### 3.5 Screens
**`CreateObservationScreen`** — each metric card gains a third field below METRIC NAME and TYPE, in the same
`metricGrid` column: a `LabeledTextField` labeled "DESCRIPTION", `multiline`, ~3 lines tall,
`maxLength={METRIC_DESCRIPTION_MAX_LENGTH}`, `showCounter`, placeholder along the lines of "Optional — what does
each value mean?". Always visible rather than behind an "Add description" affordance, matching the Observation's
own description field on this screen. `MetricDraft` gains `description: string`, empty in the initial state and
in `handleAddMetric`; `handleMetricChange` is already generic over `keyof MetricDraft` and needs no change.
`handleSave` passes it through.

**`RecordFormScreen`** — both branches of `renderMetricInput` pass the Metric's description as `helpText`, and
nothing else changes. The text-field branch should also start passing the `record-metric-<metricId>` `testID`
the Boolean branch already passes, so a Metric's button is addressable regardless of its type.

**Unchanged:** `ObservationListScreen` and `ObservationDetailsScreen`, trend cards included. Details is tuned
for reading trends and the list for scanning many Observations at a glance — the reasoning that already keeps
the Observation's own description off the list.

### 3.6 Test Data
Give four of `mixed metrics`' eight Metrics a description in `devSeedData.ts` and leave the other four without,
so one Record form carries every state of this feature at once, across both field components:

* `dense` (Numeric) — one short line: the ordinary case.
* `hourly` (Numeric) — several lines, so the dialog has line breaks to preserve.
* `yearly` (Numeric) — as close to the 500-character limit as its scenario text naturally runs, so the dialog's
  longest possible body is exercised.
* `flag` (Boolean) — one short line, covering the `SegmentedField` path.
* `sparse`, `insufficient`, `category` and `note` keep none, as does every Metric on `no numeric`,
  `stale records` and `no records` — so the no-button state stays present on the same form and on every other
  Observation.

Wording follows the convention `testing-data.md` already sets: each describes the scenario its Metric covers, in
the same voice as the Observation descriptions already seeded, rather than imitating a realistic tracker legend.
`mixed metrics` is the host because the reuse rule in that document says to extend existing fixtures first, and
because a single form showing described and undescribed Metrics side by side is exactly what needs eyeballing.

Note that this data never passes through `CreateObservationUseCase` — `reseedDevData()` builds entities and
calls the repository directly — so nothing enforces the 500-character limit on it. A test guards that instead
(see below).

**`testing-data.md`** needs updating alongside: extend the paragraph recording which Observations carry
descriptions to cover Metric descriptions and what each of the four is for, and add the info-button states to
the `mixed metrics` manual verification checklist.

## 4. Verification Plan

### Manual Verification
Run **Reseed test data** first (see [testing-data.md](../../../../testing-data.md)); `mixed metrics` carries
every display state on one form.

1. Open `mixed metrics` and tap **Add Record**. `dense`, `hourly`, `yearly` and `flag` show an info button
   beside their label; `sparse`, `insufficient`, `category` and `note` show none and leave no gap. Every field
   keeps the height and position it had before this feature.
2. Tap `dense`'s button: a dialog opens with the Metric's name as its heading and its description as the body.
3. Dismiss it three ways — its own action, a tap outside it, and the Android back gesture. Each returns the form
   untouched, including a value already typed into another Metric.
4. Tap `flag`'s button: the same dialog from the segmented control. Dismissing it leaves a selected segment as
   it was.
5. Open `hourly`'s: its line breaks show as separate lines, not one run-on paragraph.
6. Open `yearly`'s, the longest: the body either fits or scrolls, and nothing is clipped or cut off behind the
   dismiss action.
7. Save the form with `dense` left empty: the required-field error renders below the input as usual, and the
   info button is unaffected.
8. With TalkBack, without opening a dialog: the description is announced when focusing `dense`'s input and when
   reaching `flag`'s label, and is not repeated on each of its segments. The info button itself announces as a
   button naming its Metric.
9. Long-press a Record under RECENT RECORDS and choose **Edit Record** — same behavior throughout.
10. Create an Observation by hand with one described Metric and one without: this is the only path that
    exercises the authoring field and the use case, both of which reseeding bypasses. While typing, push past
    500 characters — the input stops and the counter reads "500/500". Save, open its Record form, and confirm
    only the described Metric shows a button.
11. Reload the app — descriptions persisted, undescribed Metrics still clean.
12. If a database predating this change exists on the device, clear the app's storage so it is recreated fresh —
    there is no in-place upgrade.

### Automated Tests
* **Unit:** `Metric` defaults `description` to `null`. `CreateObservationUseCase` accepts a valid description,
  rejects one over 500 characters with the expected message, normalizes empty/whitespace-only to `null`,
  defaults to `null` when omitted, trims the ends while keeping interior newlines, and validates each Metric
  independently — a bad description on the second Metric still throws.
* **Integration:** `SQLiteObservationRepository` round-trips each Metric's description, including `null`, one
  containing newlines, and several Metrics on one Observation each keeping their own.
* **Fixtures:** `devSeedData` — exactly the four intended Metrics of `mixed metrics` carry a description and
  every other seeded Metric is `null`; the multi-line one contains a newline; and no seeded description exceeds
  `METRIC_DESCRIPTION_MAX_LENGTH`, which nothing else would catch since the seed never runs the use case. Keeps
  `testing-data.md`'s claims true, the way the existing point-count assertions do.
* **Component — `FieldHelpButton`** (new): renders a button and no dialog until it is pressed; the open dialog
  shows the given title and text; it closes via its dismiss action, via a press on the overlay, and via
  `onRequestClose`; the button reports its role and label to accessibility.
* **Component — the field components** (`SegmentedField.test.tsx`, and a new `LabeledTextField.test.tsx`, since
  it has none yet): no button without `helpText`; a button with it; `LabeledTextField` applies the hint to its
  input and lets an explicit `accessibilityHint` override it, while `SegmentedField` applies it to its label and
  not its segments; counter, error and selection all behave as before when the prop is absent.
* **Screen:** `RecordFormScreen` — a described Metric renders a button and an undescribed one does not, for both
  a text-field and a Boolean Metric; both hold on the create and edit routes.
