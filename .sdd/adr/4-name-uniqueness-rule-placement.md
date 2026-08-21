# ADR-4: Name uniqueness rule placement

## Context

Two rules arrive together: an Observation's name must be unique among Observations, and a Metric's name must be unique
within its Observation. This decision settles which layer enforces each, and where the meaning of "the same name" is
defined.

Three forces bear on the answer.

The two rules differ in what they compare against. A Metric's siblings are held by the Observation that owns them, in an
aggregate that already exists. The set of all Observations is held by nothing in the domain, and
[architecture.md](../project/architecture.md) forbids the domain from reaching storage to find it.

A refusal has to name a field. The Create Observation screen marks the offending input, and an exception carrying a
sentence cannot say which of two Metric rows to outline.

Enforcement points multiply on their own. SQLite can express uniqueness directly, and a unique index is wanted as a
backstop for writers that never pass through the application — which makes SQLite's collation a second definition of
name identity, one that cannot call into JavaScript.

## Alternatives

1. **Both rules in the application layer, defined where they are used.** The simplest option, and how every other Create
   Observation rule already works. Ruled out by the first force: it puts an aggregate-internal rule outside the
   aggregate holding the data it constrains, so every write path added later — renaming a Metric, adding one to an
   existing Observation — restates the rule, and the copies drift apart.
2. **Both rules as invariants of a new aggregate holding every Observation.** Ruled out because it cannot deliver what
   it promises: to guarantee uniqueness the aggregate must hold every Observation, so it is built from a full repository
   read on each write. That is a snapshot rather than an invariant — it cannot refuse a write it did not load. It also
   replaces neither the validator nor the index, adding a layer rather than removing one.
3. **The unique index alone, translating SQLite's constraint error for the user.** Ruled out by the second force: an
   index reports that a write collided, not which field caused it, so the screen regresses to an alert where every
   neighbouring rule marks an input.
4. **Split by what each rule can see, over one shared definition of name identity.** Chosen.

## Decision

Name identity is defined once, in the domain: a normalizer reducing a name to what it is compared by (trimmed,
lower-cased), and a helper reporting which entries of a list collide under it. Every check calls these. No layer
re-implements the comparison.

Each rule is then enforced at the innermost layer that can see everything it compares:

* **Metric-name uniqueness within an Observation** is an invariant of `Observation`, enforced where its Metric
  collection is set and mutated, because that aggregate already owns exactly the data the rule is about.
* **Observation-name uniqueness** is enforced in the application layer, because no aggregate owns the set of all
  Observations and the domain may not reach storage to obtain it. The use case reads the existing names and passes them
  to a pure validator.
* **A unique index in SQLite backs both**, catching any writer that bypasses the application entirely.

The screen's validator keeps a collision check for both rules. It is not a second definition of the rule — it calls the
same domain helper — but the thing that decides which field to mark, which no exception and no index can express.

## Trade-offs

Benefits:

* Editing features inherit the Metric rule by construction. Anything that mutates an Observation's Metrics passes
  through the aggregate, so a rename or add-metric feature cannot forget it.
* Casing, trimming and what counts as "the same name" are settled in one place, for both rules and for any name-scoped
  rule added later.
* The Observation rule stays reusable across write paths. A validator taking *the names this submission must not collide
  with* serves creation, which passes every name, and a future rename, which passes every name but the subject's own —
  without changing the validator.

Costs:

* **`Observation`'s construction can now throw, and it sits on the load path.** Every Observation is rebuilt through it
  when storage is read, so a database holding a colliding pair would fail the whole list rather than one row. No path in
  the application can write such a pair; only something writing SQLite rows directly. This is the principal accepted
  cost.
* The Metric rule has two enforcement points, aggregate and validator, which must agree about when to fire even though
  they share the comparison.
* SQLite's `NOCASE` collation folds ASCII letters only, where the domain folds by JavaScript's rules. The index is
  therefore strictly the weaker of the two and can never refuse a name the application accepted — but it remains a
  definition of name identity that cannot be unified with the domain's, only kept safe.
* Two rules that read alike in a requirements list sit in two different layers, and the reason is not visible from
  either one.

## Consequences

* Any later write path gets the Metric rule for free and must supply the existing names for the Observation rule itself.
  A rename feature excludes the subject's own name before validating, or a casing correction is refused against itself.
* A further name-scoped rule — Group names, Event names — is placed by the same test: the innermost layer that can see
  everything the rule compares.
* The normalizer becomes the definition of name identity across the app. Changing it changes what collides everywhere,
  including for names already stored under the old rule.
* Should storage gain a writer that bypasses the domain, such as an import feature, the load-path throw above becomes
  reachable and needs its own decision.
