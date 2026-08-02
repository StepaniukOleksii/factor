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
      on the Details screen. `2-1` already carries inline "Superseded by ADR-3" notes elsewhere, so the
      convention exists — it just isn't applied when a *later spec* changes an earlier one's behaviour.
5. Response summarizer