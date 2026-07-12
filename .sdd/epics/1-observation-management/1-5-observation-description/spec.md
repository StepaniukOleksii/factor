# Feature Spec: Observation Description

* Date: 2026-07-12

## 1. Goal
Give users a place to record optional context about what an Observation is tracking and why, beyond its short
name. The description is captured once, at creation time, and surfaces on the Observation Details screen as
supporting context under the title. It deliberately stays off the List screen, which is optimized for scanning
many Observations at a glance.

## 2. Requirements
* [ ] `Observation` domain entity supports an optional `description` field.
* [ ] The user can optionally enter a description while creating an Observation, on the Create Observation
  screen.
* [ ] Description is limited to 150 characters; the limit is enforced both in the UI input and by the use case.
* [ ] Description is persisted alongside the Observation in local storage.
* [ ] Description is **not** displayed on the Observation List screen.
* [ ] Description **is** displayed on the Observation Details screen, as small text under the title, and only
  when non-empty.
* [ ] Editing an existing Observation's description is out of scope — there is no Observation-editing feature
  yet, so description can only be set at creation time.

## 3. Technical Design

### 3.1 Data Models
* **Observation** (`src/domain/Observation.ts`)
  * Add `description: string | null` (default `null`), following the same optional-field pattern already used
    by `Metric.constraint`.
  * Constructor becomes `constructor(id: string, name: string, metrics: Metric[] = [], description: string | null = null)`.
  * `description` is a plain mutable public field, consistent with `name` — no new methods needed.

### 3.2 Application Layer
* **`CreateObservationUseCase`** (`src/application/CreateObservationUseCase.ts`)
  * `CreateObservationInput` gains an optional `description?: string`.
  * Validation: trim the input; if the trimmed value exceeds 150 characters, throw
    `Error('Observation description cannot exceed 150 characters')`, matching the existing manual-`throw`
    validation style used for name/metrics.
  * An empty or whitespace-only description is normalized to `null` (never stored as `''`).
  * The normalized description is passed into the `Observation` constructor.
* **`ObservationRepository`** (`src/application/ObservationRepository.ts`) — no interface changes. `save` and
  `findAll` continue to operate on the full `Observation` entity, which now carries `description`.

### 3.3 Storage Layer
* **Schema** (`src/infrastructure/Database.ts`): add a nullable `description TEXT` column to the `observations`
  table.
  * `initDatabase()` only issues `CREATE TABLE IF NOT EXISTS` — there is no migration runner. Existing local
    databases already have an `observations` table without this column. Before the existing `CREATE TABLE IF
    NOT EXISTS` block, check `PRAGMA table_info(observations)` for a `description` column and run
    `ALTER TABLE observations ADD COLUMN description TEXT` if it's missing, so existing installs upgrade in
    place without data loss or a crash on startup.
* **`SQLiteObservationRepository`** (`src/infrastructure/SQLiteObservationRepository.ts`):
  * `save()`: extend the `INSERT INTO observations (...)` statement to include `description`.
  * `findAll()`: extend `ObservationRow` with `description: string | null`, select the column, and pass it into
    the `Observation` constructor.

### 3.4 User Interface
* **`CreateObservationScreen`** (`src/presentation/screens/CreateObservationScreen.tsx`):
  * Add an optional "DESCRIPTION" field below the Observation Name input, in the same sticky top section: a
    multi-line `TextInput` a few lines tall, `maxLength={150}`, placeholder like "Optional — what does this
    observation track?".
  * Show a small character counter (e.g. "42/150") below the field, styled like the existing `metricLabel`
    text, so the limit is visible before it's hit.
  * `handleSave` passes the trimmed description into `useCase.execute(...)` (omitted/empty when blank).
  * Follow the screen's existing pattern — raw `TextInput` plus local `styles` — rather than introducing a new
    shared form component; no reusable text-area component exists yet, and this is the only screen that
    currently needs one.
* **`ObservationListScreen`** (`src/presentation/screens/ObservationListScreen.tsx`): no changes — description
  is intentionally omitted from list items.
* **`ObservationDetailsScreen`** (`src/presentation/screens/ObservationDetailsScreen.tsx`):
  * Directly below `ScreenHeader` (which renders only the title) and above the "METRICS" section, render
    `observation.description` as small, muted text (e.g. `onSurfaceVariant` color, ~13-14px) when it is
    non-null and non-empty. Render nothing — no placeholder, no empty container — when there is no description.
  * `ScreenHeader` itself is not modified. It stays a generic title/back/action bar shared by other screens;
    the description block lives in the Details screen's own content instead.

## 4. Verification Plan

### Manual Verification
1. Open Create Observation, enter a name, leave Description empty, and save. Open its Details screen — confirm
   no description text appears and no empty gap is left under the title.
2. Create another Observation with a description under 150 characters. Confirm it appears as small text under
   the title on the Details screen.
3. On the Create screen, try typing more than 150 characters into Description — confirm the input stops
   accepting characters at 150 and any counter shown reads "150/150".
4. Confirm the Observation List screen shows only name, metrics, and last-record time — no description text for
   any item, regardless of whether that Observation has one.
5. Restart the app (reload) after creating Observations with and without descriptions — confirm both persist
   correctly across reload.
6. Against a database created before this change (no `description` column), confirm the app still starts
   cleanly and pre-existing Observations show no description without crashing.

### Automated Tests
* **Unit Tests:** `CreateObservationUseCase` — accepts a valid description, rejects one over 150 characters,
  normalizes an empty/whitespace-only description to `null`, and defaults to `null` when omitted.
* **Integration Tests:** `SQLiteObservationRepository` — `save()` persists `description` (including `null`),
  `findAll()` round-trips it correctly, and the column-presence upgrade path does not throw when run against a
  pre-existing `observations` table that lacks the column.
