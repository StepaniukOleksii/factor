# Observation Metadata

* 2026-08-16
* Feature: observation-viewing.md

## 1. Goal

An Observation's own screen says nothing about how long it has been kept or how much has gone into it: RECENT
RECORDS shows three tiles whether the Observation holds four Records or four hundred, and a thin-looking chart
reads the same on an Observation started last week as on one that has been neglected for a year. Show the
creation date and the total Record count on one small line under the title.

## 2. Requirements

* The Observation Details screen carries one line stating when the Observation was created and how many Records
  it holds.
* The count is every Record on the Observation, unaffected by the window the trend charts are drawn over.
* The count reads in words that fit it: `No records`, `1 record`, `12 records`.
* The line appears for every Observation. Where there is a description it sits below it, so the line rather
  than the description is what always follows the title.
* Both values are re-read whenever the screen refreshes, so a Record added or deleted moves the count without
  a second visit.
* The line appears complete or not at all — no date on screen while its count is still in flight.
* A screen reader announces the line as one phrase rather than as two fragments either side of a separator.
* Showing either value anywhere else — the Observation list included — is out of scope.

## 3. Technical Design

### 3.1 Domain

An Observation now carries the time it was created, fixed when it is created. That is a fact about the
Observation rather than bookkeeping the storage layer happens to keep, so it belongs to the entity, and
`domain-overview.md` gains a line for it among what an Observation carries.

`Observation` gains `createdAt: Date`, read-only, declared last in the constructor and defaulted to the moment
of construction so existing call sites keep working unchanged. It takes no validation — a value fixed at
construction has nothing to check. The repository stores and restores exactly what the entity carries rather
than stamping a time of its own (§3.3), which is what lets a fixture state when an Observation was created.

The Record count is deliberately *not* on the entity. An Observation does not carry its Records — nothing loads
them with it — so the count is a question for the Record repository rather than a field that would have to be
kept true.

### 3.2 Application

`RecordRepository` gains `countByObservationId(observationId: string): Promise<number>`. Neither existing read
answers it: `getRecentRecords` is capped by its `limit` and `getByObservationId` is scoped to a window, and
both hydrate every value row of everything they return — a lot of work to arrive at one integer.

`CountRecordsUseCase` — `execute(observationId: string): Promise<number>`, delegating to that method the way
`GetRecentRecordsUseCase` delegates to its own.

`GetObservationByIdUseCase` is left alone rather than widened into a `{observation, recordCount}` pair:
`RecordFormScreen` reads it too and has no use for a count.

### 3.3 Infrastructure

`SQLiteObservationRepository` carries `createdAt` in both directions: `save` writes
`observation.createdAt.getTime()` where it currently calls `Date.now()`, and `findAll` passes
`new Date(row.createdAt)` to the constructor — the column is already selected there and is already the
`ORDER BY` key. No schema change and no migration: the column exists and every stored row has a value.

`SQLiteRecordRepository.countByObservationId` is a `SELECT COUNT(*) FROM records WHERE observationId = ?`,
returning the aggregate directly — the query returns a row for an Observation with no Records, so zero needs no
special case.

**Seed data.** Each fixture is given a deliberate `createdAt` rather than being left with the default.
`buildSeedData` constructs all four Observations in one pass, so entity-stamped defaults would share a
millisecond and leave the list's `ORDER BY createdAt DESC` to break the tie — where today's per-INSERT
`Date.now()` happens to separate them. Each is backdated to before its own oldest Record: `no records` today,
`no numeric` 30 days ago, `stale records` 90, `mixed metrics` 365.

That reorders the list, which currently comes out newest-first as `no records`, `stale records`, `no numeric`,
`mixed metrics` — the reverse of the order they are inserted in — and will read `no records`, `no numeric`,
`stale records`, `mixed metrics` instead. Nothing depends on the old order, and the new one is stated by the
fixtures rather than falling out of how fast four INSERTs run.
[testing-data.md](../../../testing-data.md) gains those dates, the order they produce, and the Record counts
they pair with.

### 3.4 Presentation

`formatRecordCount(count: number): string` in `src/shared/formatRecordCount.ts`, beside the other formatters
and following their one-per-file shape. It owns the three wordings and nothing else.

The date is `createdAt.toLocaleDateString()` with no options: the device's own date format, year included,
matching how the Observation list writes `Last record:`. Not `formatRelativeTime` — a creation date is read as
a fact about the Observation rather than as a distance from now, and `Yesterday, 14:05` is neither. Not
`formatShortDate` either, which drops the year an Observation kept for two of them needs.

**`ObservationDetailsScreen`:**

* The count is fetched in `loadData`, alongside the Observation and its Recent Records, so the screen's
  existing spinner covers it and the line is never drawn half-populated. It follows them wherever they are
  refreshed: the focus effect, and the in-screen Record deletion that reloads without leaving the screen.
* One `Text` directly under the description — or under the title where there is none — reading
  `Created <date> · <count>`. Styled as the list card's own metadata line is (12px,
  `COLORS.onSurfaceVariant` at 0.7 opacity), so the same class of information reads the same on both screens.
* Its `accessibilityLabel` is the same line with the separator written as a comma, so the middle dot is not
  what a screen reader has to make sense of.
* The 24px gap that separated the description from the first section moves to this line; the description keeps
  a small gap to the line below it. Nothing else on the screen moves.

This makes the metadata line, not the description, what always sits under the title.
[Observation Viewing](../../features/observation-viewing.md) currently says the sections start straight under
the title where an Observation has no description, and this slice deliberately changes that.

The screen it produces is [design/observation-details.html](design/observation-details.html).

## 4. Verification

### Seed Data

The creation dates in §3.3 — no new Observation, Metric or Record. The existing fixtures already cover every
display state the line has: `no records` holds none, `stale records` four, `no numeric` five, and
`mixed metrics` eighty-odd. Only the singular has no fixture, and it is reached by hand in the walk below.

### Manual Verification

Reseed test data first.

1. Open `stale records`: under its description, a line reading `Created` with a date about three months old,
   then `4 records`. The date is in the same format the list writes its `Last record:` in.
2. Open `no numeric`: `Created` a month back, and `5 records`.
3. Open `mixed metrics`: `Created` about a year back, and a count in the eighties — 82, or 81 when the hour
   the reseed ran at put one of `hourly`'s sub-day Records on an 09:00 that already held one.
4. Open `no records`: `Created` today, and `No records` — with RECENT RECORDS reading its own `No records yet.`
   below, the two saying different things in different places rather than one being mistaken for the other.
   No description sits above the line, and no gap is left where one would be.
5. Still on `no records`, add a Record and come back: the line reads `1 record`. Long-press it and delete it
   without leaving the screen: the line returns to `No records`.
6. Back on the list, the four Observations read newest-created first in the order their fixture dates now fix:
   `no records`, `no numeric`, `stale records`, `mixed metrics`.

### Automated Tests

* **Unit:** `Observation` defaults `createdAt` to construction time and keeps a value it is given, and the
  field cannot be reassigned. `formatRecordCount` at 0, 1 and many. `CountRecordsUseCase` returns what the
  repository counted.
* **Integration:** `SQLiteObservationRepository` round-trips `createdAt`, a backdated one included, and
  `findAll` still returns newest-created first. `SQLiteRecordRepository.countByObservationId` counts only its
  own Observation's Records and returns 0 for one with none.
* **Seed:** `devSeedData.test.ts` — each fixture's `createdAt` is distinct, earlier than that fixture's oldest
  Record, and puts the four in the newest-first order §3.3 states.
* **Screen:** `ObservationDetailsScreen` shows the line with the count the use case returned; places it under a
  description where there is one and under the title where there is none; reads `No records` for an Observation
  with none while RECENT RECORDS shows its own empty text; and re-reads the count after an in-screen Record
  deletion.

### E2E Flow

Extend `.maestro/flows/observation-viewing/observation-viewing.yaml`. The feature has a flow already, and this
is one more line on a screen that flow already opens twice.

* **Fixture:** `seed`, which it already opens from.
* **Covers, newly:** the line on the two Observations the flow already visits — `Created .*4 records` on
  `stale records`, and `Created .*No records` on `no records`. The second is also what tells the line's empty
  wording apart from the `No records yet.` sitting below it, which no assertion on `No records` alone could do.
  Reaching across the `·` with `.*` keeps both assertions off the device's date format.
* **Handles:** none new — the line is a platform `Text`, and its text is the assertion.
