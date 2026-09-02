# Metric Unit

* 2026-09-01
* Feature: observation-creation.md — with a clause each in observation-editing.md, trend-charting.md,
  record-value-entry.md and record-listing.md for where it shows, and in domain-overview.md's Metric section for the
  attribute itself
* [x] Implemented
* [ ] E2E tested

## 1. Goal

A Numeric Metric stores a bare number, and nothing on screen says what that number counts: a Metric named `Duration`
reading `7` is seven minutes to whoever set it up and seven hours to whoever reads the chart three months later, and the
Metric's description — the only place that could say so today — sits behind a button on one screen and is absent from
every other. Give a Numeric Metric an optional unit, declared with the Metric and shown after its name wherever the
Metric is named.

## 2. Requirements

* A Numeric Metric carries an optional unit of at most 6 characters. Declaring none and clearing one are the same state.
* The whitespace around a unit is not part of it: it is stored as typed less that whitespace, one of nothing but
  whitespace is no unit at all, and the limit binds what is left after trimming. Nothing else about it is normalised.
* Only a Numeric Metric may carry a unit; a Text, Yes/No or Choice card offers no unit field.
* The unit is declared on the New Observation form and open to editing on the Edit Observation form — on a Metric
  already stored as much as on one being added, since changing it strands no recorded value.
* Its limit is enforced as it is typed and carries a counter, as every other length limit on those forms does
  ([Observation Creation](../../features/observation-creation.md)).
* Changing a Metric's type away from Numeric discards a unit typed for it, as it already discards the bounds.
* A declared unit follows the Metric's name in parentheses in the three places a Metric is named to a user: its trend
  card's title ([Trend Charting](../../features/trend-charting.md)), its field label on the Record form ([Record Value
  Entry](../../features/record-value-entry.md)), and its column header in an expanded Record ([Record
  Listing](../../features/record-listing.md)). A Metric declaring none reads exactly as it does now.
* The column header goes on uppercasing the Metric's name and leaves the unit as it was declared.
* A screen reader reaching a Record form field hears the unit as part of the field's name.
* Nothing judges what a unit says, and two Metrics may declare the same one.
* Out of scope: the unit takes no part in a value's validation, in a chart's scale or in its axis labels, and does not
  reach the Metric chips on [the Observation list](../../features/observation-listing.md).

## 3. Technical Design

### 3.1 Domain

`Metric` (`src/domain/Metric.ts`) gains `unit: string | null`, a plain mutable field like `name`, defaulting to `null`
and declared last on the constructor so every existing `new Metric(...)` call stands. `validationLimits.ts` gains
`METRIC_UNIT_MAX_LENGTH = 6`.

`validateValue` does not read it, for the reason the existing comment gives for `description`: a unit says what a number
counts and never what it may be. That a unit belongs to Numeric alone is likewise not the domain's to enforce — the same
split the bounds already keep, where `NumericConstraint` is a shape the domain offers and the application layer is what
refuses one on the wrong kind of Metric.

### 3.2 Application

`MetricInput` (`CreateObservationUseCase.ts`) gains `unit?: string`, as typed. Both use cases store it through the
existing `toStoredText`, so a unit of nothing but whitespace is stored as no unit at all.

`validateCreateObservation.ts` gains `unit?: string` to `MetricErrors`, and splits the two rules the way the bounds are
already split:

* **The length** goes in `metricIdentityErrors`, beside the description's — `Metric unit cannot exceed 6 characters`,
  from the constant, measured on the trimmed unit as the description's is, so what is judged is what will be stored.
  That function is what judges a Metric already stored, and a stored Metric's unit is editable, so the check has to sit
  there to reach it at all.
* **The type** goes in `constraintErrors` as `Only a Numeric metric can have a unit`, returned under `constraint` rather
  than `unit`. It joins `Only a Numeric metric can have bounds` in being unreachable from the form — the card renders no
  unit field off Numeric and clears the draft when the type changes — so it is a caller-bug guard that no field renders,
  which is what `constraint` is for.

`firstErrorMessage` gains `unit` to its per-Metric chain, after `description` and before `constraint`, matching the
order the fields sit in on the card.

### 3.3 Infrastructure

`metrics` gains a nullable `unit TEXT` column in `Database.ts`'s `SCHEMA`, carried through
`SQLiteObservationRepository`: the `INSERT` in `save`, the `INSERT … ON CONFLICT` and its `SET` list in `update`, the
`MetricRow` type, the `SELECT`, and the `Metric` constructor call that reads a row back.

**No migration runner is added, and a database predating this change must be wiped rather than upgraded.** The schema is
`CREATE TABLE IF NOT EXISTS` only, so an existing `metrics` table keeps the columns it has and every statement naming
`unit` fails against it. That reaches the released app (`io.github.stepaniukoleksii.factor`) and the real data in it,
which has to be cleared through Android's app storage settings — the dev menu's reseed is compiled out of a release
build ([releasing-android.md](../../../releasing-android.md)). The project has no migration mechanism, and this slice
does not introduce one — the same answer [Metric Ordering](../../features/metric-ordering.md) gave when it added the
`position` column, accepted again here rather than reopened.

### 3.4 Presentation

**`metricDisplay.ts`** gains `formatMetricLabel(name: string, unit: string | null): string`, returning `name (unit)`
where there is one and `name` where there is not. It takes the name rather than the Metric so that the caller decides
the name's casing: the expanded Record's column header uppercases the Metric's name and must not uppercase the unit with
it, `kcal/d` and `KCAL/D` not being the same unit to anyone who reads them. Every other caller passes `metric.name` as
it stands.

**`MetricEditorCard`** — `MetricDraft` gains `unit: string`, empty on `emptyMetricDraft()`, filled by `toMetricDraft`
from the stored Metric, and cleared by `selectType` for every type but Numeric alongside `min`, `max` and `values`. It
moves with its card ([Metric Ordering](../../features/metric-ordering.md)), the whole draft being what `moveMetricDraft`
reorders.

* *An editable Numeric card* renders UNIT as a third cell of the existing `boundsRow`, equal in width to MIN and MAX:
  the three of them together are what say what the number is, and a six-character field given the card's full width
  would be the widest input on screen holding the shortest value. `maxLength` is `METRIC_UNIT_MAX_LENGTH` with
  `showCounter`, and its `testID` is `metric-unit-${index}`, following the bounds' own naming.
* *A stored Numeric card* has no row to join, its range being stated text, so UNIT sits as a field of its own after TYPE
  and the stated RANGE and before DESCRIPTION. A field rather than a stated fact: the card's other two editable things
  are the name and the description, and a unit belongs with them.
* Off Numeric, neither card renders anything in its place.

**`ObservationDetailsScreen`** — the trend card title and the expanded Record's column header both go through
`formatMetricLabel`, the header passing `metric.name.toUpperCase()`.

**`RecordFormScreen`** — every Metric field's `label` becomes `formatMetricLabel(metric.name, metric.unit)`, for all
four types, and the Numeric field's `accessibilityLabel` becomes `${formatMetricLabel(…)} value`, so the unit is
announced rather than only drawn. The label is also what `LabeledTextField` titles a described Metric's help dialog
with, so that dialog's heading carries the unit too — which is where a description explaining the unit is read.

The Metric chips on `ObservationListScreen` are left bare deliberately. A row shows three of them beside a `+N`
overflow, and a unit on each turns a glance at what an Observation measures into reading: the question a unit answers is
asked where a value is entered or read, not where an Observation is picked out of a list.

## 4. Verification

### Seed Data

`devSeedData.ts`, on `mixed metrics`: give `hourly` the unit `min` and `yearly` the unit `kcal/d`, and leave `dense`,
`sparse` and `insufficient` without one, so both states sit together in one trend section, on one Record form and in one
expanded Record. `kcal/d` runs to exactly the six-character limit, so the longest unit a card title and a column header
can hold is on screen every time the fixtures are reseeded, the way `mixed metrics`' own description already carries its
limit. `devSeedData.test.ts` asserts every seeded unit against the limit, as it does the names and descriptions.

Deliberately not `dense`, and not `stale records`' `value`: the Record form labels its inputs `<metric name> value` for
accessibility, and both of those names are load-bearing selectors in existing flows.

`no numeric`, `stale records` and `no records` gain no unit — the first has no Numeric Metric to give one to, and the
other two are single-Metric fixtures whose charts are about windows rather than labels.

### Manual Verification

Reseed test data first. A database predating this change must be cleared rather than upgraded — on the development build
the reseed does that, and on any other install clear the app's storage.

1. Open `mixed metrics`: the trend cards read `dense`, `sparse`, `hourly (min)`, `yearly (kcal/d)` and `insufficient`,
   in that order, and the two carrying units stand no taller than the three that do not.
2. Tap **Add Record**: the fields read those same five labels. `hourly (min)` still states its `0-100` range and still
   carries its description's info button, whose dialog is now headed `About hourly (min)`.
3. Save the Record and expand it under RECENT RECORDS: the columns read `DENSE`, `HOURLY (min)` and `YEARLY (kcal/d)` —
   the name uppercased, the unit as declared.
4. Back on the Observation list, `mixed metrics`' Metric chips read `dense`, `sparse`, `hourly`, with no units and no
   gap where one would be.
5. ⋮ → **Edit**: `hourly`'s card states its type and its `0-100` range and shows a UNIT field holding `min`; `dense`'s
   shows an empty one; `category`'s and `note`'s show none. Clear `hourly`'s unit and save — its trend card reads
   `hourly`, and so does its field on the Record form.
6. Reopen the form and type seven characters into `dense`'s UNIT field: the input stops at six and the counter reads
   `6/6`. Save, and both the card title and the Record form label carry it.
7. **Create observation** → a Metric named `Weight`, type Numeric, unit `kg`: it is created, and its trend card reads
   `Weight (kg)`. Add a second Metric, type a unit into it while it is still Numeric, then switch its type to Choice and
   back — the unit field is empty, as the bounds are.
8. With a screen reader, focus the Record form's `hourly (min)` field: the unit is part of what is announced.

### Automated Tests

* **Unit:** `Metric` defaults `unit` to `null`. `validateCreateObservation` accepts a unit at the limit and one absent,
  accepts a padded one trimming to the limit, refuses one past it, refuses one on each of the three non-Numeric types
  under `constraint`, and judges a stored Metric's unit through `validateUpdateObservation`. `CreateObservationUseCase`
  and `UpdateObservationUseCase` store a trimmed unit and store a whitespace-only one as `null`. `firstErrorMessage`
  returns the unit's message in its stated position.
* **Integration:** `SQLiteObservationRepository` round-trips `unit`, `null` included, through both `save` and `update`,
  and a cleared unit overwrites a stored one.
* **Component:** `formatMetricLabel` composes both forms and leaves the name's casing alone. `MetricEditorCard` renders
  the unit field on an added Numeric card and on a stored one, renders none for the other three types, clears a typed
  unit when the type changes, and stops the input at the limit.
* **Screen:** `ObservationDetailsScreen` titles a trend card and a Record column with the unit and without;
  `RecordFormScreen` labels a field with the unit and exposes it to accessibility.

### E2E Flow

Extend `.maestro/flows/observation-creation/observation-creation.yaml` — declaring a unit is part of declaring a Metric,
and that flow already creates `Sleep` with the Metric `Hours` and opens its details screen to prove the Metric was
saved.

* **Fixture:** `reset`, which the flow already opens with.
* **Covers:** typing `h` into the unit field while `Hours` is being filled in, then asserting that the details screen's
  trend card reads `Hours (h)` where the flow currently asserts `Hours`.
* **Handles:** the unit input needs `metric-unit-0`, which §3.4 gives it; nothing else on the path is new. The
  assertion's parentheses have to be escaped — Maestro matches a selector as a regular expression, so an unescaped
  `Hours (h)` matches the text `Hours h` and never the card.
