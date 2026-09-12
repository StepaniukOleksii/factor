# Trend Event Overlay

* 2026-09-11
* Feature: trend-event-overlay.md (new)
* [x] Implemented
* [x] E2E tested

## 1. Goal

A trend card says how a Metric moved. It says nothing about what was going on while it moved, so a fortnight's dip reads
as a dip rather than as the illness behind it. An Event is the app's record of exactly that, and nothing draws one. Draw
the Events falling inside the Trends section's window across every card in it.

## 2. Requirements

* Every Event whose moment falls inside the section's current window draws a marker at that moment on every card that
  draws a chart — at the same position across each, so one marker reads down the whole column.
* A card showing `Not enough data yet` draws no markers.
* Markers are scoped to the window the section is scoped to, a window reached by zooming included, and are re-read
  whenever the section re-reads its Records.
* A marker can be tapped to name what it stands for: one entry per Event, its name over the moment it occurred. An Event
  carrying a description reveals it on a further tap; one carrying none does not open.
* Markers whose tap targets would overlap are drawn as one marker, which names every Event behind it.
* A marker's tap target falls clear of every chart, so a marker takes no tap away from a chart's own marks.
* A marker standing for more Events than fit scrolls them, rather than growing a popover past the screen.
* A window holding no Event leaves every card exactly as tall as it stands with no markers to draw.
* Creating, editing and deleting Events are out of scope — this feature draws Events that already exist, and nothing
  more. So is any control over whether markers show: they are drawn whenever there are Events to draw.

## 3. Technical Design

### 3.1 Domain

No change. An Event already carries the name, moment and optional description this draws and names
([domain-overview.md](../../project/domain-overview.md)), and is owned by nothing, which is what lets one Event stand
over every Observation's charts at once.

### 3.2 Application

`EventRepository` gains `findByTimeRange(range: TimeRange)`: the Events whose `occurredAt` falls in the half-open range
`[range.start, range.end)`, ordered ascending. Half-open and ascending to match `RecordRepository.getByObservationId`,
so one window means the same thing to both queries and an Event sitting exactly on a boundary lands in the same window a
Record there would.

`GetEventsByTimeRangeUseCase` — input a `TimeRange`, returns those Events. It takes no Observation id, and that is the
point: every Observation's charts draw the same set, so no caller has to decide which Events are "its".

### 3.3 Infrastructure

`SQLiteEventRepository` gains the query, filtering on the `occurredAt` column the table already stores as epoch
milliseconds. No schema change and no migration.

### 3.4 Presentation

**Reading the Events.** `ObservationDetailsScreen`'s existing trend fetch reads the Events for the same window it just
read Records over, and holds them beside `chartRecords`. One fetch, one loading path, and the markers arrive with the
cards rather than after them. The cost is one small local query per window change, against a table with no
per-Observation rows in it.

**`EventRules`** (`src/presentation/charts/`) — the drawn half of a marker: one dashed vertical line per Event, from the
band's top to the plot's bottom, at `timeToX(occurredAt, timeRange, plot)`, so a marker sits on the same time scale
every card's marks already sit on. It runs up through the band rather than stopping at the plot's top edge, so it
reaches its own handle: with four of each on a card, a mark floating above a line it does not touch has to be paired off
by eye. Dashed, and in `COLORS.outline` rather than `GRIDLINE_COLOR`: a solid faint vertical line crossing a card of
solid faint horizontal ones reads as one of them.

Each renderer renders it as the **first child of its own `Canvas`**, which is what puts the rules behind that card's
marks — a rule drawn across a dot reads as a defect, and only a draw inside the same canvas can get underneath one.
`ChartRendererProps` gains `events: Event[]`, empty where the window holds none, commented to say that renderers draw
them rather than receive them drawn. A renderer that has already returned `InsufficientData` never reaches the canvas, so the
placeholder card stays clear without a rule of its own saying so.

**The band.** A charting card reserves `EVENT_BAND_HEIGHT` (20px) between the Metric's name and the plot whenever the
window holds at least one Event, and the handles are drawn in it rather than on the chart. Reserved from the Events
rather than always, so an Observation whose window holds none stands exactly as it does today; the cards resize as the
window changes, which is a moment they are already being laid out afresh. It costs the card 8px against the 12px gap it
already kept there, so about 64px down an eight-card section. `toPlotRect` carves it off the top the way it already
carves `PLOT_TOP_PADDING` and `TIME_AXIS_HEIGHT`, so one change to one helper moves every renderer's plot down together
and a renderer added later inherits the band without knowing what it is for. Because the band is the canvas's, each rule
stays one line drawn by one system, running from the band's top through the plot's bottom to meet its own handle. Why
the handle left the plot, why 20px holds a 48px target, and what that height buys back are
[ADR-8](../../adr/8-event-marker-tap-target.md)'s.

**`EventMarkers`** (`src/presentation/charts/`) — the tappable half, and the only part of a marker that is not Skia. An
absolutely positioned layer over the card covering the band and the canvas below it, transparent to touches except at
its handles: a small mark on each rule at the band's top, carrying `TAP_TOLERANCE` on both axes — the same 48x48px box a
Numeric point gets, but biased upward as ADR-8 has it rather than centred: 32px above the mark and 16px below. That
split is the one number here arithmetic cannot settle — the rule runs downward and pulls the aim with it — so it wants
checking on a device before it is fixed.

Handles are grouped where their targets would overlap, one handle standing for every Event in the group. An Event joins
while it falls within a target's width of the group's first, which bounds a group's span at that width however many
Events chain into it — so grouping is a span of time rather than a fixed one, about five days across `1M` and about two
months across `1Y`, and no group ever spreads wider than one target.

**A handle's mark spans the Events it stands for**, from its first rule to its last: a 7px square for a lone Event, a
pill for a group. A square at the group's leftmost would leave every other rule in it ending under nothing, which reads
as a line pointing at a missing mark rather than as a group; the pill's width also says how much time the handle has
swept up. Its target is that pill's box widened to 48px where the pill is narrower, so a lone Event keeps the full box
and a group never offers less. Two groups sit more than a target's width apart at their facing ends by construction, so
the wider targets cannot reintroduce an overlap.

**The rules are not grouped** — each Event draws its own at its true moment, and two a few pixels apart simply coincide
there. Only the targets need separating, and grouping the drawing as well would move a rule off the moment it is
claiming to mark.

**`EventMarkerPopover`** — what a handle opens: one entry per Event it stands for, in the order they occurred, each
carrying the Event's name over the moment `formatRelativeTime` writes for it. A description sits behind an expander on
its own entry and is closed when the popover opens, so the popover arrives two lines tall per Event rather than dropping
a paragraph over the charts, and grows only for the Event actually asked about. Entries are told apart by the space
between them and not by a rule: this floats over a drawing, and every line ruled across it is one more mark over what
the user came to read.

The moment stays on the face rather than going behind the expander with the description. Two Events may carry the same
name — the domain allows it and the seed fixes it in place — so the moment is the only thing on an entry that tells one
from another, which is exactly what a handle standing for several of them has to do.

`EventListScreen` lays an Event out much the same way, and the popover deliberately does not share its tile: a list row
is a browsing target filling a fixed-width card, where this is a transient label that sizes to what it names and floats
over a chart. Sharing them would put a layout switch in one component to serve two unrelated screens. The cost is
accepted rather than denied — an Event is presented in two places, and a change to how one reads has to be made in
both.

The card is sized to what it holds, capped at the screen less a margin either side — wide enough for the longest name
an Event may carry to sit on one line. Folded it is barely wider than that name, so asking what a rule stands for costs
the charts a chip rather than a panel, and a description is what takes it out to the cap. The chevron rides the moment's
line because a card sized to its own contents has no right edge to align one against.

**More Events than fit.** A handle at `1Y` can stand for a season of Events, so the entries scroll inside the card. It
stops growing at about two fifths of the screen's height — seven folded entries on a phone — and is placed so that
height stays on screen; below the cap it hugs its entries and nothing scrolls. Opening an entry grows it inside that
scroll rather than growing the card, and its chevron turning is what confirms the tap when the description lands below
the fold, so nothing has to scroll on the user's behalf.

Rendered in a `Modal` rather than as an absolutely positioned child of the card. An absolute child of one card can paint
beneath a later sibling card on Android, and a popover that vanishes behind the next chart is worse than no popover; a
`Modal` also takes the Android back press in its own window, so it closes without the screen's zoom history hearing the
press — the same property the screen's back handler already depends on for its dialogs ([Trend
Exploration](../../features/trend-exploration.md)).

**Screen state.** Two additions to `ObservationDetailsScreen`, both ordinary local state that survives a Record screen
sitting on top and dies when the screen is popped, which is the visit scoping the window already follows
([ADR-2](../../adr/2-navigation-foundation.md), and the convention in [tech-stack.md](../../project/tech-stack.md)):
the Events read for the current window, and which marker's Events the popover is showing.

## 4. Verification

### Seed Data

None added. The dev seed's Events already cover this exactly — they were built to
([testing-data.md](../../../testing-data.md)). Over `mixed metrics` at the default `1M` window, three fall inside:
`repeated` at 21 days back, `this week` at 3 days, and `today` at 3 hours, the last carrying a description close to the
150-character limit. Those three draw three rules but only two handles: `this week` and `today` fall about 28px apart at
this window, inside one target's width, so they group. At `1Y` the second `repeated`, 240 days back, draws a fourth rule
of its own, and the grouping tightens rather than loosens — a year-wide window puts all three of the others inside one
target, so a single handle stands for the lot. The fifth, `last year` at 400 days back, falls outside every preset, so
it is what shows markers are scoped to the window rather than drawn from the whole store.

### Manual Verification

Reseed test data first.

1. Open `mixed metrics`. Three dashed rules stand on all eight cards — the five Numeric ones, both swimlanes and the
   `note` card, all of which draw at this window — each at the same place across every card, so the three read straight
   down the column. A band sits between every Metric's name and its plot, and each rule starts at a mark in that band
   and runs from there through the plot. Only two marks stand per card against three rules, the right-hand pair sharing
   one.
2. Check a rule passes *behind* the `dense` curve and its dots, and behind `category`'s marks, rather than over them.
   Then tap a `dense` dot that a mark sits directly above: the Record opens as it always did, which is what says the
   band gave the chart its taps back.
3. Tap the leftmost mark, a square standing for one Event. A popover carries `repeated` over when it occurred, and no
   expander beside it — that Event has no description, so there is nothing to open. Dismiss it by tapping outside, then
   again with the back button — neither leaves the window changed.
4. Tap the mark on the right, a pill reaching from one of its rules to the other and standing for two. The popover lists
   `this week` and `today`, oldest first, both closed. Open `today`'s entry: the long description appears below it,
   wrapping rather than clipped, on a card that has widened to hold it, while `this week` stays as it was.
5. Switch to `1Y`. A fourth rule appears well to the left with a mark of its own, and the three on the right now share a
   single mark — a year-wide window puts them all inside one target — whose popover lists `repeated`, `this week` and
   `today` in that order. The fourth mark opens the older `repeated`: the same name the popover beside it carries, told
   apart by the moment on its face. Three is the most the fixtures ever put under one handle, so a popover long enough
   to scroll is left to its component test rather than checked here.
6. Switch to `1D`. Only `today` falls inside, so one rule stands on every card still drawing — and `insufficient`, whose
   own record is outside this window, reads `Not enough data yet` and carries no rule at all.
7. At `1Y`, tap one of `category`'s columns: the section still zooms as it did, and the markers redraw for the narrowed
   window. Back returns to `1Y`, markers with it.
8. Open `Custom` and pick a week no seeded Event falls in — 5 to 15 days back. Every card draws its Records, none draws
   a rule, and no card reserves a band, so each stands exactly as tall as it does with nothing to mark. Tap `1M` and the
   bands come back with the rules.
9. Open `no records`. Its one card is the empty-window placeholder, so it draws no rule and reserves no band even though
   three Events fall in the `1M` window.

### Automated Tests

* **Integration:** `SQLiteEventRepository.findByTimeRange` returns Events inside the window ascending, includes one
  exactly at `start`, excludes one exactly at `end`, and returns empty for a window holding none.
* **Unit:** `GetEventsByTimeRangeUseCase` passes the range through and returns what the repository gives it. The handle
  grouping leaves well-separated Events as separate handles, merges Events whose targets would overlap into one carrying
  both, and chains a run of them into one group while each falls inside a target's width of the group's first, so no
  group spans wider than that. A lone Event's mark is a square and its target the full 48px; a group's mark spans its
  first rule to its last, and its target is that span where it exceeds 48px. `toPlotRect` carves the band off the top
  only when asked for one, and returns the plot it always did when not.
* **Component:** `EventRules` draws one line per Event at the x its moment maps to, and nothing for an empty list. `EventMarkerPopover` opens an Event closed and reveals its
  description when the entry is tapped, offers no expander and no tap for an Event carrying none, renders several Events
  in the order they occurred, and caps its height and scrolls its entries past the point they fit — the case no seeded
  fixture reaches, and so this test's alone.
* **Screen:** `ObservationDetailsScreen` draws markers on every charting card for the Events in its window and none on
  a window holding no Event; reserves the band on a charting card only where there is an Event to mark; passes no Events
  to a renderer showing the placeholder; re-reads Events when the window changes; and opens the popover for the Events a
  handle stands for.

### E2E Flow

A new flow, `flows/trend-event-overlay/trend-event-overlay.yaml` — the capability's first slice, so the folder does not
exist yet. Unlike the charts themselves, most of this is reachable: the handles and the popover are both platform
elements, and only the rules are drawn inside a canvas
([testing-android-e2e.md](../../../testing-android-e2e.md)).

* **Fixture:** `seed`.
* **Covers:** open `mixed metrics` at the default `1M`, tap the handle standing for `this week` and `today`, expand the
  `today` entry, assert the popover carries that Event's description, and dismiss it. The grouped handle rather than a
  lone one: it is the only one at this window carrying a description, and grouping is the ordinary case now.
* **Handles:** each marker handle carries an `accessibilityLabel` — `Event <name>, <moment>` where it stands for one,
  and `<n> events` where it stands for several, which is what this flow taps. A count is the one part of a marker that
  survives a reseed unchanged, where the seeded moments all shift, so the flow matches on that and asserts on the
  `today` Event's description, unique in the fixture set and reachable only once its entry is open. The popover's entry,
  whose whole row is what expands it, needs a label of its own, so tapping it cannot be confused with tapping the handle
  carrying the same Event's name, and reads `<name>, show description` while it is closed. Nothing else on the path is
  new.
