# ADR-6: Observation update write path

## Context

`ObservationRepository` writes an Observation on two paths. `save` brings one into existence, its Metrics with it, and
nothing else in the app creates an Observation at all. This decision settles what the other path reaches.

One fact about the schema bears on the answer: `record_values.metricId` is `ON DELETE CASCADE`, and a Metric's id is
what a Record's stored values are keyed by — so removing a Metric row, or rewriting one under a fresh id, destroys every
value stored against it.

Three things have needed this path, in that order: correcting an Observation's name or description, editing its Metrics
in the same save, and removing one ([Observation Editing](../features/observation-editing.md)). The third is what forces
the cascade above to be answered for rather than avoided.

Narrowing what a Metric accepts stays outside this decision. A narrowed Numeric bound, and a Choice value removed or
renamed, strand stored values without removing the Metric holding them, so what they ask is what a stored value does
when its own definition stops admitting it — not what this path writes.

## Alternatives

1. **A narrow `update` writing the Observation's own columns and no Metric.** What this ADR decided first, and how the
   repository was built: one statement, `name` and `description`, every Metric row left alone. It kept a rename from
   being able to disturb a Metric or a Record, and left the removal question unanswered by declining to write Metrics at
   all. It failed as soon as one screen edited both halves. An Observation's name and its Metrics change in a single
   user action, so a Metric write beside it — this method plus an `updateMetrics`, say — means two transactions and a
   window in which the rename landed and the new Metric did not.
2. **Widen `update` to write every Metric the aggregate holds, and refuse an aggregate that has lost one.** What this
   ADR decided second. It made a whole-aggregate write total without answering the removal question, and its refusal was
   the only place in the code recording that the question was open. It failed the moment the answer arrived: the refusal
   was by then the sole obstacle to a removal the user had asked for and been told the cost of, and keeping it would
   have meant a second write path beside this one doing what this one already does.
3. **One method dispatching on whether the row exists.** Ruled out because it hides the caller's intent at the call
   site, and converts a failure into a silent success: an Observation deleted from another route while its form was open
   would be *created* rather than refused, where every screen reports that case as `Not found`.
4. **Keep a removed Metric's row and mark it retired.** The way to take a Metric off every screen without destroying
   what was recorded against it: the row stays, its values stay, and the Record form and the trend section skip it while
   Record listing still shows its history. Ruled out because it buys that history at the cost of a second kind of Metric
   the domain does not have. Every reader of an Observation's Metrics — the Record form, each chart, the expanded Record
   row, the name-uniqueness check, this write path — would have to say which kind it means, and a name would stay taken
   by a Metric no user can see. The app destroys on demand rather than retiring: deleting an Observation takes every
   Record with it ([Observation Deletion](../features/observation-deletion.md)), and a Metric is a smaller act of the
   same kind.
5. **Widen `update` to write every Metric the aggregate holds and delete every row it has lost.** Chosen.

## Decision

`ObservationRepository.update(observation)` writes, in one transaction: the `metrics` rows for that Observation which
the aggregate no longer holds are deleted; `name` and `description` are set on the `observations` row; and one `metrics`
row is written per Metric the aggregate holds — inserted where the id is new, updated in place where it is not, always
keyed by the Metric's own id. `createdAt` is deliberately absent from the SET list: it is what orders the list, and a
rename is not a re-creation.

A Metric's stored values are destroyed with it, through the schema's cascade rather than a statement of this method's
own. Nothing is retired or hidden: the aggregate is the whole statement of what the Observation holds, and a Metric
absent from it is gone.

`save` stays what it is: creation's insert. The split is by intent rather than by convenience — `save` brings an
Observation into existence together with its Metrics, `update` writes what an existing one currently says.

The unique indexes on `observations (name COLLATE NOCASE)` and on `metrics (observationId, name COLLATE NOCASE)` back a
rename exactly as they back a creation ([ADR-4](4-name-uniqueness-rule-placement.md)).

## Trade-offs

Benefits:

* One user action is one transaction. An Observation renamed, given a Metric and relieved of another in the same save
  lands whole or not at all.
* A Metric row is only ever written under its own id, so no path here strands a `record_values` row: values are
  destroyed with their Metric or not at all.

Costs:

* **`update` is destructive, and silently so.** Handing it an aggregate short of a Metric deletes that Metric and its
  history with no further question. Whether the user meant it is established before the call, and nowhere else.
* A whole-aggregate write rewrites Metric rows that did not change. The alternative is the caller stating which ones it
  touched, which duplicates what the aggregate already knows.
* `record_values` carries no index on `metricId` — its primary key leads with `recordId` — so the cascade scans it. That
  is accepted against an index maintained on every Record ever written, for a scan that runs only on a removal.

## Consequences

* Any caller of `update` must treat an aggregate short of a Metric as a deliberate destruction, and must have
  established the user's intent before calling. There is no dry run and no undo.
* A test exercising this path against a real SQLite has to enable `PRAGMA foreign_keys = ON`, as the app's own
  connection does. Without it the Metric rows go, their values are orphaned, and the test passes.
* The change that narrows a Numeric bound, or removes or renames a Choice value, still has its own question to answer:
  those strand stored values without removing the Metric, so nothing here decides what becomes of them.
* Any further Observation-level column — a per-Observation setting, a display preference — is written through `update`
  rather than earning a method of its own.
* Metric order is the `metrics` table's `rowid` order. Inserting a Metric mid-list or reordering needs a `position`
  column, and therefore a schema migration mechanism the project does not have.
