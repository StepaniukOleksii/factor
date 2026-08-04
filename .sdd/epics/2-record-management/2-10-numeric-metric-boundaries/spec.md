# Numeric Metric Boundaries

* 2026-08-04

## 1. Goal

A Numeric Metric accepts whatever number is typed into it. A `Mood` kept on a 1-5 scale takes 50 without
complaint, and a stray digit on a sleep duration enters the trend as a spike no different in shape from a real
one. The domain already models the answer — `NumericConstraint` carries an optional `min` and `max`, and
`Metric.validateValue` enforces both — but nothing outside the dev fixtures can set them, so every Metric a user
creates is unbounded.

Let a Numeric Metric declare its bounds when it is defined, and hold Records to them.

## 2. Requirements

* A Numeric Metric declares an optional minimum, an optional maximum, both, or neither.
* Bounds are entered per Metric on the Create Observation screen, and only for a Metric typed Numeric. Switching
  a Metric to another type removes the fields and discards anything typed into them.
* A minimum may not exceed its maximum. Bounds may be negative or fractional.
* On the Record form, a bounded Metric's input states its range before anything is typed.
* Saving a value outside its Metric's range is refused, with a message naming the bound it broke. A value
  sitting exactly on a bound is inside the range; an unbounded Metric accepts any number, as today.
* Bounds apply only where a value was entered — a Metric left empty stays valid, per
  [ADR-3](../../../adr/3-record-metric-value-requirements.md).
* Identical on both Record form routes, creating a Record and editing one.
* Trend charts are unaffected: a y-axis is still derived from the data drawn, not from a declared range.
* Editing an existing Metric's bounds is out of scope — no Observation- or Metric-editing feature exists, so
  bounds are set only when the Metric is first defined, and existing Records are never retro-validated.
* Layout per [`design/numeric-metric-boundaries.html`](design/numeric-metric-boundaries.html).

## 3. Technical Design

### 3.1 Domain

Unchanged. `NumericConstraint` and the `Numeric` branch of `Metric.validateValue` already implement every rule
enforced at Record entry, and `Metric.test.ts` already covers all four bound shapes. Constraint coherence — a
minimum no greater than its maximum — is validated in the use case instead, beside the metric name and
description rules already there: an incoherent constraint makes `validateValue` reject every value, so it is
caught where user input first enters the system.

### 3.2 Application

`CreateObservationUseCase`: each entry of `CreateObservationInput.metrics` gains `min?: string` and
`max?: string`, validated in the existing `metrics.map(...)` pass. Raw text rather than parsed numbers, so every
rule lives in one tested place and the screen never has to represent input it could not parse — the same
division that already has `name` arrive untrimmed and be normalized here.

Per metric:

* Absent, empty, or whitespace-only means unset. With neither bound set, `constraint` is `null` and never `{}`,
  which would persist as a meaningless `"{}"` and read as "bounded" to anything testing the field for presence.
* A bound not parsing to a finite number: `Error('Metric bounds must be numbers')`.
* A minimum above its maximum: `Error('Metric minimum cannot exceed its maximum')`. Equal bounds are allowed.
* A bound on a non-Numeric Metric: `Error('Only a Numeric metric can have bounds')` — rejected rather than
  dropped, since the screen never sends it (§3.4) and a silent drop would hide the caller bug.

`ObservationRepository`, `GetObservationByIdUseCase` and the Record use cases are unchanged.

### 3.3 Storage

Unchanged, and no migration. `metrics.constraintJson` already exists and `SQLiteObservationRepository` already
round-trips `metric.constraint`, so a database predating this feature keeps working — unlike
[Metric Description](../2-7-metric-description/spec.md) §3.3, which added a column.

### 3.4 Presentation

**`metricDisplay.ts`** gains the two strings a bound is spoken with, kept together for the reason that module
already gives for `BOOLEAN_METRIC_OPTIONS`:

* `formatMetricRange(constraint)` — the Record field's placeholder: `0-100`, `Min 0`, `Max 100`, or `undefined`
  when unbounded, so no placeholder is passed at all.
* `formatRangeError(constraint)` — `Must be between 0 and 100`, `Must be at least 0`, `Must be at most 100`.

Both take `NumericConstraint | null`, cast at the call site as `Metric.validateValue` casts internally, and
neither dispatches on Metric type.

**`CreateObservationScreen`** — each metric card gains a MIN and MAX pair on one row between TYPE and
DESCRIPTION: they define the shape of a value, so they read under the type that gives them meaning, while the
description is prose about the Metric and stays last. Both are `LabeledTextField`s with `keyboardType="numeric"`
and no counter. The card grows past the fold on a Pixel 7, so Add Metric now takes a scroll to reach.

They render only while the type is Numeric. `MetricDraft` gains `min: string` and `max: string`, empty initially
and in `handleAddMetric`; `handleMetricChange` is already generic over `keyof MetricDraft`. `selectType` clears
both whenever the chosen type is not Numeric, so an abandoned bound cannot be submitted and switching back shows
empty fields. Failures surface through the screen's existing `Alert`, as every other rule here does — this adds
no inline errors.

**`RecordFormScreen`** — the text-field branch of `renderMetricInput` passes `formatMetricRange` as the
`placeholder` for a Numeric Metric. In `handleSave`, a Metric failing `validateValue` takes `formatRangeError`
when the entered value is a number and the Metric is bounded, and keeps today's `Invalid value` otherwise: text
that never parsed to a number is not a range problem. `handleValueChange` already clears a Metric's error on
change.

## 4. Verification

### Seed Data

`mixed metrics` already has closed ranges on `dense` and `hourly` and a floor on `yearly`. Two of its Metrics
change in `devSeedData.ts` so one Record form shows all four bound shapes, per the reuse rule in
[testing-data.md](../../../../testing-data.md): `insufficient` from `{min: 0, max: 100}` to `{max: 100}`, and
`sparse` from `{min: 0}` to no constraint. Both bounds are incidental to what those Metrics exist to cover, and
their values already sit inside what they keep, so no chart or point count changes.

`testing-data.md` needs its Metrics column updated for those two and the placeholder states added to the
`mixed metrics` Add Record checklist. As with Metric descriptions, seeded data bypasses
`CreateObservationUseCase`, so a test guards bound coherence instead.

### Manual Verification

Run **Reseed test data** first. No storage change, so there is nothing to clear.

1. Open `mixed metrics` and tap **Add Record**: `dense` shows `0-100`, `yearly` `Min 0`, `insufficient`
   `Max 100`, and `sparse` no placeholder and no gap. Description info buttons are where they were.
2. Enter 150 into `dense`, -1 into `yearly`, 101 into `insufficient` and 9999 into `sparse`, then save: three
   messages, each under its own field, and none on the unbounded Metric. Nothing is saved.
3. Correct `dense` to 100 — its error clears as the value changes — fix the other two, and save: accepted, so a
   value exactly on a bound is legal.
4. Add another Record with 0.5 in `dense` and nothing anywhere else: accepted, so a fraction inside a range
   passes and an empty form raises no bound error.
5. Enter letters into `dense` and save: the generic `Invalid value`, not a range message.
6. Long-press a Record under RECENT RECORDS, choose **Edit Record**, and repeat step 2 — identical.
7. Create an Observation by hand — the only path exercising the authoring fields and the use case, both of which
   reseeding bypasses. With the Metric typed Numeric, MIN and MAX appear; switch it to Text and then to Yes/No
   and they disappear; switch back and both are empty rather than holding what was typed.
8. Still there, save with a minimum above its maximum, then with letters in a bound: each is refused by an alert
   naming the problem. Then save one Metric with only a maximum and one with no bounds, open the Record form,
   and confirm the placeholders and enforcement match what was declared.
9. Reload the app: every bound survives.

### Automated Tests

* **Unit — `CreateObservationUseCase`:** accepts both bounds, each alone, and neither; treats empty and
  whitespace-only as unset; produces `null` rather than `{}` when neither is given; accepts negative, fractional
  and equal bounds; rejects an unparseable bound, a non-finite one, a minimum above its maximum, and any bound
  on a non-Numeric Metric, each with its stated message; validates each Metric independently.
* **Integration — `SQLiteObservationRepository`:** `save` then `findAll` round-trips each bound shape, the
  stored JSON carrying exactly the bounds set and `null` when unbounded. The read path already covers a closed
  range; the write path and the partial shapes are new.
* **Fixtures — `devSeedData`:** `mixed metrics` carries all four bound shapes on the intended Metrics, and every
  seeded constraint is coherent — nothing else would catch an incoherent one, since the seed never runs the use
  case.
* **Unit — `metricDisplay`:** both formatters across all four shapes, including `undefined` from
  `formatMetricRange`, and negative and fractional bounds rendering as typed.
* **Screen — `RecordFormScreen`:** a bounded Metric's input gets its range as a placeholder and an unbounded one
  gets none; an out-of-range save shows the bound-specific message and does not call the use case; a value on a
  bound saves; unparseable text still reports `Invalid value`; on both routes.
* **Screen — `CreateObservationScreen`** (new file; the screen has no tests yet, as `LabeledTextField` had none
  before [Metric Description](../2-7-metric-description/spec.md)): the bound fields render only for a Numeric
  Metric, changing type clears them, and `handleSave` passes both through.
* **E2E:** `.maestro/2-10-numeric-metric-boundaries.yaml`, on the `seed` fixture — entering an out-of-range
  value on `dense`, seeing the message, correcting it, and saving. Placeholder and message are both platform
  text, so a flow can assert them.
