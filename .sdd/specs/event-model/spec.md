# Event Model

* 2026-09-06
* Feature: none — this slice adds no user action, so its feature stage rewrites `domain-overview.md` instead (see 3.6)
* [ ] Implemented
* [n/a] E2E tested

## 1. Goal

The domain has always said an Event is how a user notes something that may have influenced their Observations, and the
app has never been able to hold one: [Event.ts](../../../src/domain/Event.ts) describes a shape nothing stores, nothing
reads and nothing shows. Everything Events are wanted for — markers across an Observation's trend charts, the context
behind a dip, a Metric's values during a stretch against its values the rest of the time — needs an Event to exist and
be readable before any of it can be specified.

Give Events a settled shape and somewhere to live: the domain model, an `events` table, and a repository that writes and
reads them.

## 2. Requirements

* An Event carries a name, an optional description and the moment it occurred. It holds no list of times and belongs to
  no Observation.
* Event names are not unique: two Events may carry the same name.
* An Event's moment is a single instant, with no end and no duration.
* Stored Events survive a restart and are read back most recently occurred first.
* Adding Events changes nothing about how Observations, Metrics and Records are stored or read.
* The dev seed inserts a fixed set of Events, and clearing dev data removes them.
* This slice ends at the repository. Nothing creates, shows, edits or deletes an Event through the app, and no screen or
  navigation changes.

## 3. Technical Design

### 3.1 Domain

`Event` (`src/domain/Event.ts`) is rewritten. It keeps `Entity<string>` and its `name`, and loses `_timestamps`,
`recordOccurrence` and `removeOccurrence`: an Event is one happening rather than a kind of thing that recurs, so it
carries the one moment it occurred rather than every time it did. It gains `description: string | null` and `occurredAt:
Date`.

Constructor order is `(id, name, occurredAt, description = null)`. An Event without a moment says nothing, so
`occurredAt` sits among the required arguments rather than the defaulted one, and it is mutable, because correcting when
something happened is an ordinary edit.

There is no `createdAt`. `Record` is the precedent here rather than `Observation`: it stores when the thing happened and
not when it was entered, and nothing would read an Event's.

The class validates nothing, following `Observation`: what a user may enter is checked where their input arrives, not in
the domain.

`validationLimits.ts` gains `EVENT_NAME_MAX_LENGTH = 30` and `EVENT_DESCRIPTION_MAX_LENGTH = 150`, matching
`Observation`'s. An Event's name does the same job an Observation's does — a summary read in a list and, later, on a
chart marker — and its description is the same prose. Nothing reads either constant in this slice; the file is where the
model's limits are declared, and the use case that enforces them arrives with the form (3.5).

`Event.test.ts` is rewritten with the class: every test in it covers the removed API.

### 3.2 Application

`EventRepository` (`src/application/EventRepository.ts`) declares `save(event)`, `findAll()` and `delete(id)`.

Three methods and no more. `findAll` is what the list slice reads; `delete` is what the seed's reset needs (3.4). A
range query — which the chart overlay will want — lands with the overlay rather than sitting here uncalled.

No use case. `CreateEventUseCase` and its siblings arrive with the screens that call them, so nothing ships without a
caller, and that is where the two length limits are enforced, following `validateCreateObservation`.

### 3.3 Infrastructure

An `events` table joins `SCHEMA` in [Database.ts](../../../src/infrastructure/Database.ts): `id` as the text primary
key, `name TEXT NOT NULL`, a nullable `description TEXT`, and `occurredAt` as a non-null integer holding epoch
milliseconds, as `records.timestamp` already does.

No unique index on `name` — the two indexes already in `SCHEMA` back uniqueness rules, and Event names carry none. No
index on `occurredAt` either: `records.timestamp` is both range-queried and ordered without one, and Events will always
be fewer.

No foreign key, because an Event belongs to nothing. That also means nothing deletes an Event on its behalf: unlike a
Metric or a Record, it has no owner to cascade from.

`SCHEMA` is edited in place. Nothing is in production, so there is no migration to write and no upgrade path to keep.

`SQLiteEventRepository` (`src/infrastructure/`) implements the interface following
[SQLiteObservationRepository](../../../src/infrastructure/SQLiteObservationRepository.ts): a row interface,
`getDatabase()` per call, `runAsync` for writes and `getAllAsync` for reads. `save` writes one row to one table, so it
needs no transaction — the transaction there wraps a write across two. `findAll` orders by `occurredAt DESC`.

### 3.4 Seed

Four Events, built by a `buildEventSeedData()` exported from `devSeedData.ts` beside `buildSeedData`, named in that
file's established style — short, lowercase, describing the scenario rather than reading like something a user typed:

| Name        | Occurred          | Description                         |
|-------------|-------------------|-------------------------------------|
| `today`     | a few hours back  | near `EVENT_DESCRIPTION_MAX_LENGTH` |
| `this week` | three days back   | none                                |
| `repeated`  | three weeks back  | none                                |
| `repeated`  | eight months back | a short one                         |

Between them they cover both description states, two Events sharing a name so nothing downstream can assume uniqueness,
and one Event inside each of the four preset chart windows — so the overlay slice has a marker to draw at 1D, 1W, 1M and
1Y without the fixtures being touched again.

They follow the rule the Record fixtures already follow: offsets from now rather than absolute times, reusing that
file's existing anchor so no Event is dated past the current instant.

In `devSeed.ts`, `reseedDevData` saves them after the Observations, and `clearDevData` deletes every stored Event as it
deletes every Observation — nothing cascades to an Event, so the reset has to remove them itself.

[testing-data.md](../../../testing-data.md) is deliberately not updated here. It describes what a tester can verify by
hand, and nothing shows an Event until a screen does; the write-up belongs to the slice that adds one.

### 3.5 Deliberately not in this slice

Tags and any grouping of Events, spans, marker colour, and every screen and navigation change. The capabilities beyond
this slice are held in [backlog-feat.md](../../backlog/backlog-feat.md) item 4; where Events live in the navigation
stack is still open, and blocks the listing slice rather than this one.

### 3.6 What the feature stage rewrites

There is no feature file. `development-process.md` names a feature for a user action, and this slice delivers none.

The feature stage instead rewrites the Event section of [domain-overview.md](../../project/domain-overview.md), which
still describes the model this slice replaces: that Events "may occur multiple times" and that each "maintains the
timestamps at which it occurred". Its closing sentence — that a Record carrying a timestamp and no values is the closest
a user can express today — stays true, since this slice adds no way to note an Event. The Group paragraph beside it is
untouched.

## 4. Verification

### Seed Data

The four Events of 3.4. Nothing already seeded needs changing.

### Manual Verification

1. Reseed test data from the dev menu. The log reports the Events seeded, and no error.
2. Reseed a second time. Still no error and no primary-key collision, so the clear removed the previous Events rather
   than leaving them behind.
3. Kill and relaunch. The Observation list is unchanged, and nothing about Events appears anywhere on screen.

### Automated Tests

* **Unit:** `Event` keeps the moment it is constructed with, defaults `description` to `null`, and equals another Event
  by id alone. The existing sorting, add and remove tests go with the API they cover.
* **Integration:** `SQLiteEventRepository` round-trips an Event including a null description; `findAll` returns most
  recently occurred first and an empty array on an empty table; `delete` removes one Event and leaves the rest.
  Following `SQLiteRecordRepository.test.ts`'s mocked `getDatabase` setup.
* **Seed:** `buildEventSeedData` returns the four fixtures, none of them dated in the future, one falling inside each
  preset window, and two sharing a name. Extending `devSeedData.test.ts`.
