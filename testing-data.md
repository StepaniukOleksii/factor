# Test data seeding

## Purpose

Factor is local-first: every observation, metric, and record lives in on-device SQLite, and there's no server-side
fixture data to fall back on. Verifying charts, "last record" states, and empty states by hand means re-creating
observations and records through the UI every time the app's data is cleared — slow, and easy to skip the
annoying-to-set-up edge cases (a chart with real history, a chart with too little data, an observation with no records
at all).

`reseedDevData()` (in [`src/infrastructure/devSeed.ts`](src/infrastructure/devSeed.ts)) fixes that: it wipes the
database and inserts a fixed dataset built by [`src/infrastructure/devSeedData.ts`](src/infrastructure/devSeedData.ts),
covering the scenarios below. It's dev-only — wired to a **"Reseed test data"** item in the dev-client menu, gated by
`__DEV__` (see `App.tsx`), so it never runs in a release build. See
[testing-android-manually.md](testing-android-manually.md#loading-test-data) for how to open the dev menu on-device.

**This is destructive.** Reseeding deletes every existing observation (and its metrics/records) before inserting the
fixture set — don't run it if you have manually-entered data on the device you want to keep.

The dataset is deterministic: the same metric values and the same offsets from "now" are generated every time (see the
`SEED` constant in `devSeedData.ts`). Absolute timestamps still shift with "now" each time you reseed — that's required,
since the whole point is for records to land inside whichever rolling trend-chart window is selected whenever you run
it. Every daily record is anchored to **09:00**, or to the current hour when you reseed before nine — an anchor past the
current instant would date today's records into the future, outside every window, and cost each chart its newest bucket.

**Naming.** Observation and metric names are short, all-lowercase descriptions of the scenario they cover (e.g. `mixed
metrics`, `dense`) rather than realistic tracker names (e.g. "Sleep", "Hours") — so seeded data is instantly
recognizable and never gets mistaken for something you entered by hand.

**Reuse existing data before adding more.** When a feature needs a certain data shape to verify (a dense chart, a stale
last record, a metric type, etc.), check the table below first — there's a good chance an existing observation or metric
already covers it. Only add a new observation or metric when none of the existing ones can be reasonably extended to
cover the new scenario; keeping the dataset small keeps it easy to reason about and keeps every screen's data fast to
eyeball.

## The dataset

Only three scenarios are genuinely observation-level (they depend on facts about *all* of an observation's metrics or
records, not any single metric) and so need their own dedicated observation: an observation charting no Numeric metric,
a stale last-record date, and having no records at all. Everything else is per-metric — the details screen renders one
independent trend card per metric whose type something can draw — so those scenarios are combined onto a single `mixed
metrics` observation instead of one observation each.

No seeded observation hides the TRENDS section, and none could: every metric type charts, so the only observation
without the section is one carrying no metrics at all — which observation creation refuses. That guard is covered by an
`ObservationDetailsScreen` test instead of a fixture.

The **zoom ladder** is the one per-metric scenario deliberately kept off `mixed metrics`. Zooming is driven by tapping a
chart, and a tap has to find a point rather than the canvas holding it — so a fixture for it has to be an observation
with a single Numeric metric, where there is exactly one canvas and no need to pick between them. `stale records`
already was that observation, and already folded its records into one 30-day bucket at `1Y`, which is the ladder's first
rung; it holds the rest of the ladder rather than a sixth `mixed metrics` metric that no tap could reliably find.

`mixed metrics`, `no numeric` and `stale records` each carry an optional Observation **description** summarizing what
the observation covers and why (`no records` deliberately leaves its empty) so both the "description shown under the
title" and the "no description, no empty gap" states on the details screen are covered without manual data entry. `mixed
metrics`' runs to exactly the 150-character limit, so the longest one the details screen and the edit form can hold is
on screen every time the fixtures are reseeded. Nothing judges seeded data on its way in — the seed calls the repository
directly — so `devSeedData.test.ts` asserts every name and description against its limit.

Four of `mixed metrics`' metrics carry an optional Metric **description**, each a different length and shape: one line
on `dense`, several lines on `hourly`, close to the 500-character limit on `yearly`, and one line on the Boolean `flag`.
Its other four metrics, and every metric on the other observations, carry none.

Two of `mixed metrics`' records carry an optional Record **note** — free text about that one occasion, which is not a
metric. The most recent sub-day `hourly` record (3 hours back) carries a short single-line one; today's shared record
(the one `dense`, `flag`, `category` and `note` all write to) carries one close to the 150-character limit containing a
line break, so wrapping and newline preservation are both on screen. Every other seeded record, here and on the other
observations, carries none. Those two because RECENT RECORDS shows the three most recent records and which those are
shifts with the hour you reseed: the sub-day one moves with the clock while today's sits at the anchor hour, so at any
time of day the list holds at least one record with a note and one without. Today's also puts the `note` metric's own
value and the record's note on one expanded card, where nothing should invite confusing them.

Each observation also states **when it was created**, backdated to before its own oldest record rather than left at the
moment the seed ran — four observations built in one pass would otherwise share a millisecond and leave the list's
newest-first order to break the tie. The dates below are what the details screen reads, and they fix the order the list
shows the four in:

| Observation     | Created        | Records                                                              |
|-----------------|----------------|----------------------------------------------------------------------|
| `no records`    | today          | 0                                                                    |
| `no numeric`    | 30 days ago    | 5                                                                    |
| `stale records` | 90 days ago    | 4                                                                    |
| `mixed metrics` | 365 days ago   | 82 — 81 when the reseed ran at an hour that put one of `hourly`'s sub-day records on the anchor hour already holding one |

| Observation     | Metrics                                              | Record pattern                                     | What it's for                                                                                                                 |
|-----------------|------------------------------------------------------|----------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `mixed metrics` | Numeric `dense` (0-100)                              | one point per day, 45 days                         | A densely-populated trend chart                                                                                               |
|                 | Numeric `sparse` (unbounded)                         | one point every ~3 days, 60 days                   | A trend chart with visible gaps between points                                                                                |
|                 | Numeric `hourly` (0-100)                             | every 3h over the last 21h, then daily for 12 days — of which the day 3 back also carries a second Record half an hour after its own and a third six hours later | The only metric dense enough to fill the hour-bucketed `1D` window; its extra day-3 pair is the only hour anywhere holding two Records |
|                 | Numeric `yearly` (min 0)                             | one point every 14 days, 350 days                  | Fills the 30-day-bucketed `1Y` window instead of clumping at its right edge                                                   |
|                 | Numeric `insufficient` (max 100)                     | exactly 1 point, 5 days ago                        | Both sides of the placeholder-vs-dot boundary: "Not enough data yet" at `1D`, a single dot at every wider preset             |
|                 | Boolean `flag`, Enum `category` (a/b/c/d), Text `note` | shared records, every other day, 20 days           | Two swimlane cards interleaved after the Numeric ones — a two-lane one and a four-lane one, so the shortest and the tallest card in the section, a swimlane being as tall as its lanes — and `note`'s marker card, shorter than either, below them; one record carrying several value types at once |
| `no numeric`    | Enum `mood` (low/ok/high), Boolean `done`            | shared records, every other day, 8 days            | No Numeric metric at all, so the whole TRENDS section is two swimlanes — a three-lane Enum one over a two-lane Boolean one, a lane shorter |
| `stale records` | Numeric `value` (min 0)                              | 4 Records across 3 days, all 40-60 days ago — the middle day carrying two of them half an hour apart | "Not enough data yet" at `1D`/`1W`/`1M`, and a single dot labelled "4" at `1Y` (where all four share one bucket), alongside a *stale* last-record time; also the one zoom ladder a chart tap can descend twice |
| `no records`    | Numeric `value` (min 0)                              | none                                               | "No records yet" everywhere — the true empty state                                                                            |

### Which metric charts at which time range

A Numeric trend card draws a line from **two** aggregated points upwards, a single dot (no line, no gradient fill) at
exactly **one**, and "Not enough data yet" only at **zero**. An Enum or Boolean card draws a column of marks per point
instead — one per value recorded in that bucket, as tall as the records behind it against the card's own busiest mark —
and the same placeholder at zero. Its height comes from the values its metric declares rather than from the ones its
records took, so `category` stands four lanes tall at every preset, including one where only two values were recorded. A
Text card draws one mark per point on a rule across its middle, every mark the same size, and the placeholder at zero.
Aggregated point counts per metric on `mixed metrics`, so you know what each time range preset should look like before
you tap it (these are asserted by `devSeedData.test.ts`, so they stay true):

| Metric              | `1D`  | `1W` | `1M` | `1Y`   |
|---------------------|-------|------|------|--------|
| `dense`             | 1     | 7    | 30   | 3      |
| `sparse`            | 1     | 3    | 10   | 3      |
| `hourly`            | **7** | 7    | 13   | 2      |
| `yearly`            | 1     | 1    | 3    | **13** |
| `insufficient`      | 0     | 1    | 1    | 1      |
| `flag` (Boolean)    | 1     | 4    | 10   | 2      |
| `category` (Enum)   | 1     | 4    | 10   | 2      |
| `note` (Text)       | 1     | 4    | 10   | 2      |

Every preset has at least one metric that charts and at least one that doesn't, so a single screen shows both states
side by side at any selection.

`flag`, `category` and `note` share records sitting at the anchor hour on alternate days, and a 24-hour window holds
exactly one of those — so at `1D` each draws a single mark. The same is true of `no numeric`'s `mood` and `done`, which
share records on the same schedule and draw 5 marks at `1M` and 2 columns at `1Y`.

`hourly`'s extra day-3 Records share a day with one it already had, so they change none of these counts — they only show
up once a chart is zoomed down to that day, where the two inside the anchor hour stay folded into one aggregated point
while the third gives the chart a second point beside it. That is the shape zoom comes to rest on, reached here by
picking the day out by hand — `stale records` is where it can be reached by tapping, and the two differ in what the
resting day still has left to draw.

### Events

Five Events are seeded beside the observations and belong to none of them — an Event is owned by nothing. Their names
say when each one falls, the way an observation's says what it covers.

| Event       | Occurred     | Description                 | What it's for                                                                            |
|-------------|--------------|-----------------------------|------------------------------------------------------------------------------------------|
| `today`     | 3 hours ago  | close to the 150-char limit | The longest body an Event can hold, and a moment reading `Today, HH:MM`                  |
| `this week` | 3 days ago   | none                        | A moment written as a weekday, and the no-description state                               |
| `repeated`  | 21 days ago  | none                        | One of two Events sharing a name, so nothing downstream takes a name for an identity      |
| `repeated`  | 240 days ago | one line                    | The older of that pair, and the only Event inside the `1Y` chart window but outside `1M`  |
| `last year` | 400 days ago | none                        | A date written with its year, whatever day the fixtures are reseeded on                   |

No Event is dated in the future, and every preset chart window holds at least one — both asserted by
`devSeedData.test.ts`, as is the pair of names and the Event in an earlier calendar year.

## Manual verification checklist

After reseeding, from the observation list screen:

- the four read newest-created first: **`no records`**, **`no numeric`**, **`stale records`**, **`mixed metrics`** — the
  order their creation dates above fix.
- **`mixed metrics`**, **`no numeric`** and **`stale records`** all show a `Last record: <date/time>` — recent for the
  first two, 40+ days old for the last.
- **`no records`** shows `No records yet`.

Open **`mixed metrics`** details screen (time range selector defaults to `1M`):

- description — small muted text appears under the title, above the METRICS section.
- `dense` — trend chart renders a populated line with visible day-to-day variation.
- `sparse` — trend chart renders with visible gaps between points (not one point per day).
- `hourly` — trend chart renders; the only metric still populated after switching to `1D`.
- `yearly` — trend chart renders from just 3 points at `1M`, and fills out after switching to `1Y`.
- `insufficient` — trend chart shows a single dot, vertically centred on the axes, with no line and no gradient fill
  (its one record falls inside the 30-day window).
- `flag` — a swimlane card *after* the five Numeric ones and *before* `category`, in declaration order, and the shortest
  card in the section at two lanes — shorter than the Numeric ones above it: two lanes labelled `Yes` above `No` — the
  words and the order the Record form's own segments carry — and ten marks in the newer two-thirds of the window, each
  filling one lane or the other. A `Yes` mark is the darker green. Its plot starts on the same left edge as every other
  card in the section — the five Numeric ones above it and `category` below — since every chart reserves one gutter of
  the same width.
- `category` — a swimlane card after `flag`, and the tallest on the screen at four lanes: labelled `a`, `b`, `c`, `d`
  top to bottom — the order the Record form lists them in — ten marks in the newer two-thirds of the window each filling
  its lane, and lane separators but no value labels down the left. A lane here is the same height as one on `flag`, the
  card carrying two more of them rather than dividing the same box further. An `a` mark is the darkest green and a `d`
  mark the lightest. Tapping a column on either card reaches the bucket behind it, as a tap on a Numeric point does: at
  `1M` every column stands for one record, so a tap opens that record for editing, carrying every metric it answered
  rather than the card's own alone. A tap in the empty older third of either plot, clear of every column, leaves the
  card as it is.
- `note` — a marker card after `category`, and still the shortest card in the section now that the two swimlanes above
  it differ in height: ten marks on a rule across its middle, all the same size, sitting at the same positions across
  the card as `category`'s ten columns do. Its plot starts on that same left edge, its gutter carries no labels, and its
  time labels read as theirs do. Tapping a mark reaches the bucket behind it as a tap on a column or a point does: at
  `1M` every mark stands for one record, so a tap opens that record for editing, carrying its `flag` answer and
  `category` value beside its own text. A tap on the empty rule between two marks leaves the card as it is, and a tap at
  the card's top or bottom edge over a mark still opens it — the card is shorter than the target is tall. RECENT RECORDS
  shows entries with a boolean, an enum value, and a note together on the same record.
- record notes — under RECENT RECORDS at least one collapsed row shows a note glyph beside its time and at least one
  shows none, with no gap in its place and no difference in row height. Expanding the noted row that also holds a value
  for the `note` metric shows that metric's `NOTE` chip in the horizontal strip and the record's own note as a wrapping
  paragraph below it; the longer note is not truncated and its line break shows as a line break. Expanding an un-noted
  row leaves nothing where the paragraph would be.

Still on **`mixed metrics`**, tap through the time range selector and check against the table above:

- `1D` — only `hourly` draws a line; `dense` and `sparse` drop to a single dot each, and `flag`, `category` and `note`
  to a single mark each — `flag` still the short card and `category` the tall one, a swimlane's height coming from its
  lanes rather than from what it drew. `insufficient` (its one record is 5 days old, outside this window) shows `Not
  enough data yet`, its placeholder standing in a card of exactly the height that card's chart is drawn in, so nothing
  below it moves.
- `1W` / `1M` — `dense`, `sparse` and `hourly` all chart, at progressively more points.
- `1Y` — `yearly` fills out across the window; `dense` and `sparse` shrink to 3 points bunched at the right-hand edge,
  since all their records fall in the last two months. `flag` and `category` each collapse to two columns at that edge —
  one standing for seven records and one for three — each carrying a mark per value recorded in it, sized by how many
  records took that value: the commonest fills its lane and the rest are shorter in proportion, so the three-record
  column carries visibly less ink than the seven-record one. `note` collapses to the same two marks, carrying `7` and
  `3` above them — the totals `category`'s columns divide between their lanes, written the way a Numeric card writes an
  aggregated point's count — and its card stays the height it was. Every Numeric chart is exactly as before — curve,
  gradient fill, axes, dots, count labels. Tapping either of `category`'s columns, or the `note` mark labelled `7`
  beneath it, narrows the whole section onto the days behind it — the five Numeric cards above follow it into that
  window rather than staying at `1Y`, and `note` redraws those seven as marks of their own — and back once returns every
  card to `1Y`.
- RECENT RECORDS is identical at every selection.

Still on **`mixed metrics`**, tap **Add Record** (and again via **Edit Record** — identical on both routes):

- `dense`, `hourly`, `yearly` and `flag` show a description info button beside their label; the other four show none,
  and leave no gap where one would be.
- every shape a Numeric bound comes in is on this one form, stated by each empty input: `0-100` on `dense` and `hourly`,
  `Min 0` on `yearly`, `Max 100` on `insufficient`, and no placeholder at all on the unbounded `sparse`, which leaves no
  gap where one would be.
- `category` reads `None` in a field carrying a chevron, which opens a list of `None`, `a`, `b`, `c` and `d` with `None`
  ticked — while `flag` beside it still shows Yes/No segments, the words its chart labels its lanes with, and `note` is
  still a text field.
- Each button opens a dialog headed by its metric's name — `hourly`'s keeps its line breaks, `yearly`'s longest body
  fits or scrolls without clipping.
- a NOTE field comes last, below a rule and outside any metric card, and carries no info button. On the edit route it is
  pre-populated from the record; typing past 150 characters stops the input and leaves the counter reading "150/150".

Open **`no numeric`** details screen:

- a TRENDS section and its time range selector appear, holding a card titled `mood` and a card titled `done` below it.
  `mood`: three lanes labelled `low`, `ok`, `high` top to bottom — the order the Record form lists them in — five marks
  each filling its lane, and lane separators but no value labels down the left. A `low` mark is the darkest green and a
  `high` mark the lightest. `done`: two lanes labelled `Yes` above `No`, five marks each filling one lane or the other,
  `Yes` the darker green. `mood` stands one lane taller than `done`, having one more value to answer for, and a lane on
  either card is the same height. Both plots start on the same left edge, and no label on either card is cut short.
- RECENT RECORDS and its first records are still on the first screen, below both cards.
- at `1Y` each card's five marks collapse into two columns near the right edge, each carrying a mark per value recorded
  in it. On `mood` no value repeats within either bucket, so every mark still fills its lane and the columns differ in
  how many lanes they occupy rather than in height; on `done` a mark is as tall as the records that gave that answer, so
  an answer given twice where the other was given once draws twice the lane, and only where a column splits evenly do
  its two marks match. At `1D`, a single mark on each — the anchor-hour rule above.
- RECENT RECORDS shows entries carrying an enum value and a boolean together.

Still on **`no numeric`**, at the default `1M`, tap the cards themselves — the same act as tapping a Numeric point, on a
card that draws columns instead. A column is tapped anywhere down its height, and a tap reaches one only from within
24px of its middle:

- tap one of `mood`'s five marks — the record behind it opens for editing, carrying both that mark's `mood` value and
  the same record's `done` answer.
- cancel back, then tap the empty stretch midway between two marks — nothing moves and the selector still reads `1M`.
- tap near the top of the `mood` card, directly above one of its marks rather than on it — the same record opens.
- at `1Y`, tap the older and wider of `done`'s two columns — every card in the section narrows to the days behind it,
  `mood` included, and the selector's last segment shows that range in place of the word `Custom`. Back once returns
  both cards to `1Y`.

Still on **`no numeric`**, tap **Add Record** (and again via **Edit Record** — identical on both routes):

- `mood` reads `None` on the create route and the stored value on the edit route. Opening it lists `None`, `low`, `ok`
  and `high`, in that order, with the current one ticked; choosing `None` returns it to unanswered, and saving with
  nothing chosen is accepted.
- `done` beneath it still shows Yes/No segments — two answers fit a row where three do not.
- neither metric renders a text input; the only one on the screen is the NOTE field below the rule.

Open **`stale records`** details screen:

- description — small muted text appears under the title, above the METRICS section.
- `value` — trend chart shows `Not enough data yet` at `1D`, `1W` and `1M` (all 4 records fall outside those windows),
  and a single dot carrying a `4` count label at `1Y`, where those records are close enough together to share a single
  30-day bucket; RECENT RECORDS shows entries dated well outside the last 30 days.

Still on **`stale records`**, at `1Y`, tap the dot itself, about four-fifths across — the zoom ladder, and the only
place in the dataset it can be walked by tapping. A tap reaches a point only from within 24px of it on both axes, so
tapping the empty stretch left of the dot does nothing and leaves the selector reading `1Y`:

- one tap on the dot — the window narrows to the ~17 days the four records span, the time range selector's last segment
  shows that range in place of the word `Custom`, and the chart draws three points: a low one, a middle one standing for
  the two records half an hour apart, and a high one.
- a second tap, on that middle point — the window narrows again, to the single day those two share, where they fold into
  one dot.
- a third tap on it — nothing moves. A day is as narrow as zoom goes, so the window it would open is the one already on
  screen.
- back three times — the ~17-day window, then `1Y`, then the observation list. Each press undoes one step.

Open **`no records`** details screen:

- no description text appears under the title, and no empty gap is left in its place.
- RECENT RECORDS shows `No records yet.`
