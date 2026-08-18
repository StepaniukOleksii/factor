# Observation Editing

* 2026-08-16
* Feature: observation-editing.md (new)

## 1. Goal

An Observation's name and description are fixed at the moment it is created. A name typed in haste, or a
purpose that has since sharpened into something the old wording no longer describes, can only be corrected by
deleting the Observation — which takes every Record ever made against it. Give the Observation an **Edit**
action that reopens its name and description, pre-filled with what is stored.

## 2. Requirements

* The Observation screen's ⋮ menu holds **Edit** above **Delete**.
  [Observation Viewing](../../features/observation-viewing.md) states that the menu holds Delete alone; this
  slice changes that.
* Choosing Edit opens a form holding the Observation's stored name and description, and nothing else. Its
  Metrics are neither shown nor editable — adding, removing, renaming or re-bounding one stays out of reach.
* Both fields behave as [Observation Creation](../../features/observation-creation.md)'s do: the same limits
  enforced as they are typed, the same counters, and nothing marked until the first save attempt.
* A name is refused when it is empty, over its limit, or the same as **another** Observation's. The
  Observation's own stored name never collides with itself, so saving it unchanged — or changing only its
  casing or the whitespace around it — is accepted.
* Saving writes the name and description together and the Observation keeps its identity: the same Metrics,
  the same Records, and the same place in the list's order. A description cleared in the form is cleared on
  the Observation.
* Saving returns to the Observation, whose header carries the new name; the Observation list carries it too.
* Leaving a changed form asks before discarding, the way [Record Editing](../../features/record-editing.md)
  does. Leaving an unchanged one asks nothing.

## 3. Technical Design

The domain is untouched. `Observation.name` and `description` are already mutable public fields, and the
aggregate's Metric-name invariant is not reachable from a form that shows no Metric.

### 3.1 Application

**The name and description rules move into a shared validator.** `validateCreateObservation.ts` gains
`validateObservationIdentity(name, description, takenNames)` returning `ObservationIdentityErrors` —
`{name?, description?}` — holding what is currently inline in `validateCreateObservation`: the name's
emptiness, length and collision checks, and the description's length check.
`CreateObservationErrors` extends that interface, and `validateCreateObservation` delegates to it, so
creation's behaviour and error shape are unchanged. The collision rule therefore stays single-sourced across
both write paths, which is what [ADR-4](../../adr/4-name-uniqueness-rule-placement.md) planned for when it
made `takenNames` a parameter rather than something the validator fetches.

**`UpdateObservationUseCase`** — input `{observationId: string, name: string, description?: string}`. It reads
`ObservationRepository.findAll`, finds the subject by id and throws `Error('Observation not found')` when
there is none, matching how `UpdateRecordUseCase` reports the same case. It validates against every *other*
Observation's name — the subject's own excluded by id, not by name, so a casing correction is not refused
against itself — throws `firstErrorMessage`'s message if anything is wrong, assigns the trimmed name and the
normalized description, and calls `ObservationRepository.update`.

`toStoredText` — which turns a blank description into `null` — is exported from `CreateObservationUseCase.ts`
and reused rather than copied; one exported helper is cheaper than a module for four lines, and the two use
cases must agree about what an empty description stores or the same field would read back differently
depending on which path wrote it.

**`ObservationRepository`** gains `update(observation: Observation): Promise<void>`, writing the
Observation's own columns and never its Metrics. [ADR-6](../../adr/6-observation-update-write-path.md) records
why the existing insert-only `save` was not widened instead, and its doc comment carries the warning that a
changed Metric list is ignored.

### 3.2 Infrastructure

`SQLiteObservationRepository.update` runs a single
`UPDATE observations SET name = ?, description = ? WHERE id = ?`. No transaction — one statement is already
atomic — and `createdAt` is deliberately not in the `SET` list, since it is what orders the list and a rename
is not a re-creation. A row that no longer exists updates nothing and reports nothing; the use case has
already established the Observation exists, and the screens treat a vanished Observation as `Not found`
rather than as a failed write.

### 3.3 Presentation

**Route.** `EditObservation: {observationId: string}` joins `RootStackParamList` and is registered in
`AppNavigator`. It is pushed only from the Observation screen, so `goBack` from it always lands there.

**New screen — `EditObservationScreen`** (`src/presentation/screens/EditObservationScreen.tsx`). Its own
screen rather than a second route onto `CreateObservationScreen`, which the Record form's two routes might
suggest: the create screen is mostly Metric editors, and a form that shows no Metric would branch around all
of it for nothing shared but two text fields. When metric editing is picked up the two screens converge and
the question is worth reopening — the backlog entry for that slice says so.

* **One load, on mount, keyed on `observationId`:** a single `repository.findAll()` supplies both the subject
  (picked out by id) and the names to compare against (every other entry). Reading the table once rather than
  going through `GetObservationByIdUseCase` *and* a second `findAll` for the names, which is what the two
  reads would amount to — `CreateObservationScreen` already takes its names straight from the repository this
  way. A failed load leaves the screen in its `Not found` state; the use case refuses a bad save regardless.
* **State:** the loaded `Observation`, the `name` and `description` being edited, the other Observations'
  names, `attemptedSave`, `saving`, `loading`, and the intercepted exit.
* **Marks are withheld until the first save attempt** and answer to what is on screen from then on — the rule
  and the mechanism `CreateObservationScreen` already uses, down to sharing its `NOTHING_MARKED` shape.
* **A stored description longer than the limit is marked like any other.** Only a writer bypassing the app can
  produce one — the dev seed does, on `mixed metrics` — and the form judges what it holds rather than what the
  user typed, so the save is refused until the field is shortened. Deliberate: the alternative is a form that
  saves a value it has just told the user is too long.
* **Header:** `ScreenHeader` titled `Edit Observation`, with the back arrow and a cross for abandoning the
  edit (`accessibilityLabel` `Cancel editing`), as the Record form's edit route carries.
* **Fields:** two `LabeledTextField`s — `OBSERVATION NAME` and `DESCRIPTION` — with the limits, counters,
  placeholders and multiline shape Creation gives them. Neither is sticky: with only two fields there is
  nothing for the name to stay in place above. They sit in a `ScrollView` inside a `KeyboardAvoidingView`,
  reserving `useFooterClearance()`, so the description stays reachable on a short screen with the keyboard up.
* **Footer:** `FooterBar` holding a `PrimaryActionButton` labelled **Save Observation**, `loading` while the
  write is in flight.
* **Saving** records the attempt, returns if anything is marked, runs the use case, and pops. What no field
  can hold — the write failing, or the Observation having been deleted meanwhile — surfaces through
  `Alert.alert`, as creation's does.
* **The discard guard** is `RecordFormScreen`'s, reused rather than reinvented: a `beforeRemove` listener on
  the `navigation` prop covers the header arrow, the cross, the hardware button and the back gesture at once,
  and a `leavingAfterSave` ref lets the save's own pop through. The comparison is against the loaded
  Observation, trimmed on both sides so that trailing whitespace which would save nothing does not count as a
  change, and against `''` for a stored `null` description. The `Dialog` reads `Discard changes?` /
  `The changes you made to this observation will be lost.` with **Keep editing** and a destructive
  **Discard**.
* **States:** `Loading...` with a spinner while the load is in flight, and `Not found` /
  `Observation not found.` for an Observation that is gone — the pair every other screen shows.

**`ObservationDetailsScreen`** — the ⋮ menu gains **Edit** above Delete: an `edit` icon and ordinary
`onSurface` text (a new `menuItemText` style beside the existing `menuItemTextDestructive`), labelled
`Edit observation` for the same reason `Delete observation` is. Choosing it closes the menu and navigates.
Non-destructive first, which is the order the Record actions dialog already puts the same pair in. Nothing
else on the screen changes: it re-reads on focus, so the renamed Observation is in its header on return, and
the list does the same.

**Mockups:** [the edit form](design/edit-observation.html) and
[the menu it is reached from](design/observation-menu.html).

## 4. Verification

### Seed Data

None. The seeded set already carries what this needs: `mixed metrics`, `no numeric` and `stale records` have
descriptions and `no records` has none, and four names to collide against.

### Manual Verification

Reseed test data first.

1. Open `no records` and tap ⋮: **Edit** sits above **Delete**, in ordinary text against Delete's red.
2. Tap Edit: the header reads `Edit Observation`, the name field holds `no records` with `10/30` beneath it,
   the description is empty at `0/150`, and no Metric appears anywhere on the screen.
3. Replace the name with `renamed` and tap **Save Observation**: back on the Observation, whose header now
   reads `renamed`. Back once more — the list row does too, in the same position it held before.
4. Reopen ⋮ → Edit, clear the name, and save: `Observation name cannot be empty` marks the field, and nothing
   was marked before that attempt. Type a single character — the mark clears as the field is corrected.
5. Restore `renamed`, then type `STALE RECORDS` over it and save: `An observation with this name already
   exists`, and the screen stays open.
6. Correct it to `Renamed` — its own name, cased differently — and save: accepted.
7. Open `stale records` → ⋮ → Edit, add a sentence to the description, and press back: `Discard changes?`.
   **Keep editing** returns to the form with the sentence still in it; **Discard** leaves without saving, and
   the Observation's description is as it was.
8. Open Edit again and leave without touching anything: nothing is asked.
9. Open `stale records` → Edit, clear the description entirely and save: the Observation screen shows no
   description and leaves no gap where one was.
10. Open `mixed metrics` → Edit: its seeded description is longer than a user could type, so the counter reads
    past `150/150`. Saving marks it, and shortening the field clears the mark and lets the save through.
11. Reload the app: every name and description set above survived, and each Observation still holds its
    Metrics and its Records.

### Automated Tests

* **Unit:** `validateObservationIdentity` rejects an empty name, one past 30 characters, one colliding with a
  passed name under name identity, and a description past 150; accepts a name absent from the list it was
  given. `validateCreateObservation`'s existing tests stand unchanged, which is what proves the extraction
  moved the rules rather than altering them.
* **Unit:** `UpdateObservationUseCase` writes a new name and description; trims both; stores a blank
  description as `null`; accepts the subject's own name unchanged and its casing changed; refuses a name
  another Observation holds; refuses an empty and an over-long one; throws for an unknown `observationId`; and
  hands `update` an aggregate whose Metric list is exactly the one it loaded.
* **Integration:** `SQLiteObservationRepository.update` round-trips name and description including `null`,
  leaves `createdAt`, the Observation's `metrics` rows and its Records untouched, and changes no other
  Observation's row.
* **Screen:** `EditObservationScreen` pre-fills from the stored Observation; renders no Metric editor;
  marks nothing before the first save attempt and marks the name after it; saves through the use case and
  pops; renders `Not found` for a missing Observation; asks before leaving a changed form and leaves an
  unchanged one without asking.
* **Screen:** `ObservationDetailsScreen` renders Edit above Delete in the ⋮ menu, and navigates to
  `EditObservation` with the Observation's id.

### E2E Flow

A new flow, `flows/observation-editing/observation-editing.yaml` — this is the capability's first slice, so
the folder does not exist yet.

* **Fixture:** `seed`.
* **Covers:** open `no records` from the list, ⋮ → Edit, replace the name, **Save Observation**, and assert
  the Observation's header carries the new name and the list row does too. Then ⋮ → Edit again, type
  `stale records` over it, save, and assert the collision is marked with the form still up — the one refusal
  worth an emulator, since it is the only rule whose input comes from outside the screen.
* **Handles:** the menu's Edit item needs an `accessibilityLabel` (`Edit observation`), matching the Delete
  item's. Everything else on the path is reachable by visible text: the button labels, the header, and the
  pre-filled name field, which is tapped by the text it holds.
