# ADR-3: Record Metric value requirements

## Context

A Record captures values for the Metrics its Observation defines. This decision settles how many of those Metrics a
Record must carry a value for, and whether a Record carrying none is legitimate.

Three forces bear on the answer.

Partial capture is the ordinary case rather than the exception. A user records one Metric now and fills in another
later, and an Observation may hold Metrics that are only occasionally relevant to what is being recorded.

Absence and value are distinct. "Not entered" says something about the moment being recorded, and is not a gap to be
closed with a default — a distinction the Boolean Metric input was already changed to preserve.

Metric removal from an Observation is planned. Removing a Metric discards the values Records held for it, leaving any
Record whose only value belonged to that Metric with none.

## Alternatives

1. **Require a value for every Metric of the Observation.** Ruled out by the first two forces together: partial capture
   becomes impossible, and a Metric the user has nothing to say about must still be given some value before the Record
   can be saved, which records a fabrication as though it were an observation.
2. **Require at least one value, as an invariant of the Record.** The strongest form — a Record with no values could not
   be constructed, and the rule would bind every writer, including seeded and imported data. Ruled out by the third
   force: a Record is emptied by a change to its Observation, so the domain would assert a state to be impossible while
   the persistence layer holds instances of it. Reconstructing a Record from storage does not pass through the behaviour
   that creates one, so the invariant would be bypassed on every load rather than upheld — a guarantee in name only.
3. **Require at least one value, enforced in the application layer.** Keeps the domain free of a rule it cannot
   guarantee, while refusing empty Records where a user's input arrives. Ruled out because it forbids users the one
   state the system will still go on to produce by itself, and charges for the prohibition twice: every write path added
   later must restate it, and the interface must justify a refusal the system does not honour internally.
4. **Treat every Metric value as optional, including the case where none is entered.** Chosen.

## Decision

Metric values on a Record are optional. A Record is valid with values for any subset of its Observation's Metrics,
including the empty subset.

* No layer refuses a Record for carrying no values.
* Saving with nothing entered creates a Record carrying its timestamp and its Observation, and nothing else.
* Absence of a value is stored as absence, never as a substitute value.

Wherever Records are read they must already tolerate an empty one, and no rule about writing changes that. A prohibition
at the point of input would leave the obligation exactly where it was and add a second one beside it.

## Trade-offs

Benefits:

* Recording one Metric costs one field, and an Observation can carry occasionally-relevant Metrics without taxing every
  Record made against it.
* Metric removal needs no policy for the Records it empties. An emptied Record is an ordinary Record, not a violation to
  be cascaded, repaired, or blocked.
* A Record with a timestamp alone gives occurrence-only logging a home. The Event concept is meant for occurrences with
  nothing measured but has no interface, so this is the only expression of it available to users today.

Costs:

* **Reversal is expensive, and this is the principal accepted cost.** If at least one value is later required, users
  will already hold empty Records. Tightening then means either a migration that deletes their data, or a rule that
  binds only new Records while existing data contradicts it. The opposite order — starting strict and loosening — would
  have cost nothing to reverse. This decision knowingly takes the direction that is harder to undo.
* A mis-tap creates a Record that says nothing, with no warning and no trace of intent, and these accumulate until
  noticed and deleted by hand.
* Empty Records occupy the interface wherever Records are listed while contributing to no series or chart — upkeep with
  no analytical value.
* No part of the system expresses the expectation that a Record ought to say something. That expectation now rests
  entirely on the user's judgement.

## Consequences

* A Record's update behaviour replaces the values it is given rather than merging them into what is already there, so a
  value cleared while editing is removed rather than silently kept. Merging would leave values optional at creation but
  permanent from then on.
* Every read path and screen displaying Records tolerates one holding no values, showing absence in place of each value
  rather than failing or substituting one.
* An empty Record is inert to analysis: it belongs to no series and appears in no chart, while remaining visible
  wherever Records are listed.
* A per-Metric requirement flag remains open as a later refinement, and would be the honest home for any obligation,
  since it is the Observation's author declaring what their own Metric means. Should it arrive, the wholly empty Record
  returns as a question, to be revisited under the reversal cost recorded above.
