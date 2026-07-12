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

The dataset is deterministic: the same metric values and the same day-offsets from "now" are generated
every time (see the `SEED` constant in `devSeedData.ts`). Absolute timestamps still shift with "now"
each time you reseed — that's required, since the whole point is for records to land inside the
trend chart's rolling last-30-days window whenever you run it.

**Naming.** Observation and metric names are short, all-lowercase descriptions of the scenario they
cover (e.g. `mixed metrics`, `dense`) rather than realistic tracker names (e.g. "Sleep", "Hours") — so
seeded data is instantly recognizable and never gets mistaken for something you entered by hand.

**Reuse existing data before adding more.** When a feature needs a certain data shape to verify (a
dense chart, a stale last record, a metric type, etc.), check the table below first — there's a good
chance an existing observation or metric already covers it. Only add a new observation or metric when
none of the existing ones can be reasonably extended to cover the new scenario; keeping the dataset
small keeps it easy to reason about and keeps every screen's data fast to eyeball.

## The dataset

Only two scenarios are genuinely observation-level (they depend on facts about *all* of an
observation's records, not any single metric) and so need their own dedicated observation: a stale
last-record date, and having no records at all. Everything else is per-metric — the details screen
renders one independent trend card per Numeric metric — so those scenarios are combined onto a single
`mixed metrics` observation instead of one observation each.

| Observation | Metrics | Record pattern | What it's for |
|---|---|---|---|
| `mixed metrics` | Numeric `dense` (0-100) | one point per day, 45 days | A densely-populated trend chart |
| | Numeric `sparse` (min 0) | one point every ~3 days, 60 days | A trend chart with visible gaps between points |
| | Numeric `insufficient` (0-100) | exactly 1 point, 5 days ago | "Not enough data yet" chart state despite a recent last-record time |
| | Boolean `flag`, Enum `category` (a/b/c), Text `note` | shared records, every other day, 20 days | Non-numeric metrics never chart; one record carrying several value types at once |
| `stale records` | Numeric `value` (min 0) | 3 points, all 40-60 days ago | "Not enough data yet" (0 points fall inside the 30-day chart window) alongside a *stale* last-record time |
| `no records` | Numeric `value` (min 0) | none | "No records yet" everywhere — the true empty state |

## Manual verification checklist

After reseeding, from the observation list screen:

- **`mixed metrics`** and **`stale records`** both show a `Last record: <date/time>` — recent for the
  former, 40+ days old for the latter.
- **`no records`** shows `No records yet`.

Open **`mixed metrics`** details screen:

- `dense` — trend chart renders a populated line with visible day-to-day variation.
- `sparse` — trend chart renders with visible gaps between points (not one point per day).
- `insufficient` — trend chart shows the `Not enough data yet` empty state.
- `flag`/`category`/`note` — none get a trend card (non-numeric); RECENT RECORDS shows entries with a
  boolean, an enum value, and a note together on the same record.

Open **`stale records`** details screen:

- `value` — trend chart shows `Not enough data yet`; RECENT RECORDS shows entries dated well outside
  the last 30 days.

Open **`no records`** details screen:

- RECENT RECORDS shows `No records yet.`
