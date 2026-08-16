# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

1. **Chart Tap Tolerance — E2E flows.** The slice has shipped: a Numeric chart tap now lands only within 24px
   of its nearest point on **both** axes, so the two flows below tap dead space and fail until re-aimed. The
   `Alongside` item is already done — `testing-android-e2e.md`'s "How flows are written" carries the rule. The
   rest, copied whole from the spec's Verification section:

   > Both flows under `.maestro/flows/trend-exploration/` — `tap-a-chart-point.yaml` and `back-to-unzoom.yaml` —
   > are re-aimed **as part of this slice rather than queued**: they tap the canvas centre and reach their
   > target only because nothing rejects a distant tap today, so they go red the moment the tolerance lands. No
   > new flow.
   >
   > * **Fixture:** `seed`, which both already open from.
   > * **Covers, newly:** a tap in an empty stretch of a chart that *has* a point does nothing — in
   >   `tap-a-chart-point.yaml`, on the Record the flow enters by hand on `no records`, immediately before the
   >   tap that opens it, so one canvas is shown rejecting and then accepting. The screen staying on `TRENDS`
   >   with no `"Save Record"` visible is the whole assertion; every other variation is Vitest's.
   > * **How to aim:** Maestro's `tapOn` takes an element-relative `point` beside a selector, so
   >   `{id: "numeric-trend-chart-pressable", point: "83%,50%"}` taps 83% across *that element*, not the
   >   screen. A point is drawn at `x = 32 + f × (W − 36)` in a chart of width `W` (`LABEL_GUTTER` and
   >   `PLOT_RIGHT_INSET` in `chartAxis.tsx`), so its percentage is `f + (32 − 36f) / W` — within a point of
   >   `f` itself at any phone width, against a tolerance of ±24px ≈ ±7% of a card. `f` is where the point's
   >   bucket falls in the window, which the fixture fixes:
   >
   >   | Where in the flow | Window and bucket grid | `f` | Aim |
   >   |---|---|---|---|
   >   | `no records` plus the Record the flow enters, at the default `1M` — 2 taps in `tap-a-chart-point.yaml` | 30 days, day buckets; a Record entered now lands in the last one | 29/30 | `"96%,50%"` |
   >   | `stale records` at `1Y` — 1 tap in `tap-a-chart-point.yaml`, 5 in `back-to-unzoom.yaml` | 365 days, 30-day buckets; all four Records share the bucket starting 300 days in | 300/365 | `"83%,50%"` |
   >   | the window the first zoom opens — 1 tap in each flow | the 17 days those Records span, 14-hour buckets; the middle day's pair sits 196 hours in | 196/408 | `"52%,50%"` |
   >   | the window the second zoom opens — 1 tap in `tap-a-chart-point.yaml` | that middle day, hour buckets; its two Records share the 09:00 one | 9/24 | `"43%,50%"` |
   >
   >   The `50%` vertical serves all four: a single point is drawn at the plot's vertical middle, and the
   >   middle point of the zoomed three sits within a few pixels of it because its value lies between the other
   >   two. Each aim needs a comment giving its derivation — the number is meaningless alone, and a tap that
   >   silently stops landing is the hardest failure in the suite to read.
   > * **Handles:** none new; the canvas already carries `numeric-trend-chart-pressable`, the element the
   >   percentages are relative to.
