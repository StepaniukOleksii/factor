# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

1. E2E: add a second Metric and pick its type in the Create Observation form. Extend
   [`observation-creation.yaml`](../../.maestro/flows/observation-creation/observation-creation.yaml), fixture
   `reset` as it already uses. Tap `Add Metric`, set the new Metric's type with the picker, fill in what that
   type asks for, and save. Then open the Observation and check both Metrics show in the order they were added,
   and open **Add Record** and check the new Metric renders as its type — a Choice field listing the values that
   were typed. Handles: picker `metric-type-{index}`, value rows `metric-value-{index}-{valueIndex}`,
   `Add Metric` and `Add Value` by text.

2. E2E: delete an Observation that has Records. Extend
   [`observation-deletion.yaml`](../../.maestro/flows/observation-deletion/observation-deletion.yaml), fixture
   `seed`. Use `stale records`, which carries three Records, instead of `no records`, which carries none. Keep
   the existing steps: open it, cancel once, then delete. Check the list comes back with it gone and keep the
   existing `mixed metrics` check, then create a new Observation with the deleted name and check it is accepted.

3. E2E: zoom twice and step back twice. **Blocked on a new fixture — do not re-attempt against `seed` as it
   stands.** Verified on the emulator: the tap on `hourly` at `1Y` lands on the right canvas and does nothing,
   and a second tap on `stale records` after its first zoom does nothing either.

   What decides whether a centre tap registers, from
   [`NumericTrendChart`](../../src/presentation/charts/NumericTrendChart.tsx): the tap lands at ~45% across the
   window, `nearestPointIndex` picks the point closest to that by time, and the press is dropped unless that
   point is within `VERTICAL_TOLERANCE` (24) of the canvas's vertical middle. Points are scaled across the
   series' own min/max over an 88-unit plot, so the point has to fall in the middle ~18-73% of the series'
   value range. It is *not* true that only a single-point chart can be tapped — `dense` at `1M` draws 30 points
   and its centre tap opens a Record. A single point works because a zero range centres it; **two** points
   never work, because they are pinned to the top and bottom with nothing between — which is exactly `hourly`
   at `1Y`.

   The zoom-specific blocker is separate: the tapped point must fold **2 or more** Records, or it opens the one
   Record instead. A zoom day-aligns the window onto the Records that point folded and buckets it at
   span/30 rounded up to whole hours, so after any first zoom the buckets are sub-day while every seeded
   Record is a day or more from its neighbours — one Record per bucket, and the next tap opens a Record.

   A fixture that would carry the whole entry: a Numeric Metric whose Records cluster around 195-205 days back
   (one 30-day bucket at `1Y`, so a single centred point folding them all), with one day of that cluster
   holding **two Records inside the same hour** and a mid-range value, and the days either side of it holding
   the low and high values. First tap narrows to the ~11-day cluster; the middle point is then the nearest to
   the tap and mid-valued, so the second tap narrows to that one day; the pair inside one hour is a single
   centred point there, and day-alignment cannot narrow further, so the third tap leaves the window as it is —
   the shape the entry asks for. Needs `devSeedData.ts` and the counts asserted by `devSeedData.test.ts`, so
   it is a spec rather than a test-queue item.
