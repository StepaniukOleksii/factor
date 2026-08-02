# Backlog — Docs

This is an informal idea/issue capture list — not a specification. It exists to hold loose documentation
notes until they're ready to become a real spec.

1. Create git commit conventions. Describe labels and commit content.
2. How make the skill to read only relevant documents. For example no need reading domain model if implementing UI
   changes
3. Create a separate design skill with rules like provide only the final screen 
4. Spec evolution. Do not freeze them, evolve. Some stale statements found while writing E2E flows, all
   only noticeable by reading the spec against the running app:
    - `3-10` states "No Maestro flow" is possible, since a Skia canvas exposes nothing selectable. One was
      written anyway, aiming at the canvas's `testID`.
    - `2-1`'s "Return to Observation List" requirement was superseded by `0-1`, which lands a saved Record
      on the Details screen. The "Superseded by" convention already exists and `3-5` uses it for this exact
      change — so the gap is not a missing convention but an inconsistently applied one: a spec that
      changes an earlier one has to find every spec it affects, and nothing checks that it did.
    - `2-6`'s Verification Plan still blocks a save with "This field is required" where a Boolean Metric
      was left unanswered — a rule ADR-3 abolished by making every Metric value optional, and which no
      layer of the Record form enforces. Unlike the two above, the thing that went stale is a spec and
      the thing that superseded it is an ADR, which the "Superseded by" convention has no form for: it
      links specs to specs, so a decision recorded outside the spec tree leaves nothing behind in the
      specs it invalidates.
5. Response summarizer