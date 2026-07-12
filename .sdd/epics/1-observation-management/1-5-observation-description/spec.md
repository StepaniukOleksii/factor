# Feature Spec: Observation Description

* Date: 2026-07-12

## 1. Goal
Give users a place to record optional context about what an Observation is tracking and why, beyond its short
name. The description is captured once, at creation time, and surfaces on the Observation Details screen as
supporting context under the title. It deliberately stays off the List screen, which is optimized for scanning
many Observations at a glance.

## 2. Requirements
* [x] `Observation` domain entity supports an optional `description` field.
* [x] The user can optionally enter a description while creating an Observation, on the Create Observation
  screen.
* [x] Description is limited to 150 characters; the limit is enforced both in the UI input and by the use case.
* [x] Description is persisted alongside the Observation in local storage.
* [x] Description is **not** displayed on the Observation List screen.
* [x] Description **is** displayed on the Observation Details screen, as small text under the title, and only
  when non-empty.
* [x] Editing an existing Observation's description is out of scope — there is no Observation-editing feature
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
  table's `CREATE TABLE IF NOT EXISTS` definition.
  * No migration runner is added. The app is pre-production with no data worth preserving, so upgrading an
    existing schema in place is out of scope. Any local database created before this change must simply be
    removed (uninstall the app or clear its storage) so `initDatabase()` recreates it fresh with the new
    column. Note that reseeding does **not** heal an old database: `reseedDevData()` begins with `findAll()`,
    which selects `description` and would throw against the old schema before it could wipe anything.
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

> Seeded data (via **Reseed test data**, see `testing-data.md`) already covers the display side: the
> `mixed metrics` observation carries a description, while `stale records` and `no records` deliberately
> have none. Scenarios 1, 2 and 4 can be checked against those without manual entry; scenario 3 still needs
> the Create screen because it exercises the input limit itself.

### Manual Verification
1. Open Create Observation, enter a name, leave Description empty, and save. Open its Details screen — confirm
   no description text appears and no empty gap is left under the title. (Also verifiable on the seeded
   `stale records` / `no records` details screens.)
2. Create another Observation with a description under 150 characters. Confirm it appears as small text under
   the title on the Details screen. (Also verifiable on the seeded `mixed metrics` details screen.)
3. On the Create screen, try typing more than 150 characters into Description — confirm the input stops
   accepting characters at 150 and any counter shown reads "150/150".
4. Confirm the Observation List screen shows only name, metrics, and last-record time — no description text for
   any item, regardless of whether that Observation has one. (Reseed test data to have both kinds present.)
5. Restart the app (reload) after creating Observations with and without descriptions — confirm both persist
   correctly across reload.
6. If a database created before this change exists on the device, remove the app's data (uninstall or clear
   storage) so it is recreated fresh — no in-place upgrade is provided.

### Automated Tests
* **Unit Tests:** `CreateObservationUseCase` — accepts a valid description, rejects one over 150 characters,
  normalizes an empty/whitespace-only description to `null`, and defaults to `null` when omitted.
* **Integration Tests:** `SQLiteObservationRepository` — `save()` persists `description` (including `null`)
  and `findAll()` round-trips it correctly.
