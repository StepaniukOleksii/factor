# Observation Editing

## Goal

An Observation is set up in a minute and then recorded against for months. Over that time its name or a Metric's can
come to read wrong, its description can fall behind what it is actually for, and a Metric it should have been asking for
all along can turn out to be missing. Editing puts any of that right, and every Record already made against the
Observation stays as it is.

## Behaviour

**Reaching it.** Editing starts at **Edit** in the ⋮ menu of [the Observation's own screen](observation-viewing.md): an
edit icon and ordinary text, first in the menu and above **Delete** ([Observation Deletion](observation-deletion.md)).
Choosing it closes the menu and opens the form.

**What it covers.** The Observation's name, its description and its Metrics, each pre-filled with what is stored.

**The fields.** Every one of them behaves as the creation form's do, and what each accepts belongs there ([Observation
Creation](observation-creation.md)): each stops accepting characters at its limit and carries a counter throughout. The
form stays unmarked until the first attempt to save, and from then on every mark answers to what is currently on screen,
a field clearing as it is corrected.

**The Observation's name.** Required, and one another Observation holds is refused — matched without regard to casing or
the whitespace around it. Its own stored name is accepted, saved untouched or corrected in its capitalisation or its
spacing alone.

**Metrics.** Below the description sits the Observation's Metric list in declaration order, a card each, holding a name,
a type, a description and whatever that type declares.

*A Metric already stored.* Its name and its description are open to overtyping. Its type is stated rather than offered,
as are the bounds of a Numeric one — `0-100`, `Min 0`, `Max 100`, and nothing at all where it declares none — and the
values of a Choice one, in the order they were declared. A stated fact carries none of the box a field wears and reads
in a muted colour. Every stored Metric is carried through the save, holding the values already entered against it.

*A Metric added.* **Add Metric** appends a card editable in full — its name, its type, its description and whatever the
chosen type declares — behaving as the creation form's cards do ([Observation Creation](observation-creation.md)). For
as long as it is unsaved it carries a delete affordance, which takes the card off the form.

*Metric names.* Distinct within the Observation, matched by the same casing-blind, whitespace-trimming comparison. Of a
colliding pair the second is marked, never the first. Stored Metrics come first on the form, and a name colliding with
one of them is marked on the added card. A stored Metric keeping its own name collides with nothing.

*Where an added Metric lands.* At the end of the Observation's Metric order, reading last everywhere Metrics are shown:
last of the trend cards ([Trend Charting](trend-charting.md)), last of the Record form's fields ([Record Value
Entry](record-value-entry.md)), the final column of an expanded Record ([Record Listing](record-listing.md)).

**Saving.** **Save Observation** writes the name, the description, every renamed and redescribed Metric and every added
one in a single step: all of it lands or none of it does. It is the same Observation afterwards, changed — its Records
and the time it was created are as they were, and it holds the position it held in [the Observation
list](observation-listing.md). A description cleared in the form is cleared on what held it, the Observation's and a
Metric's alike.

**What the Records do.** No edit this form allows changes a Record. A renamed Metric keeps every value ever entered
against it; its chart and its column carry that history over to the new name. A Record made before a Metric was added
holds no value for it and reads as unanswered ([Record Value Entry](record-value-entry.md)).

**Where the changes show.** Saving returns to the Observation, its header carrying the new name on arrival. The new name
of the Observation, and of any Metric, reads the same wherever it appears.

**Leaving without saving.** A form differing from what it loaded asks `Discard changes?` before it closes, saying that
the changes made to the Observation will be lost. A Metric renamed or redescribed counts, and so does a card added.
**Keep editing** returns to the form with everything still in it; **Discard** leaves, and the Observation is as it was.
Whitespace typed around a value counts as no difference, and a form nothing was changed in closes without asking. The
question comes whichever way out is taken — the cross in the header, the back arrow, the hardware button or the back
gesture — and discarding carries on to wherever that way out was headed.

**While it loads, and when there is nothing to load.** The screen is titled `Loading...` and holds a spinner while it
reads the Observation. One that is gone — deleted from another route — is titled `Not found` and says `Observation not
found.`

## Usage

Open the Observation, tap ⋮ at its top right, then **Edit**.

The name sits at the top holding what the Observation is called now and stays in place while the rest scrolls: the
description first, then **METRICS** and a card per Metric in the order the Observation declares them, then a dashed
**Add Metric** at the end.

Overtype a name or a description anywhere on the form — the Observation's own, or any Metric's. On a stored Metric's
card the type, the range and the choice values sit alongside as plain text. **Add Metric** appends a fresh card to fill
in as you would on the creation form, removable by the delete button beside its name for as long as it is unsaved.

**Save Observation**, fixed at the bottom, writes the lot and lands you back on the Observation, its header reading the
new name. The cross at the top right or the back arrow leaves without saving, asking first if anything was changed.
