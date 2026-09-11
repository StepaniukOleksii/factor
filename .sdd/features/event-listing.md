# Event Listing

## Goal

An Event is noted for what it explains later — the holiday behind a fortnight's dip, the illness behind a bad week. It
stands apart from every Observation, so reading one back takes a place of its own. The Event list is that place: what
has been noted so far, most recent first.

## Behaviour

The list is headed `Events` and holds every stored Event, the most recently occurred at the top.

**The tile.** An Event is a card carrying its name and when it occurred, and every tile stands the same height, so the
list reads as a column of equals however much or little each Event has behind it.

**When it occurred.** The moment is written against now: `Today, 14:05`, `Yesterday, 09:30`, a weekday inside the last
week, and a date from then on. A date outside the current year carries its year, so an Event from two summers back is
read rather than guessed at.

**Reading a description.** An Event that carries a description carries a chevron with it, and tapping the tile opens the
description in full beneath the name. Tapping it again closes it, and opening a second tile closes the first, so the
list returns to its even column as soon as the reading is done. The chevron is what marks a tile worth tapping, before
it is tapped.

**How much is read.** The list reads twenty Events at a time. While Events remain beyond them, **Load more** sits below
the last tile and adds another twenty each time it is pressed; it stands there until the list holds everything stored.
While that wider read runs the button dims and the tiles already read stay where they are.

**Waiting and coming back.** A spinner holds the screen for the first read. Returning to the list re-reads it, keeping
however many Events were on it, so what is on screen is what is stored. With nothing stored the list reads `No events
yet.`, and a read that fails says the same.

**Leaving.** The list is opened from [Home](home-navigation.md), and pressing back returns there.

## Usage

Tap **Events** on [Home](home-navigation.md) to get here.

Read down the list, newest first. Tap a tile carrying a chevron to open what was written about that Event, and tap it
again to close it. Tap **Load more** at the foot of the list to read twenty more.

Press back and you are on [Home](home-navigation.md) again.
