# Observation Viewing

## Goal

Opening an Observation is how a user goes from "I track this" to "here is how it is going". The screen gathers
everything that belongs to one Observation — what it is for, how long it has been kept and how much is in it, how it has
trended, what was last recorded — and is the place every action on that Observation or its Records starts from.

## Behaviour

The screen is titled with the Observation's name. Its description, when it has one, sits directly under the title as
small muted text — this is the screen with room for prose, so this is where it is read.

Under that, on every Observation whether it has a description or not, sits one small line of the Observation's own
history: when it was created and how many Records it holds, as `Created 14/03/2025 · 12 records`. It is there to give
the rest of the screen a scale — a thin chart and three Record tiles read one way on an Observation started last week
and another on one kept for a year and recorded against four hundred times. The count is every Record ever made against
the Observation, so it holds still while [Trend Time Range Selection](trend-time-range-selection.md) re-scopes what the
charts cover, and it is worded to what it counts: `No records`, `1 record`, `12 records`.

Below it are two sections: **Trends**, which an Observation gets once it has something to chart, and **Recent Records**,
which is always there. Trends comes first — a shape is read faster than a list, and the question that brings a user here
is usually how things are going rather than what the last entry was. What each holds belongs to the capability it
serves: [Trend Charting](trend-charting.md) for the cards and [Trend Time Range
Selection](trend-time-range-selection.md) for the window they share, [Record Listing](record-listing.md) for the Records
below them.

At the bottom, fixed, is **Add Record**, starting a Record for this Observation ([Record Creation](record-creation.md)).
The header's ⋮ menu holds two actions: Edit ([Observation Editing](observation-editing.md)) and Delete ([Observation
Deletion](observation-deletion.md)).

Everything on the screen is re-read each time it is returned to, so a Record added, edited or deleted above it is
reflected on arrival rather than on the next visit.

While the Observation is loading the screen is titled `Loading...` and holds a spinner. An Observation that cannot be
found — deleted from another route — is titled `Not found` and says `Observation not found.`

## Usage

Tap an Observation on the list to open it.

Read the description under the title, if there is one, and the line beneath it for how long this has been kept and how
much has gone into it. Trends is the history; Recent Records below it is what was last put in. **Add Record** at the
bottom captures a new one, and the ⋮ menu edits or deletes the Observation.

The back arrow returns to the list.
