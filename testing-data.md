# Test data seeding

## Purpose

Factor is local-first: every observation, metric, and record lives in on-device SQLite, and there's
no server-side fixture data to fall back on. Verifying charts, "last record" states, and empty states
by hand means re-creating observations and records through the UI every time the app's data is
cleared — slow, and easy to skip the annoying-to-set-up edge cases (a chart with real history, a chart
with too little data, an observation with no records at all).

`reseedDevData()` (in [`src/infrastructure/devSeed.ts`](src/infrastructure/devSeed.ts)) fixes that: it
wipes the database and inserts a fixed dataset built by
[`src/infrastructure/devSeedData.ts`](src/infrastructure/devSeedData.ts), covering the scenarios below.
It's dev-only — wired to a **"Reseed test data"** item in the dev-client menu, gated by `__DEV__` (see
`App.tsx`), so it never runs in a release build. See
[testing-android.md](testing-android.md#loading-test-data) for how to open the dev menu on-device.

**This is destructive.** Reseeding deletes every existing observation (and its metrics/records) before
inserting the fixture set — don't run it if you have manually-entered data on the device you want to
keep.

The dataset is deterministic: the same metric values and the same offsets from "now" are generated
every time (see the `SEED` constant in `devSeedData.ts`). Absolute timestamps still shift with "now"
each time you reseed — that's required, since the whole point is for records to land inside whichever
rolling trend-chart window is selected whenever you run it.

**Naming.** Observation and metric names are short, all-lowercase descriptions of the scenario they
cover (e.g. `mixed metrics`, `dense`) rather than realistic tracker names (e.g. "Sleep", "Hours") — so
seeded data is instantly recognizable and never gets mistaken for something you entered by hand.

**Reuse existing data before adding more.** When a feature needs a certain data shape to verify (a
dense chart, a stale last record, a metric type, etc.), check the table below first — there's a good
chance an existing observation or metric already covers it. Only add a new observation or metric when
none of the existing ones can be reasonably extended to cover the new scenario; keeping the dataset
small keeps it easy to reason about and keeps every screen's data fast to eyeball.

## The dataset

Only three scenarios are genuinely observation-level (they depend on facts about *all* of an
observation's metrics or records, not any single metric) and so need their own dedicated observation: an
observation with nothing chartable, a stale last-record date, and having no records at all. Everything
else is per-metric — the details screen renders one independent trend card per Numeric metric — so those
scenarios are combined onto a single `mixed metrics` observation instead of one observation each.

`mixed metrics`, `no numeric` and `stale records` each carry an optional Observation **description**
summarizing what the observation covers and why (`no records` deliberately leaves its empty) so both the
"description shown under the title" and the "no description, no empty gap" states on the details screen
are covered without manual data entry.

| Observation     | Metrics                                              | Record pattern                                     | What it's for                                                                                                                 |
|-----------------|------------------------------------------------------|----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `mixed metrics` | Numeric `dense` (0-100)                              | one point per day, 45 days                         | A densely-populated trend chart                                                                                               |
|                 | Numeric `sparse` (min 0)                             | one point every ~3 days, 60 days                   | A trend chart with visible gaps between points                                                                                |
|                 | Numeric `hourly` (0-100)                             | every 3h over the last 21h, then daily for 12 days | The only metric dense enough to fill the hour-bucketed `1D` window                                                            |
|                 | Numeric `yearly` (min 0)                             | one point every 14 days, 350 days                  | Fills the 30-day-bucketed `1Y` window instead of clumping at its right edge                                                   |
|                 | Numeric `insufficient` (0-100)                       | exactly 1 point, 5 days ago                        | "Not enough data yet" chart state despite a recent last-record time                                                           |
|                 | Boolean `flag`, Enum `category` (a/b/c), Text `note` | shared records, every other day, 20 days           | Non-numeric metrics never chart; one record carrying several value types at once                                              |
| `no numeric`    | Enum `mood` (low/ok/high), Boolean `done`            | shared records, every other day, 8 days            | No Numeric metric at all, so neither the TRENDS section nor the time range selector renders                                   |
| `stale records` | Numeric `value` (min 0)                              | 3 points, all 40-60 days ago                       | "Not enough data yet" at *every* time range (the 3 points share one bucket even at `1Y`) alongside a *stale* last-record time |
| `no records`    | Numeric `value` (min 0)                              | none                                               | "No records yet" everywhere — the true empty state                                                                            |

### Which metric charts at which time range

A trend card needs **two** aggregated points to draw a line; below that it shows "Not enough data yet".
Aggregated point counts per metric on `mixed metrics`, so you know what each time range preset should
look like before you tap it (these are asserted by `devSeedData.test.ts`, so they stay true):

| Metric         | `1D`  | `1W` | `1M` | `1Y`   |
|----------------|-------|------|------|--------|
| `dense`        | 1     | 7    | 30   | 3      |
| `sparse`       | 1     | 3    | 10   | 3      |
| `hourly`       | **7** | 7    | 13   | 2      |
| `yearly`       | 1     | 1    | 3    | **13** |
| `insufficient` | 0     | 1    | 1    | 1      |

Every preset has at least one metric that charts and at least one that doesn't, so a single screen shows
both states side by side at any selection.

## Manual verification checklist

After reseeding, from the observation list screen:

- **`mixed metrics`**, **`no numeric`** and **`stale records`** all show a `Last record: <date/time>` —
  recent for the first two, 40+ days old for the last.
- **`no records`** shows `No records yet`.

Open **`mixed metrics`** details screen (time range selector defaults to `1M`):

- description — small muted text appears under the title, above the METRICS section.
- `dense` — trend chart renders a populated line with visible day-to-day variation.
- `sparse` — trend chart renders with visible gaps between points (not one point per day).
- `hourly` — trend chart renders; the only metric still populated after switching to `1D`.
- `yearly` — trend chart renders from just 3 points at `1M`, and fills out after switching to `1Y`.
- `insufficient` — trend chart shows the `Not enough data yet` empty state.
- `flag`/`category`/`note` — none get a trend card (non-numeric); RECENT RECORDS shows entries with a
  boolean, an enum value, and a note together on the same record.

Still on **`mixed metrics`**, tap through the time range selector and check against the table above:

- `1D` — only `hourly` charts; `dense` and `sparse` drop to `Not enough data yet`.
- `1W` / `1M` — `dense`, `sparse` and `hourly` all chart, at progressively more points.
- `1Y` — `yearly` fills out across the window; `dense` and `sparse` shrink to 3 points bunched at the
  right-hand edge, since all their records fall in the last two months.
- RECENT RECORDS is identical at every selection.

Open **`no numeric`** details screen:

- no TRENDS section and no time range selector appear anywhere on the screen.
- RECENT RECORDS shows entries carrying an enum value and a boolean together.

Open **`stale records`** details screen:

- description — small muted text appears under the title, above the METRICS section.
- `value` — trend chart shows `Not enough data yet` at every time range, including `1Y` (its 3 records
  are close enough together to share a single 30-day bucket); RECENT RECORDS shows entries dated well
  outside the last 30 days.

Open **`no records`** details screen:

- no description text appears under the title, and no empty gap is left in its place.
- RECENT RECORDS shows `No records yet.`
