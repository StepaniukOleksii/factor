# ADR-6: Observation update write path

## Context

`ObservationRepository` writes an Observation on two paths. `save` brings one into existence, its Metrics with it, and
nothing else in the app creates an Observation at all. This decision settles what the other path reaches.

One fact about the schema bears on the answer: `record_values.metricId` is `ON DELETE CASCADE`, and a Metric's id is
what a Record's stored values are keyed by — so removing a Metric row, or rewriting one under a fresh id, destroys every
value stored against it.

Correcting an Observation's name or description was the first thing to need this path. Editing its Metrics is the second
([Observation Editing](../features/observation-editing.md)), in the same save as a rename of the Observation itself.
Removing a Metric stays outside this decision, and so does narrowing what one accepts: what happens to the Records those
strand is an open question with no answer yet.

## Alternatives

1. **A narrow `update` writing the Observation's own columns and no Metric.** What this ADR decided first, and how the
   repository was built: one statement, `name` and `description`, every Metric row left alone. It kept a rename from
   being able to disturb a Metric or a Record, and left the removal question unanswered by declining to write Metrics at
   all. It failed as soon as one screen edited both halves. An Observation's name and its Metrics change in a single
   user action, so a Metric write beside it — this method plus an `updateMetrics`, say — means two transactions and a
   window in which the rename landed and the new Metric did not. Its one documented cost, that it silently ignored the
   Metric list on the aggregate it was handed, stopped being a caveat and became the defect.
2. **Widen `update` and let it drop Metric rows the aggregate no longer holds.** The obvious way to make a
   whole-aggregate write total. Ruled out because it answers Metric removal's open question by default, in the write
   path least visible to the slice that eventually asks it: an aggregate that had lost a Metric for any reason would
   cascade that Metric's stored values away with no user having asked for a removal.
3. **One method dispatching on whether the row exists.** Ruled out because it hides the caller's intent at the call
   site, and converts a failure into a silent success: an Observation deleted from another route while its form was open
   would be *created* rather than refused, where every screen reports that case as `Not found`.
4. **Delete the Observation row and reinsert it.** Ruled out outright: `observations` cascades to `metrics` and
   `records`, so a rename would take everything the Observation holds with it.
5. **Widen `update` to write every Metric the aggregate holds, and refuse an aggregate that has lost one.** Chosen.

## Decision

`ObservationRepository.update(observation)` writes, in one transaction, `name` and `description` on the `observations`
row, and one `metrics` row per Metric the aggregate holds — inserted where the id is new, updated in place where it is
not, always keyed by the Metric's own id. `createdAt` is deliberately absent from the SET list: it is what orders the
list, and a rename is not a re-creation.

It reads the ids the table holds for that Observation first, and throws without writing anything when the aggregate no
longer holds one of them. `update` cannot remove a Metric, and it says so rather than leaving a caller to believe it
did.

`save` stays what it is: creation's insert. The split is by intent rather than by convenience — `save` brings an
Observation into existence together with its Metrics, `update` writes what an existing one currently says. Neither
removes a Metric, and the slice that adds such a path decides what happens to the Records behind it.

The unique indexes on `observations (name COLLATE NOCASE)` and on `metrics (observationId, name COLLATE NOCASE)` back a
rename exactly as they back a creation ([ADR-4](4-name-uniqueness-rule-placement.md)).

## Trade-offs

Benefits:

* One user action is one transaction. An Observation renamed and given a Metric in the same save lands whole or not at
  all.
* A Metric row is only ever written under its own id, so no path here can strand a `record_values` row.
* A caller that removed a Metric is refused rather than quietly obliged or quietly ignored, and the slice that answers
  the removal question relaxes one guard rather than adding a write path beside this one.

Costs:

* **`update` reads before it writes.** One extra `SELECT` inside the transaction, enforcing a rule that fires only on a
  caller bug. This is the principal accepted cost, and it buys the refusal being loud.
* A whole-aggregate write rewrites Metric rows that did not change. The alternative is the caller stating which ones it
  touched, which duplicates what the aggregate already knows.

## Consequences

* The slice that removes a Metric, or narrows a constraint, decides what happens to the `record_values` behind it and
  then relaxes `update`'s refusal. Until then that refusal is the only place in the code recording that the question is
  open.
* Any further Observation-level column — a per-Observation setting, a display preference — is written through `update`
  rather than earning a method of its own.
* Metric order is the `metrics` table's `rowid` order. Inserting a Metric mid-list or reordering needs a `position`
  column, and therefore a schema migration mechanism the project does not have.
