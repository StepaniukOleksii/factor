# Metric Order

* 2026-09-01
* Feature: metric-ordering.md (new)
* [x] Implemented
* [ ] E2E tested

## 1. Goal

An Observation's Metrics read in the order they were declared, everywhere they are shown — the trend cards, the Record
form's fields, the columns of an expanded Record. That order is fixed as each Metric is added and nothing can change it:
one added a month later reads last however central it is to the Observation, and one entered in the wrong place stays
there for as long as the Observation does. The Record form is where it costs most, being worked down in that order every
time a Record is entered. Let the user set that order while creating an Observation, and change it afterwards, by moving
a Metric card up or down the form.

## 2. Requirements

* An Observation's Metrics carry an explicit stored order, and it is the order they read in everywhere Metrics are
  shown: the trend cards ([Trend Charting](../../features/trend-charting.md)), the Record form's fields ([Record Value
  Entry](../../features/record-value-entry.md)), an expanded Record's columns ([Record
  Listing](../../features/record-listing.md)), and the Observation form itself.
* A Metric card on the New Observation form and on the Edit Observation form moves one position up or one position down.
  The first card does not move up, the last does not move down, and a form holding a single card offers no move at all.
* A card carries what was typed into it, and any mark against it, as it moves.
* A move on the Edit Observation form is staged like every other edit there: written by **Save Observation**, abandoned
  by **Discard**, and counted as a change by the prompt that asks.
* A move needs no confirmation and reaches no Record. No stored value is touched, moved or destroyed.
* A Metric added to either form still lands at the end, and moves from there like any other.
* A screen reader reaches both moves, hears which Metric each one moves and in which direction, and hears a move that
  cannot be made reported as unavailable rather than skipped.
* Reordering from anywhere but those two forms is out of scope, as is moving a card by dragging it.

This slice deliberately falsifies two sentences of existing behaviour, which are rewritten when the feature files are:
[Observation Creation](../../features/observation-creation.md)'s "keeps the position it was added in", and [Observation
Editing](../../features/observation-editing.md)'s *Where an added Metric lands* — an added Metric still lands last, it
simply no longer has to stay there.

## 3. Technical Design

### 3.1 Domain

Nothing changes. `Observation` holds its Metrics in an insertion-ordered `Map` keyed by id, so `metrics` already returns
the order the aggregate was constructed in, and that array order is what this slice persists.

`Metric` gains no `position` field. A position is a fact about a Metric's place in its Observation's list rather than
about the Metric itself, and holding it in both places would let a list disagree with the values inside it.
`Observation` gains no move method either: the forms move drafts rather than Metrics, and both use cases already build a
fresh aggregate from the array they are handed.

### 3.2 Application

Nothing changes. `CreateObservationUseCase` and `UpdateObservationUseCase` both map `input.metrics` in order into the
aggregate they construct, so the order a form submits is already the order the aggregate holds and the repository
writes. Neither input type gains a position field — the array's own order carries it.

### 3.3 Infrastructure

The `metrics` table gains `position INTEGER NOT NULL` in `SCHEMA` (`Database.ts`), declared after `observationId`, which
it qualifies. `SQLiteObservationRepository.findAll` orders by `observationId, position` in place of `rowid`, and the
comment above that query — which currently explains that `rowid` is the only record of declaration order — is rewritten
with it.

Both write paths gain the column: `save` writes each Metric's index in `observation.metrics`, and `update` carries
`position` through its `INSERT … ON CONFLICT(id) DO UPDATE` in both the inserted columns and the updated ones. Because
that write is whole-aggregate ([ADR-6](../../adr/6-observation-update-write-path.md)), every held Metric's position is
rewritten on every save, so positions are always the dense range `0 … n-1` and nothing renumbers separately.

**No unique index on `(observationId, position)`.** The update loop writes one row at a time, so two Metrics exchanging
positions would collide on the first of the two — the same problem the name index has, which the repository already
solves by parking every name on its own id. A second parking dance would buy a guarantee the write path already
provides. Distinct positions are therefore the writer's promise rather than the schema's, which holds because both paths
assign an Observation's whole set at once.

**The database is recreated rather than migrated.** No migration runner is added and no `ALTER TABLE` runs: whether a
schema change preserves existing data is decided per change, and this one does not. `CREATE TABLE IF NOT EXISTS` leaves
an existing `metrics` table untouched, so a database predating this change keeps a table with no `position` column and
every statement naming it fails — the Observation list logs its failure and reads as empty, and a save reports through
the screen's alert. Wiping is a manual step, and not one the dev commands perform: `clearDevData` deletes rows through
the repository and never drops a table, so reseeding alone will not add the column. On a device it means clearing the
app's storage or reinstalling. The E2E runner needs nothing — `scripts/emulator-setup.sh` already deletes the app's
SQLite directory before every run, precisely so a schema change cannot be mistaken for a broken flow.

[ADR-6](../../adr/6-observation-update-write-path.md)'s final consequence stops being true when this ships — it records
that Metric order is `rowid` order, and that reordering needs a migration mechanism the project does not have. It is
rewritten in place, as part of this slice, into what holds afterwards: order is the `position` column, written by that
same whole-aggregate write, which assigns every held Metric its ordinal on every save.

### 3.4 Presentation

**`MetricDraft` gains a `key`** — a client-side identifier issued when the draft is created, never shown and never
stored. Both screens key their cards by the card's index today (`EditObservationScreen` by `metric.id` where there is
one, by index where there is not), which is stable only while cards never move. Under an index key a move leaves React's
element — and with it the native `TextInput` holding focus and its selection — attached to the position rather than to
the draft, so a move made mid-typing carries on typing into whichever Metric took that position. Key both screens' cards
by the draft's own key instead.

`EMPTY_METRIC` is a module constant both screens append, so it cannot carry a distinct key and becomes a factory
returning a fresh draft each call; `toMetricDraft` issues one too. Any process-unique value serves —
`Crypto.randomUUID`, as ids are minted elsewhere — since it never leaves the form.

**`moveMetricDraft(drafts, from, to)`** — pure, returning a new array with the draft at `from` placed at `to` and every
other draft in its existing relative order. An index outside the list returns the array unchanged, so the boundary cases
belong to the helper rather than to each screen. It lives beside `MetricDraft` and `toMetricDraft` in
`MetricEditorCard.tsx` and is exported through the components barrel, following where the draft's other helpers already
sit rather than starting a module for one function.

**`MetricEditorCard`** gains `onMoveUp?: () => void` and `onMoveDown?: () => void`, and renders the arrow pair whenever
either is given. An arrow whose handler is absent renders inert and dimmed rather than being left out, so:

* a single-card form shows no arrows at all, as it already shows no bin;
* the first card of several shows a dimmed up arrow and a live down arrow, and the last card the mirror;
* every other card shows both live.

The pair sits in the card's `labelAccessory` row, which holds the bin alone today, ordered up, down, bin. The
destructive icon stays rightmost, and — because the pair is either wholly present or wholly absent — at the same
distance from the card's edge on every card of a form. A bin that shifted left on the first card would sit under the
thumb that had just been tapping the down arrow of the card below it.

The arrows are `arrow-upward` and `arrow-downward` at size 20, matching the bin; live in `COLORS.outline`, the muted
grey the bin wears on an added card, and inert in the dimmer `COLORS.outlineVariant`. Neither takes the bin's red on a
stored card: a move destroys nothing, so the colour that means it must not appear on one.

Each arrow is a button labelled `Move metric <name> up` or `… down`, falling back to the card's position on the form
while the name is still blank, exactly as the bin's own label already does. An inert arrow reports itself disabled
rather than going unlabelled, so a screen reader says which move cannot be made instead of passing over it.

The card's testIDs stay derived from `index`, a card's position on the form, so after a move `metric-name-0` names
whichever card is now first — what the existing flows already assume.

**Both screens** gain a handler passing a card's index and its neighbour's to `moveMetricDraft`, and supply `onMoveUp` /
`onMoveDown` under the rule above: omitted at each end, and both omitted where the form holds one card — the same
condition the bin is already omitted on.

**The Edit form's dirty check needs nothing added.** `metricsDiffer` compares each draft against the stored Metric at
its own index and already treats a differing id at an index as a difference, so a reorder makes the form dirty and earns
the `Discard changes?` prompt. A save that only reorders has removed no Metric, so `handleSave` finds nothing removed
and writes without the removal confirmation — which is what a change that destroys nothing should do.

### 3.5 Design

[design/new-observation.html](design/new-observation.html) and
[design/edit-observation.html](design/edit-observation.html) — the two forms carrying the arrow pair, on an added card
and on a stored one respectively.

## 4. Verification

### Seed Data

None added. `mixed metrics` declares eight Metrics in an order [testing-data.md](../../../testing-data.md) asserts
throughout — five Numeric, then `flag`, `category` and `note` — so reordering it as a fixture would falsify much of that
document for nothing. The checks below move `no numeric` instead: two Metrics, `mood` above `done`, both charted, so a
move shows on the details screen without scrolling.

### Manual Verification

Clear the app's storage first, so the database is recreated with the `position` column — there is no in-place upgrade,
and reseeding alone will not add it. Then reseed test data.

1. Open `no numeric`: TRENDS reads `mood` then `done`, and **Add Record** lists them in that order.
2. ⋮ → **Edit**. The `mood` card carries a dimmed up arrow and a live down arrow, the `done` card the mirror, and both
   carry their red bin to the right of the pair, the same distance from the card's edge.
3. Move `done` up. Its card carries its name, its stated type and its stated values with it, and `mood` takes second
   place. Leave with the back arrow: `Discard changes?` is asked. **Keep editing**.
4. **Save Observation**. Nothing is confirmed first. The details screen reads `done` then `mood`; **Add Record** does
   too, and expanding a Record under RECENT RECORDS puts `done`'s value first.
5. Reopen the edit form: the new order is what it loads. Move `mood` back up and save.
6. From the Observation list, **+** → add a second Metric, type a name into each, then move the second above the first.
   Both names travel with their cards. Save, and open the new Observation: its trend cards read in the moved order.
7. On a form holding one Metric card, neither arrow renders.
8. With a screen reader, focus each arrow: it names its Metric and its direction, and a dimmed one is announced
   disabled.
9. Reload the app: every order set above survives.

### Automated Tests

* **Unit:** `moveMetricDraft` moves a draft up and down, leaves every other draft's relative order alone, returns a new
  array, and returns the input unchanged for an index outside the list.
* **Integration:** `SQLiteObservationRepository` round-trips order — `save` then `findAll` returns declaration order;
  `update` with a reordered aggregate returns the new order; a Metric added to a reordered aggregate lands where the
  aggregate puts it rather than last; and a reorder leaves every `record_values` row intact, with `PRAGMA foreign_keys =
  ON` as [ADR-6](../../adr/6-observation-update-write-path.md) requires of a test on this path.
* **Component:** `MetricEditorCard` renders both arrows when either handler is given and neither when both are absent;
  an arrow whose handler is absent is inert and reports itself disabled; each arrow's label names its Metric, and its
  position while the name is blank; tapping a live arrow calls its handler.
* **Screen:** `CreateObservationScreen` — a move carries what was typed into the card and, after a refused save, the
  mark against it; the created Observation's Metrics are in the order the form last showed. `EditObservationScreen` — a
  move alone makes the form dirty and raises the discard prompt; a save that only reorders raises no removal
  confirmation and submits the Metrics in the new order.

### E2E Flow

A new flow, `flows/metric-ordering/metric-ordering.yaml` — this is the capability's first slice, so the folder does not
exist yet.

* **Fixture:** `seed`.
* **Covers:** both routes in one pass. Create an Observation with two Metrics, move the second above the first before
  saving, and assert its trend cards read in the moved order; then open `no numeric`, ⋮ → **Edit**, move `done` above
  `mood`, save, and assert the details screen reads `done` above `mood`. `no numeric` rather than `mixed metrics`: eight
  cards already cost the editing flow sixty-second scroll timeouts to reach the fifth.
* **Handles:** the arrows need an `accessibilityLabel` each (`Move metric done up`), which is what the flow selects on.
  The existing `metric-name-<index>` testIDs already identify a card by its position, so nothing else on the path is
  new.
