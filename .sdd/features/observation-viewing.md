# Observation Viewing

## Goal

Opening an Observation is how a user goes from "I track this" to "here is how it is going". The screen gathers
everything that belongs to one Observation — what it is for, how it has trended, what was last recorded — and is the
place every action on that Observation or its Records starts from.

## Behaviour

The screen is titled with the Observation's name. Its description, when it has one, sits directly under the title as
small muted text — this is the screen with room for prose, so this is where it is read. Without one, the sections below
start straight under the title.

Below it are two sections: **Trends**, which an Observation gets once it has something to chart, and **Recent Records**,
which is always there. Trends comes first — a shape is read faster than a list, and the question that brings a user here
is usually how things are going rather than what the last entry was. What each holds belongs to the capability it
serves: [Trend Charting](trend-charting.md) for the cards and [Trend Time Range
Selection](trend-time-range-selection.md) for the window they share, [Record Listing](record-listing.md) for the Records
below them.

At the bottom, fixed, is **Add Record**, starting a Record for this Observation ([Record Creation](record-creation.md)).
The header's ⋮ menu holds one action, Delete ([Observation Deletion](observation-deletion.md)).

Everything on the screen is re-read each time it is returned to, so a Record added, edited or deleted above it is
reflected on arrival rather than on the next visit.

While the Observation is loading the screen is titled `Loading...` and holds a spinner. An Observation that cannot be
found — deleted from another route — is titled `Not found` and says `Observation not found.`

## Usage

Tap an Observation on the list to open it.

Read the description under the title, if there is one. Trends is the history; Recent Records below it is what was last
put in. **Add Record** at the bottom captures a new one, and the ⋮ menu deletes the Observation.

The back arrow returns to the list.
