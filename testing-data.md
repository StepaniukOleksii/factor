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
[testing-android-manually.md](testing-android-manually.md#loading-test-data) for how to open the dev menu on-device.

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

Four of `mixed metrics`' metrics carry an optional Metric **description**, each a different length and shape:
one line on `dense`, several lines on `hourly`, close to the 500-character limit on `yearly`, and one line on
the Boolean `flag`. Its other four metrics, and every metric on the other observations, carry none.

Two of `mixed metrics`' records carry an optional Record **note** — free text about that one occasion, which is
not a metric. The most recent sub-day `hourly` record (3 hours back) carries a short single-line one; today's
shared record (09:00, the one `dense`, `flag`, `category` and `note` all write to) carries one close to the
150-character limit containing a line break, so wrapping and newline preservation are both on screen. Every
other seeded record, here and on the other observations, carries none. Those two because RECENT RECORDS shows
the three most recent records and which those are shifts with the hour you reseed: the sub-day one moves with
the clock while today's is pinned at 09:00, so at any time of day the list holds at least one record with a
note and one without. Today's also puts the `note` metric's own value and the record's note on one expanded
card, where nothing should invite confusing them.

| Observation     | Metrics                                              | Record pattern                                     | What it's for                                                                                                                 |
|-----------------|------------------------------------------------------|----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `mixed metrics` | Numeric `dense` (0-100)                              | one point per day, 45 days                         | A densely-populated trend chart                                                                                               |
|                 | Numeric `sparse` (unbounded)                         | one point every ~3 days, 60 days                   | A trend chart with visible gaps between points                                                                                |
|                 | Numeric `hourly` (0-100)                             | every 3h over the last 21h, then daily for 12 days — of which the day 3 back also carries a 09:30 and a 15:00 | The only metric dense enough to fill the hour-bucketed `1D` window; its extra day-3 pair is the only hour anywhere holding two Records |
|                 | Numeric `yearly` (min 0)                             | one point every 14 days, 350 days                  | Fills the 30-day-bucketed `1Y` window instead of clumping at its right edge                                                   |
|                 | Numeric `insufficient` (max 100)                     | exactly 1 point, 5 days ago                        | Both sides of the placeholder-vs-dot boundary: "Not enough data yet" at `1D`, a single dot at every wider preset             |
|                 | Boolean `flag`, Enum `category` (a/b/c), Text `note` | shared records, every other day, 20 days           | Non-numeric metrics never chart; one record carrying several value types at once                                              |
| `no numeric`    | Enum `mood` (low/ok/high), Boolean `done`            | shared records, every other day, 8 days            | No Numeric metric at all, so neither the TRENDS section nor the time range selector renders                                   |
| `stale records` | Numeric `value` (min 0)                              | 3 points, all 40-60 days ago                       | "Not enough data yet" at `1D`/`1W`/`1M`, and a single dot labelled "3" at `1Y` (where the 3 points share one bucket), alongside a *stale* last-record time |
| `no records`    | Numeric `value` (min 0)                              | none                                               | "No records yet" everywhere — the true empty state                                                                            |

### Which metric charts at which time range

A trend card draws a line from **two** aggregated points upwards, a single dot (no line, no gradient
fill) at exactly **one**, and "Not enough data yet" only at **zero**. Aggregated point counts per metric
on `mixed metrics`, so you know what each time range preset should look like before you tap it (these
are asserted by `devSeedData.test.ts`, so they stay true):

| Metric         | `1D`  | `1W` | `1M` | `1Y`   |
|----------------|-------|------|------|--------|
| `dense`        | 1     | 7    | 30   | 3      |
| `sparse`       | 1     | 3    | 10   | 3      |
| `hourly`       | **7** | 7    | 13   | 2      |
| `yearly`       | 1     | 1    | 3    | **13** |
| `insufficient` | 0     | 1    | 1    | 1      |

Every preset has at least one metric that charts and at least one that doesn't, so a single screen shows
both states side by side at any selection.

`hourly`'s extra day-3 Records share a day with one it already had, so they change none of these counts —
they only show up once a chart is zoomed down to that day, where the two inside 09:00-10:00 stay folded
into one aggregated point while the 15:00 one gives the chart a second point beside it. That is the shape
zoom comes to rest on, and the only place in the dataset it can be reached by hand.

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
- `insufficient` — trend chart shows a single dot, vertically centred on the axes, with no line and no
  gradient fill (its one record falls inside the 30-day window).
- `flag`/`category`/`note` — none get a trend card (non-numeric); RECENT RECORDS shows entries with a
  boolean, an enum value, and a note together on the same record.
- record notes — under RECENT RECORDS at least one collapsed row shows a note glyph beside its time and at
  least one shows none, with no gap in its place and no difference in row height. Expanding the noted row
  that also holds a value for the `note` metric shows that metric's `NOTE` chip in the horizontal strip
  and the record's own note as a wrapping paragraph below it; the longer note is not truncated and its
  line break shows as a line break. Expanding an un-noted row leaves nothing where the paragraph would be.

Still on **`mixed metrics`**, tap through the time range selector and check against the table above:

- `1D` — only `hourly` draws a line; `dense` and `sparse` drop to a single dot each, and `insufficient`
  (its one record is 5 days old, outside this window) is the only `Not enough data yet` on the screen.
- `1W` / `1M` — `dense`, `sparse` and `hourly` all chart, at progressively more points.
- `1Y` — `yearly` fills out across the window; `dense` and `sparse` shrink to 3 points bunched at the
  right-hand edge, since all their records fall in the last two months.
- RECENT RECORDS is identical at every selection.

Still on **`mixed metrics`**, tap **Add Record** (and again via **Edit Record** — identical on both routes):

- `dense`, `hourly`, `yearly` and `flag` show a description info button beside their label; the other four
  show none, and leave no gap where one would be.
- every shape a Numeric bound comes in is on this one form, stated by each empty input: `0-100` on `dense`
  and `hourly`, `Min 0` on `yearly`, `Max 100` on `insufficient`, and no placeholder at all on the unbounded
  `sparse`, which leaves no gap where one would be.
- `category` reads `None` in a field carrying a chevron, which opens a list of `None`, `a`, `b` and `c` with
  `None` ticked — while `flag` beside it still shows Yes/No segments and `note` is still a text field.
- Each button opens a dialog headed by its metric's name — `hourly`'s keeps its line breaks, `yearly`'s
  longest body fits or scrolls without clipping.
- a NOTE field comes last, below a rule and outside any metric card, and carries no info button. On the
  edit route it is pre-populated from the record; typing past 150 characters stops the input and leaves
  the counter reading "150/150".

Open **`no numeric`** details screen:

- no TRENDS section and no time range selector appear anywhere on the screen.
- RECENT RECORDS shows entries carrying an enum value and a boolean together.

Still on **`no numeric`**, tap **Add Record** (and again via **Edit Record** — identical on both routes):

- `mood` reads `None` on the create route and the stored value on the edit route. Opening it lists `None`,
  `low`, `ok` and `high`, in that order, with the current one ticked; choosing `None` returns it to unanswered,
  and saving with nothing chosen is accepted.
- `done` beneath it still shows Yes/No segments — two answers fit a row where three do not.
- neither metric renders a text input; the only one on the screen is the NOTE field below the rule.

Open **`stale records`** details screen:

- description — small muted text appears under the title, above the METRICS section.
- `value` — trend chart shows `Not enough data yet` at `1D`, `1W` and `1M` (all 3 records fall outside
  those windows), and a single dot carrying a `3` count label at `1Y`, where those records are close
  enough together to share a single 30-day bucket; RECENT RECORDS shows entries dated well outside the
  last 30 days.

Open **`no records`** details screen:

- no description text appears under the title, and no empty gap is left in its place.
- RECENT RECORDS shows `No records yet.`
