# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

1. E2E flows still to write. Each spec's Verification section already names its flow and fixture, so
   picking one up means handing that spec to the `e2e-tester` skill. Strike an entry once its flow runs
   green from a cold `npm run e2e`.
    1. `persistence-restart` — a property flow, belonging to no spec: create data, `stopApp`, relaunch
       without resetting, confirm it survived. First because nothing in the repo touches real SQLite —
       every repository test mocks `getDatabase`.
    2. `1-2-observation-listing`
    3. `1-3-observation-details`
    4. `1-5-observation-description`
    5. `2-2-record-actions-presentation`
    6. `2-3-record-deletion`
    7. `2-4-record-editing`
    8. `2-5-record-timestamp-editing` — the only flow that drives the native date picker, which every
       Vitest test mocks out.
    9. `2-6-boolean-metric-input`
    10. `2-7-metric-description`
    11. `3-2-numeric-metric-trend-chart`
    12. `3-3-tap-to-record-detail`
    13. `3-4-time-range-selector`
    14. `3-5-custom-time-range-input`
    15. `3-7-tap-aggregated-point-to-zoom`
    16. `3-9-single-point-trend-chart`
