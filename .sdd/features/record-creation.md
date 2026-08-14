# Record Creation

## Goal

Capturing a Record is the act the app exists for and the one repeated most often — everything else is scaffolding around
it. Creating one is therefore reachable in a single tap from the two places a user already is, and asks for nothing
beyond the values themselves.

## Behaviour

A new Record is started from either the **+** on an Observation's card in the list, or **Add Record** at the bottom of
the Observation's own screen. Both open the same empty form, titled with the Observation's name.

The form holds one field per Metric the Observation defines, in declaration order, followed by the note. What those
fields accept is the same on both Record routes and belongs to [Record Value Entry](record-value-entry.md).

A new Record takes the moment it is saved as its timestamp: a Record made now is a Record about now. The action at the
bottom reads **Add Record**.

Nothing has to be filled in: saving an untouched form creates a Record all the same, and so does saving one carrying
only a note.

A value its Metric cannot accept refuses the save: no Record is created, and the field is marked with the reason. Which
values are acceptable, and how the marks read, [Record Value Entry](record-value-entry.md) sets out.

A save that gets past that check and then fails to store shows why, and leaves the form as it was.

Saving lands the user on the Observation's own screen, whichever route they arrived by, because what a new Record raises
is a question about that Observation. Arriving from the Observation returns to it as it was left; arriving from the list
puts it in the form's place, so pressing back from there reaches the list.

Leaving the form without saving returns to wherever it was opened from, the list or the Observation.

## Usage

There are two ways in, and they differ in where they leave you.

**From the Observation list**, tap the **+** on a card. Fill in whichever Metrics apply — all of them, some, or none —
add a note if the occasion needs one, and tap **Add Record**. That Observation's own screen opens in the form's place,
holding the Record just made, and back from there reaches the list.

**From the Observation itself**, tap **Add Record** at the bottom and fill the form the same way. Saving returns you to
the Observation as you left it.

Either way, a value the app cannot accept keeps the form open with that field marked.
