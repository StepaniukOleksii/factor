# Backlog — Docs

This is an informal idea/issue capture list — not a specification. It exists to hold loose documentation
notes until they're ready to become a real spec.

1. Create git commit conventions. Describe labels and commit content.
2. How make the skill to read only relevant documents. For example no need reading domain model if implementing UI
   changes
3. Create a separate design skill with rules like provide only the final screen 
4. Spec evolution. Do not freeze them, evolve. Two stale statements found while writing E2E flows, both
   only noticeable by reading the spec against the running app:
    - `3-10` states "No Maestro flow" is possible, since a Skia canvas exposes nothing selectable. One was
      written anyway, aiming at the canvas's `testID`.
    - `2-1`'s "Return to Observation List" requirement was superseded by `0-1`, which lands a saved Record
      on the Details screen. The "Superseded by" convention already exists and `3-5` uses it for this exact
      change — so the gap is not a missing convention but an inconsistently applied one: a spec that
      changes an earlier one has to find every spec it affects, and nothing checks that it did.
5. Response summarizer