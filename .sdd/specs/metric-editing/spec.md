# Metric Editing

* 2026-08-23
* Feature: observation-editing.md
* [x] Implemented
* [ ] E2E tested

## 1. Goal

An Observation declares every Metric it will ever ask for in a single pass at creation ([Observation
Creation](../../features/observation-creation.md)), and nothing since has been able to revisit that list. A user who
realises three weeks in that they should also have been logging caffeine, or who named a Metric badly and now reads it
on every chart and every Record form, has one route out: delete the Observation and declare it again — losing every
Record under it, which is the whole of what the Observation was for. Let an existing Observation's Metrics be renamed,
redescribed, and added to.

## 2. Requirements

* The Observation edit form ([Observation Editing](../../features/observation-editing.md)) carries the Observation's
  Metrics below its name and description, in declaration order, each showing its name, its type, its description, and
  whatever its type declares.
* A stored Metric's name and description are editable. Its type, its bounds and its Choice values are shown and are not
  editable.
* **Add Metric** appends a Metric card editable in full — name, type, description, and whatever the chosen type declares
  — behaving as the creation form's does.
* A Metric added in the current editing session can be removed from the form. A stored Metric cannot.
* Metric names stay distinct within the Observation under the name identity rule, and a refusal marks the second of the
  colliding pair. A stored Metric keeping its own name is not a collision.
* Saving writes the Observation's name, its description, its renamed and redescribed Metrics and its added ones in a
  single step: all of it lands or none of it does.
* A Metric added is appended to the Observation's Metric order, so it reads last wherever Metrics are shown — its trend
  card, the Record form's fields, an expanded Record's columns.
* No Record is changed by any edit this form allows. A Record made before a Metric was added holds no value for it and
  shows it as unanswered.
* Leaving the form with an unsaved Metric change asks `Discard changes?`, as an unsaved name or description already
  does.
* Removing a stored Metric, and changing a stored Metric's type, bounds or Choice values, are out of scope.

## 3. Technical Design

### 3.1 Domain

Nothing new. `Observation.addMetric` already keys by id and excludes the subject from its own name-collision check, and
setting an existing key on a `Map` keeps that key's position — so the one method both appends a Metric the aggregate has
not seen and replaces a renamed one where it already stands.

A rename is therefore applied by handing `addMetric` a `Metric` carrying the stored id, type and constraint with the new
name and description, rather than by assigning `metric.name` — which would bypass the uniqueness check the aggregate
owns ([ADR-4](../../adr/4-name-uniqueness-rule-placement.md)). `removeMetric` stays without a production caller.

### 3.2 Application

**`UpdateObservationUseCase`** gains a `metrics` list on its input. An entry carries an optional `id`: present for a
Metric already stored, absent for one being added. Everything else on an entry matches
`CreateObservationInput['metrics']`, so one editor component produces both shapes.

The use case loads the Observation as it does now, then walks the entries in the order the form holds them:

* **With an `id`** — hands `addMetric` a `Metric` built from that id, the stored Metric's `type` and `constraint`, and
  the submitted name and description. The submitted constraint fields are not read at all, so a caller that sent some
  cannot narrow a bound or drop a Choice value through this path. An `id` the Observation does not hold is an error.
* **Without an `id`** — builds a `Metric` under a fresh `Crypto.randomUUID()`, with the constraint its type declares.
  `toMetricConstraint` in `CreateObservationUseCase` derives that today and becomes exported, beside `toStoredText`
  which is shared already.

Entries are applied in form order and `addMetric` appends an id the aggregate has not seen, so an added Metric lands
after every stored one. The Observation's own name and description are assigned as they are now, and one
`observationRepository.update(observation)` writes the lot.

**Validation.** `validateCreateObservation` judges a submission in which every Metric is new. Split its per-Metric half
so the edit path reuses the part that applies: `metricErrors` separates into the identity checks — the name and the
description — and the constraint half it already delegates to `constraintErrors`.

`validateUpdateObservation(input, takenNames)` then sits beside `validateCreateObservation` and returns the same
`CreateObservationErrors` shape, so one card component renders either path's marks. It runs
`validateObservationIdentity` unchanged, judges an entry carrying an `id` on its identity checks alone, judges one
without an `id` exactly as creation does, and applies the same `collidingNamePositions` marking across the whole list.
Stored Metrics come first, so a new Metric colliding with one is the second of the pair and is the card that gets marked
— creation's rule, unchanged.

A stored Metric's constraint is skipped rather than judged. The form renders it read-only and never submits it, so there
is nothing to judge, and re-deriving it from typed strings would put a stored constraint through a round-trip that only
this path could corrupt.

### 3.3 Infrastructure

`ObservationRepository.update` widens from the Observation's own columns to those columns plus a `metrics` row per
Metric the aggregate holds, all in one transaction, and refuses an aggregate that has lost a Metric the table still
holds. [ADR-6](../../adr/6-observation-update-write-path.md) is rewritten for this slice and carries the reasoning; the
doc comment on `ObservationRepository.update` is rewritten with it, since it currently warns that Metrics are dropped
without a word.

`findAll`'s metric query gains `ORDER BY rowid`. Metric order is what every screen renders in and is what "an added
Metric reads last" means, and it has been resting on an unordered `SELECT` happening to return insertion order.

### 3.4 Presentation

**New shared component — `MetricEditorCard`** (`src/presentation/components`, exported from its `index.ts`): the Metric
card currently inline in `CreateObservationScreen`, lifted whole so both forms render the same editor. `MetricDraft` and
`EMPTY_METRIC` move with it, the draft gaining an optional `id`.

Props: the draft, its `MetricErrors`, the card's `index`, a change callback per editable field, the type selection, the
three value-row callbacks, an optional `onRemove`, and `locked`. An absent `onRemove` renders no delete affordance,
which is how each screen states its own rule — creation offers removal while more than one Metric is on the form,
editing offers it only on a card added in this session. The card's testIDs stay `metric-name-${index}`,
`metric-type-${index}`, `metric-min-${index}`, `metric-max-${index}` and `metric-value-${index}-${valueIndex}`, so the
creation flow keeps every handle it selects on.

`locked` replaces the type and constraint controls rather than disabling them, since a disabled control still invites
the tap it will refuse:

* **TYPE** reads `formatMetricType(metric.type)` as static text, under `metric-type-locked-${index}`. A Metric's type is
  fixed when it is defined, so there is nothing here to offer.
* **RANGE**, on a Numeric Metric, reads `formatMetricRange` of its constraint — `0-100`, `Min 0`, `Max 100`. An
  unbounded one renders nothing and leaves no gap, exactly as the Record form states the same thing ([Record Value
  Entry](../../features/record-value-entry.md)).
* **VALUES**, on a Choice Metric, lists the declared values in declaration order.
* Text and Yes/No add nothing, locked or not, as in creation.

Locked text carries no box. The bordered `surfaceContainerLowest` box is what every field a user types into wears, so a
fact wearing it too is the one thing the card must not say — and a box around something inert is the decoration
[design.md](../../project/design.md) rules out. The value sits against its own caption rather than inset to a field's
text, in `COLORS.onSurfaceVariant` rather than `onSurface`, so the card divides at a glance into what can be typed into
and what cannot.

**`CreateObservationScreen`** renders `MetricEditorCard` per draft with `locked` false. No behaviour of its own changes.

**`EditObservationScreen`** seeds a draft per stored Metric — its id, name, description, type, and its constraint spread
back into `min`/`max`/`values` for the locked display — and takes the creation form's layout: the Observation name
sticky at the top, then a scroll holding the description, the divider, the **METRICS** caption, the cards, and the
dashed **Add Metric** below them. The form is now too long for one plain scroll, and it is mirroring the screen it now
resembles.

`locked` is true for a card carrying an id and false for one added this session, and `onRemove` is supplied only for the
latter. Validation moves to `validateUpdateObservation` behind the `attemptedSave` gate the screen already has.
`isDirty` extends to the Metric list: a form is dirty when a Metric's trimmed name or description differs from what was
loaded, or when a card was added — whitespace counting as no difference, as it already does for the Observation's own
two fields.

The `beforeRemove` interception, the `Discard changes?` dialog, `Loading...`, `Not found` and the Alert of last resort
are untouched. [`design/edit-observation.html`](design/edit-observation.html) draws the screen as it stands once this
ships — three stored cards, one added this session, and the locked states of each type.

## 4. Verification

### Seed Data

None added. `mixed metrics` carries a Metric of every type and every bound shape — `dense` (0-100), `yearly` (`Min 0`),
`insufficient` (`Max 100`), the unbounded `sparse`, the Choice `category`, the Yes/No `flag` and the Text `note` — so a
single Observation puts every locked state on one form. See [testing-data.md](../../../testing-data.md).

### Manual Verification

Reseed test data first.

1. Open `mixed metrics`, ⋮ → **Edit**. Below the name and description sits **METRICS**, holding eight cards in the order
   the details screen's trend cards read, with a dashed **Add Metric** below them.
2. `dense`'s card: name and description editable; **TYPE** reads `Numeric` as static text with no chevron; the range
   reads `0-100`. `yearly` reads `Min 0`, `insufficient` reads `Max 100`, and `sparse` shows no range and no gap where
   one would be.
3. `category`'s card lists `a`, `b`, `c`, `d` in that order and offers no way to edit them; `flag`'s and `note`'s cards
   show a type and nothing beyond it. No card carries a delete affordance.
4. Rename `dense` to `density` and save. The details screen's first trend card reads `density`; **Add Record** shows
   `density` where `dense` was, still stating `0-100`; and an expanded Record under RECENT RECORDS shows a `density`
   column holding the value it held before the rename.
5. Edit again, tap **Add Metric**, name the card `caffeine`, leave it Numeric, set Min `0`, and save. On the details
   screen `caffeine`'s trend card is the last one and reads `Not enough data yet`; an expanded Record shows a `caffeine`
   column reading `-`; **Add Record** shows a `caffeine` field, last, stating `Min 0`.
6. Edit again: `caffeine` is now a stored Metric like the rest — type static, `Min 0` stated, no delete affordance.
7. Edit again, tap **Add Metric** and name the card `Density`. The save is refused with `Metric names must be unique`
   marked on the added card rather than on the stored one, and the form stays open.
8. Correct that card's name, then remove it with its delete affordance — the only card on the form carrying one. The
   form is back to what it was.
9. Add a Metric and leave with the header back arrow: `Discard changes?` appears, **Keep editing** returns with the card
   still there, and **Discard** leaves with the Observation unchanged.
10. Reload the app: every change made above survived.

### Automated Tests

* **Unit:** `validateUpdateObservation` judges an entry carrying an `id` on its name and description alone and never on
  its constraint fields, judges one without an `id` exactly as `validateCreateObservation` does, marks the second of a
  colliding pair across a list mixing both, and accepts a stored Metric keeping its own name and its own casing.
  `UpdateObservationUseCase` renames and redescribes a stored Metric while leaving its type and constraint as stored,
  appends a new Metric under a fresh id with the constraint its type declares, does both in one call, refuses an `id`
  the Observation does not hold, and still refuses a colliding Observation name.
* **Integration:** `SQLiteObservationRepository.update` round-trips a renamed Metric, an added one, and both together;
  leaves `createdAt`, every `record_values` row and every column of an untouched Metric as they were; and refuses an
  aggregate missing a stored Metric without having written anything. `findAll` returns an Observation's Metrics in
  insertion order, an added one last.
* **Component:** `MetricEditorCard` renders the full editor unlocked and the static type, range and value list locked;
  renders no range at all for an unbounded Numeric Metric; shows a delete affordance only when given `onRemove`; and
  emits each change against the index it was given.
* **Screen:** `EditObservationScreen` seeds a locked card per stored Metric holding its stored values, adds an unlocked
  removable card on **Add Metric**, marks a duplicate name on the added card after a save attempt, counts an added or
  renamed Metric as dirty, and passes stored ids through on save. `CreateObservationScreen`'s existing tests pass
  unchanged against the extracted card.

### E2E Flow

Extend `.maestro/flows/observation-editing/observation-editing.yaml`. The feature has a flow already, and this is more
steps on the same screen rather than a separate case.

* **Fixture:** `seed`, as the flow already opens with.
* **Covers:** after the existing rename and collision passes, open `mixed metrics`' edit form; assert `dense`'s card
  renders `metric-type-locked-0` and no `metric-type-0` picker; tap **Add Metric**, name the new card `caffeine`, save,
  and assert `caffeine` appears on the details screen below the Metrics that preceded it and again as a field on the
  Record form.
* **Handles:** all present. The locked type text carries `metric-type-locked-${index}`, which is what lets a flow assert
  the locked form is rendered and the picker is not — every type label is already on screen somewhere on this fixture,
  so absence cannot be asserted on the text. A locked range and value list carry `metric-range-locked-${index}` and
  `metric-values-locked-${index}` beside it. **Add Metric** matches on its label, the added card's name field on
  `metric-name-${index}` as creation's flow already does, and its delete affordance on the accessibility label `Remove
  metric ${index + 1}`. The form is long on this fixture, so reaching **Add Metric** needs the `scrollUntilVisible` the
  creation flow already uses.
