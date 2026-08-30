# Observation Editing

## Goal

An Observation is set up in a minute and then recorded against for months. Over that time its name or a Metric's can
come to read wrong, its description can fall behind what it is actually for, a Metric it should have been asking for all
along can turn out to be missing, and one it does ask for can stop meaning anything while still demanding an answer
every time. Editing puts any of that right. A rename or an addition leaves every Record as it stands; taking a Metric
away costs everything recorded against it, which is why that one change is priced in words before it is made.

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
in a muted colour.

*A Metric added.* **Add Metric** appends a card editable in full — its name, its type, its description and whatever the
chosen type declares — behaving as the creation form's cards do ([Observation Creation](observation-creation.md)).

*Metric names.* Distinct within the Observation, matched by the same casing-blind, whitespace-trimming comparison. Of a
colliding pair the second is marked, never the first. Stored Metrics come first on the form, and a name colliding with
one of them is marked on the added card. A stored Metric keeping its own name collides with nothing. A name a removal
frees is available within that same save, to a card added under it or to a Metric renamed into it.

*Where an added Metric lands.* At the end of the Observation's Metric order, reading last everywhere Metrics are shown:
last of the trend cards ([Trend Charting](trend-charting.md)), last of the Record form's fields ([Record Value
Entry](record-value-entry.md)), the final column of an expanded Record ([Record Listing](record-listing.md)).

**Taking a Metric off the form.** A bin beside a card's name takes that card off the form, and does that alone: the
Observation, its Metrics and its Records stand as they were until the form is saved. The bin is there while the form
holds more than one card, so at least one Metric survives whatever is taken off.

*Which consequence the bin carries.* On a stored Metric's card it is red, the colour **Delete** wears in the
Observation's own ⋮ menu ([Observation Deletion](observation-deletion.md)); on an added card it is the muted grey of the
form's other icons. The two kinds of card are otherwise alike, so the colour is what separates discarding a few seconds
of typing from destroying a year of Records. It warns: the confirmation at the save is what gates the destruction, and
says in words what is going.

*Announcing it.* A screen reader reaching a bin hears the Metric it removes by name, and hears the card's position on
the form while that name is still blank.

**Saving.** **Save Observation** writes the name, the description, every renamed and redescribed Metric, every added one
and every removal in a single step: all of it lands or none of it does. It is the same Observation afterwards, changed —
the time it was created is as it was, and it holds the position it held in [the Observation
list](observation-listing.md). A description cleared in the form is cleared on what held it, the Observation's and a
Metric's alike.

**Confirming a removal.** A save that has dropped a stored Metric asks before anything is written: `Delete metric?`, or
`Delete metrics?` where several go. The question quotes each Metric by name — user-typed names run to several lowercase
words, and the quotes are what mark where one ends — counts the recorded values going with them, and says the removal
cannot be undone. It counts values rather than Records, so the number stays true of several Metrics at once, whose
Records overlap. **Cancel** returns to the form exactly as it stood, those cards still off and nothing written.
**Delete** carries out the whole save. While that write is in flight both buttons are inert and the destructive one
reads `Deleting…`.

**What the Records do.** A rename or an addition changes no Record: a renamed Metric keeps every value ever entered
against it, and its chart and its column carry that history over to the new name; a Record made before a Metric was
added holds no value for it and reads as unanswered ([Record Value Entry](record-value-entry.md)). A removal is the edit
that reaches them — every value stored against that Metric goes with it, permanently. A Record left holding no value at
all is still a Record, and still reads in [the Record list](record-listing.md).

**Where the changes show.** Saving returns to the Observation, its header carrying the new name on arrival. The new name
of the Observation, and of any Metric, reads the same wherever it appears. A removed Metric leaves every place Metrics
are shown at once: its trend card ([Trend Charting](trend-charting.md)), its field on the Record form ([Record Value
Entry](record-value-entry.md)) and its column in an expanded Record ([Record Listing](record-listing.md)) all go with
it.

**Leaving without saving.** A form differing from what it loaded asks `Discard changes?` before it closes, saying that
the changes made to the Observation will be lost. A Metric renamed or redescribed counts, and so does a card added or
taken off. **Keep editing** returns to the form with everything still in it; **Discard** leaves, and the Observation is
as it was, every staged removal abandoned with the rest. Whitespace typed around a value counts as no difference, and a
form nothing was changed in closes without asking. The question comes whichever way out is taken — the cross in the
header, the back arrow, the hardware button or the back gesture — and discarding carries on to wherever that way out was
headed.

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
in as you would on the creation form.

Beside every card's name is a bin, red on the Metrics the Observation already holds and grey on the ones being drafted.
Tapping it takes that card off the form there and then; the bins are there while more than one card is on the form.

**Save Observation**, fixed at the bottom, writes the lot and lands you back on the Observation, its header reading the
new name and its Metrics the ones you left on the form. Where a stored Metric has gone from the form, `Delete metric?`
comes first, naming what goes and how much was recorded against it — **Cancel** hands the form back as you left it,
**Delete** goes through with the save. The cross at the top right or the back arrow leaves without saving, asking first
if anything was changed.
