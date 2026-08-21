# ADR-6: Observation update write path

## Context

`ObservationRepository` has been insert-only. `save` writes the `observations` row and every `metrics` row in one
transaction, and nothing else in the app writes an Observation at all. Correcting an Observation's name or description
needs a write path, and the shape chosen for it is what a later slice editing Metrics inherits.

Two facts about the schema bear on the answer. `metrics.observationId` and `record_values.metricId` are both `ON DELETE
CASCADE`, so removing a Metric row removes every stored value for it — the Records survive, minus one column of data
each. And a Metric's id is what a Record's stored values are keyed by, so a Metric rewritten under a fresh id strands
them exactly as deleting it would.

Editing Metrics is deliberately outside this decision. [Observation Creation](../features/observation-creation.md)
frames Metric declaration as one-time and complete, and what happens to Records whose Metric was narrowed or removed is
an open question with no answer yet. What is settled here is only how a correction to the Observation itself reaches
storage, without pre-empting that answer.

## Alternatives

1. **Make `save` an upsert.** The obvious move, and it keeps the repository to one write method. Ruled out because the
   aggregate handed to it carries a Metric list, so a whole-aggregate write has to decide what becomes of Metric rows
   the aggregate no longer holds: deleting them cascades their `record_values` away, and keeping them leaves `save`
   unable to express a removal at all. Either way every rename would be answering metric editing's question, settled in
   the write path least visible to the slice that eventually asks it.
2. **Delete the Observation row and reinsert it.** Ruled out outright: `observations` cascades to `metrics` and
   `records`, so a rename would take everything the Observation holds with it.
3. **One method dispatching on whether the row exists.** Ruled out because it hides the caller's intent at the call
   site, and it converts a failure into a silent success: an Observation deleted from another route while its form was
   open would be *created* rather than refused, under a fresh id and with no Metrics — where every screen currently
   reports that case as `Not found`.
4. **A narrow `update` writing the Observation's own columns.** Chosen.

## Decision

`ObservationRepository.update(observation)` writes `name` and `description` on the `observations` row for
`observation.id` and nothing else — one statement, no transaction, `createdAt` and every Metric row left alone. `save`
stays what it is: creation's insert.

The split is by intent rather than by convenience. `save` brings an Observation into existence together with its
Metrics; `update` corrects what an existing one says about itself. Neither writes a Metric of an Observation that
already exists — no such path exists, and the slice that adds one decides what happens to the Records behind the Metrics
it changes.

The unique index on `observations (name COLLATE NOCASE)` backs a rename exactly as it backs a creation
([ADR-4](4-name-uniqueness-rule-placement.md)): the application refuses a collision first, and the index catches a
writer that never passed through it.

## Trade-offs

Benefits:

* A rename cannot disturb a Metric or a Record. The cascade stays a deletion mechanism, reached only by [Observation
  Deletion](../features/observation-deletion.md).
* One statement means no transaction, no read-modify-write, and no window in which an Observation exists half-written.
* The unanswered question stays where it is asked, rather than being answered by default in a method whose callers are
  not thinking about Metrics.

Costs:

* **`update` silently ignores the Metric list on the aggregate it is given.** A caller that changed a Metric and called
  `update` is told nothing, and its change is dropped. This is the principal accepted cost, and it stands until a Metric
  write path exists; the method's doc comment is what carries the warning meanwhile.
* Two write methods whose difference neither name states: which one writes Metrics has to be read.
* An Observation whose row and whose Metrics must both change has no single-transaction path, so the slice that needs
  one adds it rather than finding it.

## Consequences

* A slice editing Metrics must decide what happens to `record_values` when a Metric is removed or its constraint
  narrowed, and then either widen `update`'s contract or add a path beside it.
* Any further Observation-level column — a per-Observation setting, a display preference — is written through `update`
  rather than earning a method of its own.
* Should an import feature or any other writer that bypasses the application arrive, the name index remains the only
  thing standing between it and a colliding pair, as ADR-4 already notes.
