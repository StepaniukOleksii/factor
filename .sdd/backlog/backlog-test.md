# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

1. No E2E flow covers the Create Observation screen refusing an unmet form. Tapping `Create Observation`
   on an empty one should leave `Observation name cannot be empty` and `Metric name cannot be empty`
   both on screen, raise no platform dialog, and add nothing to the Observation List. Unit and component
   coverage is in place — [validateCreateObservation.test.ts](../../src/application/validateCreateObservation.test.ts)
   and [CreateObservationScreen.test.tsx](../../src/presentation/screens/CreateObservationScreen.test.tsx) —
   so what is left is that the marks render on a real device, which is also the only place the platform
   dialog this replaced could still appear.
2. `.maestro/1-6-name-uniqueness.yaml` is not written yet — the E2E flow
   [Name Uniqueness](../epics/1-observation-management/1-6-name-uniqueness/spec.md) §4 calls for, on the
   `seed` fixture: entering an existing Observation's name on the Create screen, seeing OBSERVATION NAME
   refuse it, and correcting it to save. The Metric half stays in the screen test — the Observation half is
   the one that exercises stored data, which is what an on-device flow adds over
   [CreateObservationScreen.test.tsx](../../src/presentation/screens/CreateObservationScreen.test.tsx).
