# Name Uniqueness

* 2026-08-10

## 1. Goal

Nothing stops two Observations from taking the same name, or two Metrics on one Observation from doing the
same. A name is the only thing that tells either apart in the interface: a list card carries the name, up to
three Metric chips and a last-record time — [Observation Description](../1-5-observation-description/spec.md)
deliberately keeps the description off it — and the Details and Record Form headers are the bare name, so two
Observations called `Sleep` stand one row above the other with nothing to choose between them. Two Metrics
sharing a name are worse still: they sit side by side on one Record form, and their trend cards carry the same
title.

Require an Observation's name to be unique among Observations, and a Metric's name to be unique within its
Observation.

## 2. Requirements

* Two Observations cannot hold the same name. Names are compared ignoring case and surrounding whitespace; the
  casing the user typed is what gets stored.
* Two Metrics on one Observation cannot hold the same name, compared the same way. Metrics on different
  Observations are unrelated and may share one.
* Names differing in anything beyond case and surrounding whitespace are distinct — interior spacing and
  accented characters included.
* Each refusal marks the field holding the offending name on the Create Observation screen, alongside the rules
  already marked there.
* Deleting an Observation frees its name for reuse.
* Storage refuses a colliding write whatever path it arrives through, not only the Create Observation screen.
* Editing an existing name is out of scope — no Observation- or Metric-editing feature exists, so both rules
  bind only where a name is first entered.

## 3. Technical Design

### 3.1 Domain

Unchanged. Neither rule can be an invariant of `Observation`. One compares against Observations the entity has
no knowledge of; and both would be bypassed on every load, since reconstructing an entity from storage does not
pass through the behaviour that creates one — the objection
[ADR-3](../../../adr/3-record-metric-value-requirements.md) raises against its own alternative 2, and it applies
here unchanged.

### 3.2 Application

`validateCreateObservation` gains a second parameter carrying the names of the Observations that already exist.
It stays pure and synchronous, because the Create Observation screen calls it on every render and reading
storage from it would put a query behind every keystroke. The parameter is required rather than optional, so
that the compiler rather than review is what stops a caller from silently skipping the rule; both call sites
have the names to hand.

* **Observation name** — compared trimmed and lower-cased against each supplied name, likewise trimmed and
  lower-cased. A collision reports `'An observation with this name already exists'` in `errors.name`, the slot
  the empty and over-length rules already write to, so `firstErrorMessage`'s precedence needs no change. A blank
  name is left to the empty-name rule rather than compared against anything.
* **Metric names** — a cross-Metric rule, so it cannot live in the per-Metric pass `perMetric` is built from. A
  second pass over the built list marks every Metric whose name collides with an earlier one, writing
  `'Metric names must be unique'` into its `name` slot and leaving the first occurrence unmarked: the first is
  the one being kept, and marking it too would fault a name that is sound on its own. Blank names are skipped,
  so two empty rows report the empty-name rule instead of reporting each other, and a name already carrying an
  error keeps it, since a name too long to accept has a problem of its own to fix first.

The two messages are worded differently on purpose. One names a conflict with something outside the form, which
the user cannot see and has to be told about; the other names a conflict between two fields both on screen.

`CreateObservationUseCase.execute` reads the existing names through `ObservationRepository.findAll` before
validating, and passes them in. It fetches rather than trusting a list handed to it, because it is the layer
that decides whether a write is legitimate. `findAll` rather than a narrower repository method: it is already
the only read the interface offers, and this is a local database holding a handful of Observations.

`ObservationRepository` gains no methods.

### 3.3 Infrastructure

Two unique indexes in `Database.ts`, declared beside the `CREATE TABLE` statements: one over
`observations (name COLLATE NOCASE)`, one over `metrics (observationId, name COLLATE NOCASE)`. Indexes rather
than `COLLATE NOCASE` on the columns themselves, which would quietly make every other comparison against those
columns case-insensitive too.

`NOCASE` folds ASCII letters only, where the application rule folds by JavaScript's own case rules — so the
index accepts every name pair the application rule accepts, and some it does not. That direction is what makes
the backstop safe: it can never refuse a name the Create Observation screen has just told the user is fine.
Trimming needs no counterpart, since names are trimmed before they reach the insert.

A colliding insert therefore surfaces as SQLite's own constraint error, untranslated. By the argument above the
path is unreachable from the UI, and the writer it can genuinely catch is a dev fixture — where the index's own
name is more use than a friendly sentence.

No migration runner is added, and a database created before this change must be wiped rather than upgraded, for
the reasons [Observation Description](../1-5-observation-description/spec.md) §3.3 gives. The wipe also disposes
of any database already holding duplicates, which no index could be added over.

`SQLiteObservationRepository` is unchanged. So is the seeded fixture, which already satisfies both rules: its
four Observation names are distinct, as are the Metric names within each.

### 3.4 Presentation

`CreateObservationScreen` loads the existing names once on mount, holds them in state, and passes them into
`validateCreateObservation` on every render. On mount rather than on focus: the screen is pushed above the list
and nothing that creates an Observation can open above it, which is the condition
[ADR-2](../../../adr/2-navigation-foundation.md) puts on refreshing on focus. A failed load logs and leaves the
list empty, as `ObservationListScreen` does for its own — the use case still refuses the save.

Nothing else on the screen changes. Both messages arrive in slots `LabeledTextField` already renders, and the
screen already withholds every mark until a save has been attempted and clears each as its field is fixed.

One consequence to record while it is being introduced: until the names have loaded, the use case can refuse a
save that the fields did not mark, which reaches the existing `Alert` in `handleSave`'s `catch`. That is a race
the user has to beat a local query to reach, so it is left as the fallback rather than paid for with a disabled
button. The comment there — asserting that anything the use case refuses is the save failing rather than
something a field could have shown — stops being true and needs rewording.

## 4. Verification

### Seed Data

None, and none is possible: a fixture carrying a collision is exactly what §3.3's indexes refuse to insert. The
existing dataset verifies the other direction — that both indexes accept legitimate data — and every refusal is
reached from the Create Observation screen.

### Manual Verification

Clear the app's storage first, since the indexes are new and there is no in-place upgrade, then reseed.

1. Create an Observation named `No Records` with one Metric. The save is refused and OBSERVATION NAME is marked
   "An observation with this name already exists" — matching the seeded `no records` despite the casing.
2. Change the name to `no records 2`: the mark clears as it is typed, and the save goes through.
3. Create another Observation with two Metrics both named `Hours`. The second METRIC NAME is marked "Metric
   names must be unique" and the first is not. Rename the second to `Minutes` and the save goes through.
4. Create a third Observation with a Metric named `hours`: accepted, since the rule binds within an Observation
   rather than across them.
5. Delete the Observation from step 2, then create it again under the same name: accepted.
6. Reseed test data: it completes, so neither index fights the fixture.

### Automated Tests

* **Unit — `validateCreateObservation`:** reports the Observation-name collision against an existing name
  differing only in case or surrounding whitespace, and nothing against a distinct one; leaves a blank name to
  the empty-name rule; marks every Metric after the first of a colliding group and not the first; skips blank
  Metric names; leaves an existing Metric-name error in place; `firstErrorMessage` reports each message in the
  precedence already defined.
* **Unit — `CreateObservationUseCase`:** reads the existing names before validating and refuses a colliding
  Observation; accepts a distinct one; refuses two Metrics colliding inside the submitted Observation; accepts a
  Metric name already used on a different Observation.
* **Integration — `SQLiteObservationRepository`:** `save` rejects a second Observation whose name differs from a
  stored one only in case; rejects two Metrics on one Observation whose names differ only in case; accepts the
  same Metric name on two different Observations.
* **Screen — `CreateObservationScreen`:** marks OBSERVATION NAME after an attempted save against a loaded
  existing name and clears it as the field is edited; marks the second of two identically-named Metrics and not
  the first; stays usable when the name load fails.
* **E2E:** `.maestro/1-6-name-uniqueness.yaml`, on the `seed` fixture — entering an existing Observation's name
  on the Create screen, seeing the field refuse it, and correcting it to save. The Metric half stays in the
  screen test: one representative pass per feature, per
  [testing-android-e2e.md](../../../../testing-android-e2e.md), and the Observation half is the one that
  exercises stored data.
