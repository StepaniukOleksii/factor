# Backlog — Refactors

This is an informal idea/issue capture list — not a specification. It exists to hold loose refactor notes until they're
ready to become a real spec.

1. Merge `CreateObservationScreen` and `EditObservationScreen`, the way one Record form already serves both creating and
   editing. They were kept apart because edit had no Metric half; once it has one they differ only in which parts of a
   Metric card are editable. Note that merging gives creation the discard prompt only edit has today, which is a
   behaviour change and not a free one.

