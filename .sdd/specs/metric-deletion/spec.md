# Metric Deletion

* 2026-08-28
* Feature: observation-editing.md
* [ ] Implemented
* [ ] E2E tested

## 1. Goal

An Observation declares its Metrics in the minute it is created and then asks for every one of them on every Record
form, for months. [Editing](../../features/observation-editing.md) can add a Metric but never take one away, so a Metric
that has stopped meaning anything goes on demanding an answer and holding a card in the Trends section forever. Let the
edit form remove a stored Metric, taking every value Records hold for it.

## 2. Requirements

* Every Metric card on the Observation edit form carries a delete affordance, one already stored as much as one added.
  It is withheld from every card while the form holds only one, so an Observation cannot be left with no Metric.
* A stored Metric's delete affordance is marked destructive and an added Metric's is not, so the two consequences the
  one icon now carries are told apart before it is tapped.
* Removing a card takes it off the form and does nothing else. The Observation, its Metrics and its Records are
  untouched until the form is saved.
* Saving a form that has dropped a stored Metric asks for confirmation before anything is written, naming the Metrics
  going and how many stored values go with them. Cancelling returns to the form with those cards still off and writes
  nothing.
* Confirming writes the whole save in one step — the removals alongside any rename, redescription or addition made on
  the same form. All of it lands or none of it does.
* A removed Metric and every value stored against it are gone permanently. A Record left holding no value still exists.
* A Metric name a removal frees may be taken by a Metric added in the same save.
* A removed Metric has no trend card, no field on the Record form, and no column in an expanded Record.
* Leaving the form without saving abandons every staged removal, through the `Discard changes?` question the form
  already asks.
* A screen reader reaching a card's delete affordance hears which Metric it removes.
* Narrowing a Numeric bound, and removing or renaming a Choice value, are out of scope — they strand stored values
  without removing the Metric, which is a different question. So is undoing a staged removal on the form by any route
  short of discarding it.

## 3. Technical Design

### 3.1 Domain

No change. `Observation.removeMetric` already exists, and the rule that an Observation keeps at least one Metric is
already `metricListErrors`' in `validateCreateObservation.ts`, which `validateUpdateObservation` calls — so a submitted
list holding none is refused today, with `At least one metric is required`. That refusal is the backstop; withholding
the affordance from the last card is what keeps it out of reach.

### 3.2 Application

**`UpdateObservationUseCase`** drops the guard that throws `A metric cannot be removed from an observation`. Nothing
replaces it: an id submitted for a Metric this Observation does not hold is still refused by `toMetric`'s `Metric not
found`, so a stale form cannot reach another Observation's Metric by naming it here.

**`RecordRepository`** gains `countValuesByMetricIds(metricIds: readonly string[]): Promise<number>` — the number of
stored values held across those Metrics. An empty list answers `0` without reaching the database.

A single total rather than a count per Metric: the confirmation states one number, and a map would be a second shape to
keep in step with a dialog that never shows it. What it totals is stored values rather than Records — one Record
answering two removed Metrics contributes two — which is also why the confirmation counts values rather than Records.

**`CountMetricValuesUseCase`** wraps it, as `CountRecordsUseCase` wraps `countByObservationId`.

### 3.3 Infrastructure

**`SQLiteRecordRepository.countValuesByMetricIds`** — one `SELECT COUNT(*) FROM record_values WHERE metricId IN (…)`,
its placeholders built from the list's length.

**`SQLiteObservationRepository.update`** — `refuseMetricRemoval` is replaced by the removal it refuses today. Inside the
transaction it already opens, and **before** the `UPDATE metrics SET name = id` that parks the names, it deletes the
`metrics` rows this Observation holds that the aggregate no longer does. Deleting first is what lets a Metric added on
the same save take a removed one's name: the unique index on `metrics (observationId, name COLLATE NOCASE)` is checked
as each statement runs, so a row still holding that name would refuse the insert. That ordering carries a comment saying
so, since nothing about the statements' shape says why they sit in this order, and the integration test below is what
would catch them being swapped.

The `record_values` rows go with those Metrics through the schema's own `ON DELETE CASCADE` on `record_values.metricId`
rather than through a statement of their own — the cascade ADR-6 was written to keep out of reach is now the point.

That cascade fires only under `PRAGMA foreign_keys = ON`, which `initDatabase` sets and the in-memory harness in
`SQLiteObservationRepository.indexes.test.ts` does not. The harness sets it, so what it exercises is what the app does.
Without that line the Metric rows would go, their values would be left behind, and every test here would still pass.

No index is added on `record_values (metricId)`. Both the count and the cascade scan the table for want of one — its
primary key leads with `recordId` — which is one scan of a local table on a deliberate, confirmed action, against an
index that would be maintained on every Record ever written.

[ADR-6](../../adr/6-observation-update-write-path.md) is rewritten by this slice: it is titled for this question and
holds it open today, so the answer belongs in it rather than in an ADR beside it.

### 3.4 Presentation

**`MetricEditorCard`** gains no prop, but renames one. `locked` — today's "a Metric already stored", which drives
whether the type and constraint are stated rather than offered — becomes `stored`. A second behaviour now follows from
that same fact, and `locked` names only the first of the two. `onRemove` stays what renders the delete affordance, and
the screen still decides which cards get one.

* **The bin draws in `COLORS.error` on a stored card and `COLORS.outline` on an added one.** Until this slice only added
  cards carried one, so the affordance's presence was itself the distinction between a Metric the Observation holds and
  a Metric being drafted. Now that both carry it the icon means two different things — discarding what was just typed,
  or destroying a year of Records — and nothing else on the card reliably says which, a stored Text or Yes/No Metric
  differing from an added one only in stating a type rather than offering it. Red for the destructive one is the app's
  own idiom, already carried by **Delete** in the Observation's ⋮ menu ([Observation
  Deletion](../../features/observation-deletion.md)).
* **The colour warns, it does not guard.** Nothing is prevented by it and nothing relies on seeing it: the save-time
  confirmation is what gates the destruction, and it names what is going in text. Someone who cannot tell the two bins
  apart loses the early warning and nothing else.
* Its `accessibilityLabel` names the Metric where the card holds a name (`Remove metric insufficient`) and keeps today's
  positional form (`Remove metric 5`) while the name is blank, which is how an added card starts. Naming it matters most
  on exactly the cards this slice opens up; the create form gets the same improvement with it.

**`EditObservationScreen`**:

* The `onRemove` gate becomes `metrics.length > 1`, matching `CreateObservationScreen`, in place of today's `metric.id
  === undefined`. `stored` stays keyed on `metric.id !== undefined`, and now decides the bin's colour as well as whether
  the type and constraint are stated: neither of those is what this slice makes editable.
* `metricsDiffer` already reports a shorter list as different, so a staged removal makes the form dirty and the existing
  `beforeRemove` listener asks `Discard changes?` on the way out. Its comment claiming a card added is the only way the
  two lists differ in length stops being true and goes.
* `handleSave` gains one step between validating and writing. The stored Metrics the form no longer holds are worked out
  by id against the loaded Observation; where there are none, the save proceeds exactly as it does today. Where there
  are, `CountMetricValuesUseCase` runs for their ids and the confirmation opens. The existing `saving` state covers that
  read, so the footer button carries the spinner it already has and no new loading state is invented. A count that fails
  surfaces through the same `Alert.alert` a failed save uses.
* Confirming runs the write `handleSave` runs today, unchanged — the input already carries only the Metrics the form
  holds. Cancelling closes the dialog and leaves the form exactly as it was, removals included.

**The confirmation** is the app's `Dialog`, shaped as Delete Observation's is ([Observation
Deletion](../../features/observation-deletion.md)): `Cancel` first, then a `destructive` `Delete` reading `Deleting…`
while the write is in flight, both inert meanwhile.

Its title and message come from **`metricRemovalPrompt(names: readonly string[], valueCount: number)`** in
`src/shared/`, beside `formatRecordCount` — a pure function returning a `title` and a `message`, so the singular, the
plural and the nothing-recorded case are testable without a screen.

* Title: `Delete metric?`, or `Delete metrics?` for more than one.
* Message, with values behind them: `“insufficient” will be removed, along with 1 recorded value. This cannot be
  undone.` — `45 recorded values` at any other count, and several names each quoted, joined by commas with a final
  `and`.
* Message with none: `“insufficient” will be removed. No record holds a value for it. This cannot be undone.`

Each name is wrapped in typographic double quotes so that where it ends is never in doubt: Metric names are user-typed
and routinely run to several lowercase words, and `hours slept will be removed` reads as a sentence before it reads as a
name. Quoting rather than emphasis is what keeps the message a plain string — `Dialog` renders `message` in a single
`Text`, so emphasis would mean either widening a component six dialogs share or moving the copy into the screen, out of
the one function that can be tested for it.

Counting values rather than Records is what keeps the sentence true of several Metrics at once, where the Records behind
them overlap and their total is not the sum.

## 4. Verification

### Seed Data

None added. `mixed metrics` already declares eight Metrics of every type with Records behind them, and `insufficient`
holds exactly one value however the clock stands when the seed runs — the deterministic count this slice needs in order
to assert a message against it. `no records`, holding a single Metric, is the withheld-affordance case.

A Metric with no values at all is deliberately not seeded: adding one to `mixed metrics` would shift the card positions
`observation-editing.yaml` reaches by index and the aggregated point counts `devSeedData.test.ts` asserts. It is reached
instead by adding a Metric on the form and saving it, which is what the manual checklist does.

### Manual Verification

Reseed test data first.

1. Open `mixed metrics` → ⋮ → **Edit**. Every Metric card now carries a bin beside its name, and on all eight of these
   stored cards it is red. The type, the range and the choice values are still stated as plain text rather than offered
   as controls. Tap **Add Metric**: the card it appends carries the muted grey bin the form's other icons use, plainly a
   different mark from the eight above it. Remove that added card again before going on.
2. Tap the bin on `insufficient`, the fifth card. Its card goes and nothing else on the form moves; no question is
   asked.
3. Leave by the cross → `Discard changes?` → **Discard**. Reopen **Edit**: `insufficient` is back, and so is its trend
   card.
4. Remove `insufficient` again, and rename `dense` to `density` in the same pass. **Save Observation** asks `Delete
   metric?` and reads `“insufficient” will be removed, along with 1 recorded value. This cannot be undone.`, the name in
   quotes. **Cancel**: the form is as it was, `insufficient`'s card still off and `density` still typed, and nothing has
   been written.
5. **Save Observation** again and confirm. The screen returns to the Observation: TRENDS has no `insufficient` card and
   its first card reads `density`, **Add Record** has no `insufficient` field, and an expanded Record under RECENT
   RECORDS has no `INSUFFICIENT` column while its other values read as before.
6. Reopen **Edit**, **Add Metric** named `insufficient`, and save — the freed name is accepted. Reopen **Edit**, remove
   that card, and save: the confirmation reads `“insufficient” will be removed. No record holds a value for it. This
   cannot be undone.`
7. Open `no records` → **Edit**: its single `value` card carries no bin. **Add Metric**, and both cards carry one.
8. With a screen reader, focus a stored card's bin: it announces the Metric by name rather than by position.

### Automated Tests

* **Unit:** `UpdateObservationUseCase` writes an Observation the form dropped a Metric from; refuses a submitted id
  belonging to no Metric of that Observation; refuses a list holding no Metric; and carries a removal, a rename and an
  addition through one call, the addition taking the removed Metric's name.
* **Unit:** `metricRemovalPrompt` across one name with none, one, and several values; several names each quoted and
  joined with a final `and`; and the title's singular and plural.
* **Integration:** `SQLiteObservationRepository.update`, against the real schema with foreign keys on, deletes the rows
  the aggregate dropped and leaves the rest; takes the dropped Metric's `record_values` with it while every other value
  on the same Records survives; leaves a Record that now holds no value in place; and accepts a Metric added under a
  removed one's name in that same call. `SQLiteRecordRepository.countValuesByMetricIds` counts across several ids,
  answers `0` for an id nothing was recorded against, and answers `0` for an empty list without querying.
* **Screen:** `EditObservationScreen` renders a remove affordance on a stored card and none when one card is left;
  removing a card takes it off the form without calling the use case; saving with a removal opens the confirmation
  instead of writing; cancelling writes nothing and keeps the form; confirming calls the use case once with the
  remaining Metrics; a save with no removal writes without asking; a failing count surfaces the alert.
* **Component:** `MetricEditorCard`'s remove button labels itself with the Metric's name, and falls back to its position
  while the name is blank; it draws in the error colour on a stored card and the outline colour on an added one.

### E2E Flow

A second flow in the existing folder, `flows/observation-editing/metric-removal.yaml`. `observation-editing.yaml`
already runs four passes — a rename, a refused name, a Metric rename and a Metric addition — and hanging a destructive
pass with a confirmation of its own off the end of it would leave a failure there no longer naming what broke.

* **Fixture:** `seed`.
* **Covers:** open `mixed metrics` from the list, ⋮ → Edit, remove `insufficient`, **Save Observation**, assert the
  confirmation is up, **Delete**, and land back on the Observation; then assert the Metric is gone from both places it
  showed — no `insufficient` trend card, and no `insufficient` field on **Add Record**.
* **Matching the confirmation:** on `will be removed` rather than on the quoted name, so no typographic quote goes into
  a selector. The removed card is off the form by then, so the dialog is the only thing on screen carrying that phrase.
* **Asserting an absence:** `assertNotVisible` only answers for what is rendered, so each check is anchored on `flag`,
  the Metric declared straight after `insufficient` — scroll until `flag` is on screen, then assert `insufficient` is
  not. Its card, or its field, would occupy the space immediately above.
* **Handles:** the bin's label becomes `Remove metric insufficient`, which is the handle for the removal. The
  confirmation's actions need `Cancel metric deletion` and `Confirm metric deletion` accessibility labels, matching what
  Delete Observation's carry. Nothing else on the path is new.
