# Metric Ordering

## Goal

An Observation's Metrics are worked in one fixed sequence — down the Record form every time a Record is entered, down
the trend cards every time the Observation is opened. Which Metric leads and which comes last is therefore worth
deciding, and the one that matters most is often the one thought of last. Ordering puts that sequence in the user's
hands: on either form an Observation is shaped by, a Metric card moves up or down, and where it comes to rest is where
its Metric reads from then on.

## Behaviour

**Where a card is moved.** Both Observation forms carry the same control — the one that declares an Observation
([Observation Creation](observation-creation.md)) and the one that edits an existing one ([Observation
Editing](observation-editing.md)).

**The arrows.** Beside each Metric card's name sit an up arrow and a down arrow. A tap moves the card one place, and the
whole card travels: the name typed into it, the type with whatever that type declares, the description, and any mark a
refused save left on it. The arrows appear once a form holds a second card, an order being something to arrange only
then.

**The ends of the list.** The top card's up arrow and the bottom card's down arrow are drawn dimmed and stay inert. Both
arrows sit on every card regardless, so the group keeps its width and the bin stays the same distance from the card's
edge throughout.

**When the order takes effect.** On the creation form, the order the cards are left in is the order the Observation is
declared with. On the edit form a move is staged with the rest of the edits and written by the save, and it counts as a
change when that form asks whether to discard ([Observation Editing](observation-editing.md)).

**Where the order reads.** Wherever the Observation's Metrics appear: the trend cards ([Trend
Charting](trend-charting.md)), the fields of the Record form ([Record Value Entry](record-value-entry.md)), the columns
of an expanded Record ([Record Listing](record-listing.md)), and the cards of the forms themselves.

**A Metric added later.** Lands at the end of the form, and moves up from there like any other card.

**Announcing it.** Each arrow reports the Metric it moves and the direction it would move it, naming that Metric by what
is typed into its card, or by the card's place on the form while the name is still blank. A dimmed arrow reports itself
disabled, so which move is available is heard as well as seen.

## Usage

Open a Metric card's form: the + button on [the Observation list](observation-listing.md) to declare a new Observation,
or **Edit** in the ⋮ menu of [an Observation's own screen](observation-viewing.md) to change one that exists.

Beside each card's name are two arrows. Tap the up arrow to lift that card a place, the down arrow to drop it, and the
card carries everything filled into it. Repeat until the cards read in the order you want to be asked for them. The
arrow that would carry a card off either end is dimmed.

Moving cards keeps you on the form; the order is written when you save it. The save returns you where that form's own
action returns you — [the Observation list](observation-listing.md) from a declaration, [the
Observation](observation-viewing.md) itself from an edit — with its Metrics reading in the order you left them.
