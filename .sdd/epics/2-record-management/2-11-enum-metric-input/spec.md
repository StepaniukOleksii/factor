# Enum Metric Input

* 2026-08-04

## 1. Goal

`Enum` has been a `MetricValueType` since the domain was written, with `EnumConstraint` to hold its allowed
values and a `validateValue` branch to enforce them, but the Create Observation screen has never offered it and
`CreateObservationInput` has no way to carry the values. Nothing a user creates can be an Enum, and the only
ones in existence are dev fixtures. A user wanting to track a mood as `low`/`ok`/`high` has to type it as free
Text, where a typo makes a fourth category and nothing can ever group the results.

Let a Metric declare a fixed set of values it accepts, and let a Record pick one of them.

## 2. Requirements

* A Metric may be typed as a fixed set of choices, offered in the Create Observation screen's type dropdown
  alongside the existing types.
* Such a Metric declares between 2 and 4 values, each at most 12 characters. Values are unique, ignoring case
  and surrounding whitespace, and are offered in the order they were declared.
* Values are entered per Metric on the Create Observation screen, and only for a Metric of this type. Switching
  a Metric to another type removes the editor and discards anything typed into it.
* On the Record form, such a Metric offers its values as a row of segments, one selected at most. Selecting the
  chosen segment again clears it, so "not answered yet" stays reachable and distinct — the same control and the
  same behavior a Yes/No Metric already has.
* A stored value reads back as the value itself wherever a Record is displayed.
* Identical on both Record form routes, creating a Record and editing one.
* The type is named for what it offers rather than for its data type, as Yes/No already is.
* Visualization is out of scope: a Metric of this type still renders no chart, and the TRENDS section still
  appears only for Numeric Metrics.
* Editing an existing Metric's values is out of scope — no Observation- or Metric-editing feature exists, so
  values are set only when the Metric is first defined.
* Layout per [`design/enum-metric-input.html`](design/enum-metric-input.html).

## 3. Technical Design

### 3.1 Domain

Unchanged. `EnumConstraint` and the `Enum` branch of `Metric.validateValue` already accept exactly a string
drawn from `allowedValues` and reject everything when the constraint is absent, and `Metric.test.ts` covers
both. That last behavior is why this feature is all-or-nothing: an Enum Metric created without values would
refuse every value forever, so the count rule below is what makes the type safe to offer at all.

`validationLimits.ts` gains `METRIC_ENUM_MAX_VALUES = 4` and `METRIC_ENUM_VALUE_MAX_LENGTH = 12`, and its
header comment widens — it currently describes itself as character lengths only, and one of these is a count.
Both numbers come from the control that has to render them (§3.4), not from the domain.

### 3.2 Application

`CreateObservationUseCase`: each entry of `CreateObservationInput.metrics` gains `values?: string[]`, raw as
typed, for the reason [Numeric Metric Boundaries](../2-10-numeric-metric-boundaries/spec.md) §3.2 gives for
`min`/`max`. `toNumericConstraint` and a new `toEnumConstraint` are selected between by the metric's type in
one place, so a Metric gets exactly one kind of constraint and the two rule sets cannot both run.

For an Enum Metric, in declaration order: each value trimmed, and blank ones dropped rather than rejected — a
blank row is the editor's own affordance (§3.4), not something the user typed. Then:

* Fewer than 2 surviving values: `Error('A choice metric needs at least 2 values')`. One value offers no
  choice, and none makes the Metric unfillable.
* More than `METRIC_ENUM_MAX_VALUES`: `Error('A choice metric can have at most 4 values')`.
* A value over `METRIC_ENUM_VALUE_MAX_LENGTH`: `Error('A choice value cannot exceed 12 characters')`.
* Two values equal ignoring case: `Error('Choice values must be unique')`. Case-insensitive because the
  segments are what the user tells them apart by, and `Low` beside `low` is a distinction the control cannot
  show; the casing that was typed is what gets stored.

Values arriving on a Metric of any other type are rejected, and bounds arriving on this one are rejected by the
rule already there — same reasoning in both directions, and the screen sends neither.

### 3.3 Storage

Unchanged. `metrics.constraintJson` already carries whatever `MetricConstraint` a Metric holds, and
`SQLiteObservationRepository` already serializes and parses it, `EnumConstraint` included. No migration, and a
database predating this feature keeps working.

### 3.4 Presentation

**`metricDisplay.ts`** — `METRIC_TYPE_LABELS` renames `Enum` to **"Choice"**, on the reasoning that module
already states for Yes/No: the domain's names are developer vocabulary, and `Enum` names a data type rather
than the thing it offers. The domain type stays `Enum`; only the word the user reads changes, and
`formatMetricType` is the single place it is read from.

A new `toEnumOptions(constraint)` builds the `SegmentedFieldOption<string>[]` the Record form renders, label
and value alike being the declared value, and returns an empty list for a Metric with no constraint. It sits
beside `BOOLEAN_METRIC_OPTIONS` for the same stated reason — one source for the words a Record can read back
as. `formatMetricValue` needs no change: an Enum value is already a string and already falls through to
`String(value)`.

**`CreateObservationScreen`** — `METRIC_TYPE_CHOICES` gains `'Enum'`, appended, so the existing three keep
their positions. `MetricDraft` gains `values: string[]`, starting as two empty strings so the minimum is
visible rather than discovered on save; `EMPTY_METRIC` carries the same. `selectType` clears it whenever the
chosen type is not `Enum`, exactly as it already clears `min`/`max` for a non-Numeric one.

The editor occupies the same slot between TYPE and DESCRIPTION that the bound fields do — a Metric has one
type, so the two are mutually exclusive and never both render. It is the METRICS list one level down: a column
of `LabeledTextField`s labeled `VALUE 1`, `VALUE 2`, … each carrying a delete button in its `labelAccessory`
slot the way a metric card does, shown only while more than two rows exist, and a dashed **Add Value** button
below styled after **Add Metric**, hidden once `METRIC_ENUM_MAX_VALUES` rows exist. Numbered labels rather than
one heading over bare inputs, because `LabeledTextField` requires a label and is deliberately the only styled
input in the app.

**`RecordFormScreen`** — the Boolean branch of `renderMetricInput` widens to cover both segment types: an Enum
Metric renders `SegmentedField<string>` with `toEnumOptions(metric.constraint)`, everything else about the
branch — deselection, `helpText`, `error`, `testID` — unchanged. The comment there about Enum wanting a picker
goes with it.

`validateValue` still runs on save, but the control cannot produce a value outside `allowedValues` and no
Metric-editing feature exists to invalidate a stored one, so the error path is unreachable from the UI; it
keeps today's generic message rather than gaining wording nothing can show.

**Why 4 values, 12 characters.** `SegmentedField` gives each segment `flex: 1` and 16px of horizontal padding,
so on a 412px screen the Record form's card leaves 348px to divide: 109px per segment at three values, 80px at
four, 63px at five. Net of padding and borders that is 75px, 46px and 29px of text — under four characters at
five, where even `high` would wrap. Four is the last count that reads.

The character limit is not a promise a value fits on one line. At four segments anything past roughly six
characters already wraps, and the row grows to match rather than truncating — the mockup's `outstanding` is
that worst case, at 64px against a single line's 45px. 12 is the point past which a value stops being a label
and belongs in the Metric's description instead.

## 4. Verification

### Seed Data

None. `mixed metrics` already carries `category` (`a`/`b`/`c`) and `no numeric` carries `mood`
(`low`/`ok`/`high`), so both the shared-record and the no-chart fixture exercise this feature as they stand,
and 3 values is the ordinary case. The at-cap and long-value cases are reached faster by hand on the create
screen than by seeding a fifth Metric nobody else needs — the reuse rule in
[testing-data.md](../../../../testing-data.md) is satisfied without an addition.

That document still needs its `mixed metrics` and `no numeric` Add Record checklists updated: `category` and
`mood` now render as segments rather than text inputs.

### Manual Verification

Run **Reseed test data** first. No storage change, so there is nothing to clear.

1. Open `no numeric` and tap **Add Record**: `mood` shows `low`, `ok` and `high` as segments, none selected,
   laid out exactly like `done`'s Yes/No beneath it.
2. Tap `high`, then tap it again: it selects, then clears. Save with nothing selected: accepted, since values
   are optional.
3. Add a Record with `high` selected and save. Under RECENT RECORDS it reads back as `high`, and the details
   screen still shows no TRENDS section.
4. Long-press that Record, choose **Edit Record**: `high` is pre-selected, and changing it to `low` and saving
   sticks.
5. Open `mixed metrics` and tap **Add Record**: `category` shows `a`/`b`/`c` as segments while `note` beside it
   is still a text field, and the description info buttons are where they were.
6. Create an Observation by hand — the only path exercising the type dropdown, the editor and the use case. The
   dropdown offers **Choice**; picking it shows two empty value rows and no MIN/MAX, and picking Numeric
   afterwards swaps them back with the typed values gone.
7. Still there, add values up to the fourth: **Add Value** disappears at four. Delete one and it returns; the
   delete buttons themselves disappear at two.
8. Save with one value blank, then with two values differing only in case, then with a value past 12
   characters: each is refused by an alert naming the problem. Then save with four valid values, open the
   Record form, and confirm all four segments render and remain readable.
9. Reload the app: the Observation, its values and the selected Record value all survive.

### Automated Tests

* **Unit — `CreateObservationUseCase`:** builds an `EnumConstraint` in declaration order; drops blank and
  whitespace-only values before counting; rejects fewer than 2 surviving values, more than 4, one over 12
  characters, and two differing only in case, each with its stated message; stores the casing as typed; rejects
  values on a non-Enum Metric and bounds on an Enum one; validates each Metric independently.
* **Integration — `SQLiteObservationRepository`:** `save` then `findAll` round-trips an `EnumConstraint`,
  preserving value order, alongside a Numeric Metric's bounds on the same Observation.
* **Unit — `metricDisplay`:** `formatMetricType` returns `Choice` for `Enum`; `toEnumOptions` maps values to
  options in order and returns an empty list for a Metric with no constraint.
* **Screen — `RecordFormScreen`:** an Enum Metric renders one segment per allowed value; tapping one reports
  it; tapping the selected one clears it; a Boolean Metric is unaffected; both routes.
* **Screen — `CreateObservationScreen`:** the dropdown offers all four types; the value editor renders only for
  an Enum Metric; changing type clears it; **Add Value** is hidden at the cap and the delete buttons at the
  minimum; `handleSave` passes the values through.
* **E2E:** `.maestro/2-11-enum-metric-input.yaml`, on the `seed` fixture — opening `no numeric`'s Record form,
  tapping `mood`'s `high` segment, saving, and seeing it on the Record. `no numeric` rather than
  `mixed metrics` because its values are words Maestro can match on, where `category`'s single letters would
  collide with other text on screen.
