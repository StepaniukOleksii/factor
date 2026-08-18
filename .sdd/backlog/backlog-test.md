# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

1. E2E: the Observation Details metadata line (from the Observation Metadata slice). Extend
   [`observation-viewing.yaml`](../../.maestro/flows/observation-viewing/observation-viewing.yaml). The feature
   has a flow already, and this is one more line on a screen that flow already opens twice.

   * **Fixture:** `seed`, which it already opens from.
   * **Covers, newly:** the line on the two Observations the flow already visits — `Created .*4 records` on
     `stale records`, and `Created .*No records` on `no records`. The second is also what tells the line's empty
     wording apart from the `No records yet.` sitting below it, which no assertion on `No records` alone could
     do. Reaching across the `·` with `.*` keeps both assertions off the device's date format.
   * **Handles:** none new — the line is a platform `Text`, and its text is the assertion.

   Note the fixtures now state their own creation dates, which reorders the list: it reads `no records`,
   `no numeric`, `stale records`, `mixed metrics` newest-first. The flow's `launch.yaml` `READY_TEXT` of
   `no numeric` is unaffected, and nothing in the flow depends on the old order.
