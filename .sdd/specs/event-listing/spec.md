# Event Listing

* 2026-09-09
* Feature: event-listing.md (new), [home-navigation.md](../../features/home-navigation.md)
* [x] Implemented
* [x] E2E tested

## 1. Goal

An Event is stored, seeded and read by nothing. The app has no screen that shows one, so the concept exists in the
database and nowhere a user can look. Give Events a screen of their own, reached from Home.

## 2. Requirements

* Home carries a second destination, `Events`, below `Observations`, which opens the Event list.
* The Event list shows stored Events most recently occurred first, twenty at a time.
* Every tile stands the same height, carrying the Event's name and when it occurred.
* A tile whose Event has a description opens on tap to show it, and closes on a second tap. Only one tile is open at a
  time. A tile whose Event has no description does not open, and carries no control suggesting it would.
* A moment falling outside the last week is written with its year when that year is not the current one, and without a
  year when it is.
* `Load more` sits below the last tile while Events remain unshown, and adds twenty more each time it is pressed. It is
  not on screen when everything stored is already listed.
* The list reads `No events yet.` when nothing is stored, and the same when the read fails.
* A spinner holds the screen while the list is first read. Returning to the screen re-reads it, keeping however many
  Events were on it.
* Pressing back from the Event list returns to Home.
* No tile navigates anywhere, and nothing on the screen creates, edits or deletes an Event. Opening and closing a
  description is the whole of what a tap does.

## 3. Technical Design

### 3.1 Domain

No change. `Event` and the two limits in `validationLimits.ts` already carry everything this reads.

That file's comment on the Event limits — "no form or use case reads an Event yet" — stops being true here while its
point does not: a use case reads Events from this slice on, and still nothing enforces a limit, because nothing writes
one. Reword it to name the writer that is missing rather than the reader that now exists.

### 3.2 Application

`GetEventsUseCase` — takes `limit: number`, returns the Events and whether more are stored beyond them.

It asks the repository for `limit + 1` and returns the first `limit`, treating the extra row's arrival as `hasMore`.
That is one query rather than a page plus a `COUNT`, and it answers the only question the screen has: whether to draw
the button.

### 3.3 Infrastructure

`EventRepository` gains `findRecent(limit: number)` — most recently occurred first, at most `limit` — implemented in
`SQLiteEventRepository` as the existing `findAll` query with a `LIMIT`. `findAll` stays: `clearDevData` reads every
Event to delete it.

No schema change. The fixture set gains an Event — see [Seed Data](#seed-data).

### 3.4 Shared

`formatRelativeTime` gains a year. Its final branch — a date outside the last week — renders `Sep 3, 09:00` today, which
is unambiguous for the three newest Records ([Record Listing](../../features/record-listing.md)) and wrong for Events,
which reach back years. That branch carries the year when the date's year is not the current one.

The three branches above it are untouched: a date three days back that happens to sit in the previous year still reads
as a weekday, because `Sun, 09:00` said of last Sunday needs no year.

`formatShortDate` in `formatTimeRange.ts` documents itself as mirroring how `formatRelativeTime` renders dates. It now
mirrors the same-year case only — chart axis labels stay year-less — so that comment narrows to say so.

### 3.5 Presentation

**Routes.** `EventList: undefined` in `RootStackParamList`, registered in `AppNavigator` beside `ObservationList`.

**`HomeScreen`.** A second destination row, `Events`, carrying MaterialIcons `flag` — the shape the Events overlay will
later draw over a trend chart, where `event`'s calendar would say scheduling. The row markup is now written twice, so it
becomes a file-private component in `HomeScreen.tsx`, taking the icon, the label and the press handler. It stays in that
file: nothing else in the app lists destinations.

**`EventListScreen`** (`src/presentation/screens/EventListScreen.tsx`), modelled on `ObservationListScreen`: a
module-level repository and use case, `useFocusEffect` reloading on focus, `CenteredState` while the first read runs, a
`FlatList` with a `ListEmptyComponent`. A failed read is logged and leaves the list empty, which puts `No events yet.`
on screen — the same answer [Observation Listing](../../features/observation-listing.md) gives a failed read, and honest
here in a way it would not be for a screen offering an action.

**Paging by a growing window, not by offset.** The screen holds one number — how many Events it is asking for, starting
at `EVENT_PAGE_SIZE` of 20, which is about two screens of tiles. `Load more` raises it by another 20 and re-reads from
the top rather than fetching the next page and appending. Re-reading a few dozen rows from local SQLite costs nothing
measurable, and it removes the class of bug where an Event created or deleted between two reads duplicates a row or
hides one. The focus refresh then needs no special case: it re-reads the same window, so an Event added or removed above
the list appears or disappears without the screen falling back to its first page.

**The tile.** A card carrying the Observation card's container tokens, with the name on the first line and the moment
beneath it in the muted small style, so every collapsed tile stands two lines tall whatever it holds. Where the Event
has a description, a chevron sits at the right of the card and the whole card toggles on press — `expand-more` closed,
`expand-less` open, and the description below the header when open. This follows the Record tile in [Record
Listing](../../features/record-listing.md), including one open at a time through a single `expandedEventId`, with three
differences: the closed chevron points down rather than right, because a right chevron is what Home's rows use for going
somewhere while this opens in place; the card keeps its container in both states, because these tiles are a screen's
whole content rather than rows inside another screen's section; and a tile with nothing to show carries no chevron and
does not respond, since the pressable region would open nothing.

The expanded description is shown in full — nothing else in the app shows an Event, and no detail view for one is
planned, so a truncation would cut the only copy. At its 150-character limit it runs to about three lines.

**`Load more`** is the `FlatList`'s footer, drawn only while the last read reported more: a full-width control outlined
in `primaryContainer` with its label in the same colour over no fill, which is the treatment the Observation card's `+`
already carries for an action that is not its screen's primary one. The green fills belong to the primary call to action
— `PrimaryActionButton`, the FAB, a dialog's confirm — and loading more of what is already stored is not that; nor is it
`DashedButton`, whose dashes and `+` say "append another field to this form". It stays local to the screen rather than
joining `components/` — nothing else in the app loads more of anything, and the second screen that needs one is what
should lift it out. While the wider read runs the button is disabled and dimmed as `PrimaryActionButton` is, and the
tiles already on screen stay put; the full-screen spinner belongs to the first read alone. A failed read leaves the list
as it stands with the button still there to press again.

## 4. Verification

### Seed Data

`buildEventSeedData()` gains a fifth Event, `last year`, 400 days back and undescribed.

The four already seeded cannot show a year-carrying date reliably: the oldest sits 240 days back, which lands in the
previous calendar year only when the fixtures are reseeded in roughly the first eight months of a year. An Event more
than a full year back always does, at any reseed date. It is deliberately not a change to the 240-day Event, which is
the one holding the `1Y` chart window that the later overlay slice needs.

`devSeedData.test.ts` counts the Events and the described ones among them, so both expectations move to five and two. It
already asserts fixture properties across a set of seeded hours; the year-crossing property is asserted the same way —
at every seeded hour, at least one Event falls in a different calendar year from now.

Five Events is under one page, deliberately: `Load more` is a property of a list longer than the fixture set, and
seeding twenty-one Events to cross the boundary would trade a dataset that stays easy to eyeball for a case a screen
test covers in a line. What the fixtures verify about it is that it does not appear.

[testing-data.md](../../../testing-data.md) documents no Event at all, though four have been seeded and inserted by
`reseedDevData()` since before this slice. It gains a short **Events** section: the five, when each occurred, and what
each covers — the two description states, the shared name, the `1Y` window, and the year-carrying date.

### Manual Verification

Reseed test data first.

1. Launch the app: Home carries two rows, `Observations` above `Events`.
2. Tap `Events`: five Events, newest first — `today`, `this week`, `repeated`, `repeated`, `last year`. Every tile
   stands the same height, and no `Load more` is on screen.
3. The moments read `Today, HH:MM` for `today`, a weekday for `this week`, a month and day with no year for the
   21-day-old `repeated`, and a date carrying its year for `last year`.
4. `today` and the older `repeated` carry a chevron; the other three do not, and do not respond to a tap.
5. Tap `today`: its description opens in full. Tap the older `repeated`: it opens and `today` closes. Tap it again: it
   closes.
6. Press back: Home. Press back again: the app closes.

The empty state and `Load more` have no path by hand short of a fresh install or twenty-one Events, so both are left to
the screen tests and, for the empty state, the flow below.

### Automated Tests

* **Unit:** `GetEventsUseCase` returns at most the Events asked for, reports `hasMore` when the repository has one
  beyond them and not when it has exactly as many, and returns an empty list unchanged.
* **Unit:** `SQLiteEventRepository.findRecent` returns the newest Events up to the limit, in occurrence order.
* **Unit:** `formatRelativeTime` carries the year for a date outside the last week in another year, leaves a same-year
  date outside the last week year-less, and keeps the `Today` / `Yesterday` / weekday wording for a date within the last
  week that falls in another year.
* **Unit:** `devSeedData` seeds five Events, two of them described, with at least one in a different calendar year from
  now at every seeded hour.
* **Screen:** `EventListScreen` renders a tile per Event carrying its name and moment; opens a described Event's tile on
  press and closes it on a second press; opens only one at a time; leaves an undescribed Event's tile unpressable and
  chevron-less; shows `No events yet.` for an empty read and for a failed one; shows the spinner while first reading;
  re-reads on focus for however many Events are loaded; draws `Load more` only when the read reported more, and asks for
  twenty more when it is pressed.
* **Screen:** `HomeScreen` renders both destinations and navigates to the matching route from each — an extension of its
  existing test rather than a second file.

### E2E Flow

A new flow, `flows/event-listing/event-listing.yaml` — this is the capability's first slice, so the folder does not
exist yet.

* **Fixture:** `reset` at launch for the empty state, then the `seed` dev link mid-flow for the populated one. Both
  states belong to this one screen and a launch can start from only one of them, which is the shape
  `flows/observation-listing/observation-listing.yaml` already uses for the same reason.
* **Covers:** Home's second row reaching the screen; `No events yet.`; after seeding, the five Events with both
  `repeated` rows present; opening `today` to read its description and closing it again; `last year`'s year-carrying
  date; no `Load more` on a list shorter than a page; back returning to Home.
* **Handles:** the tile toggles on the card itself, which matches on the Event's name, so nothing new needs an
  `accessibilityLabel`. The launch subflow ends on the Observation list, so the flow presses back to Home before tapping
  `Events`.
* **The newest Event's `Today, HH:MM` wording is not asserted.** It was briefed and dropped: that fixture is seeded
  three hours back, so a suite run between midnight and 03:00 renders it as `Yesterday, 22:00` and fails on the clock.
  The relative wording is `formatRelativeTime`'s own unit tests' to cover. The oldest Event's date is still asserted, by
  the shape of the year it carries rather than by literal text, which holds at any hour.
