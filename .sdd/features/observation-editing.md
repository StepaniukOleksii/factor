# Observation Editing

## Goal

An Observation outlives the wording it was declared with: it is set up in a minute and recorded against for months. A
name typed in haste, or a purpose that has since sharpened, leaves a growing body of Records filed under a description
that misdescribes them. What an Observation says about itself has to be able to catch up with what it is being used for,
and at no cost to what has accumulated under it — accumulating is the whole of what an Observation is for.

## Behaviour

**Reaching it.** Editing starts at **Edit** in the ⋮ menu of [the Observation's own screen](observation-viewing.md): an
edit icon and ordinary text, above **Delete** ([Observation Deletion](observation-deletion.md)) and against its red, so
the harmless action is both the first one and told apart from the destructive one before either is tapped. Choosing it
closes the menu and opens the form.

**What it covers.** Editing reaches the Observation's name and its description, each pre-filled with what is stored, and
the form is those two fields alone.

**The fields.** Both behave as the creation form's do, and what they accept belongs there ([Observation
Creation](observation-creation.md)): each stops accepting characters at its limit and carries a counter throughout, and
the form stays unmarked until the first attempt to save, after which every mark answers to what is currently on screen —
so a field clears as it is corrected rather than at the next attempt.

**Names.** A name is required, and one another Observation holds is refused — matched without regard to casing or the
whitespace around it. An Observation's own stored name is its to keep, so saving it untouched is accepted, and so is a
correction to its capitalisation or its spacing alone.

**Saving.** **Save Observation** writes the name and the description in one step, and it is the same Observation
afterwards, changed — its Metrics, its Records and the time it was created are as they were, so it holds the position it
held in [the Observation list](observation-listing.md). A rename is not a re-creation. A description cleared in the form
is cleared on the Observation, so emptying the field is how a description is taken away.

**Where the new name shows.** Saving returns to the Observation, whose header carries it on arrival, and it reads the
same wherever else the Observation appears — the name belongs to the Observation rather than to the screen that changed
it.

**Leaving without saving.** A form whose name or description differs from what was loaded asks `Discard changes?` before
it closes, saying that the changes made to the Observation will be lost. **Keep editing** returns to the form with
everything still in it; **Discard** leaves, and the Observation is as it was. Whitespace typed around a value counts as
no difference, since saving it would write nothing, and a form nothing was changed in closes without asking. The
question comes whichever way out is taken — the cross in the header, the back arrow, the hardware button or the back
gesture — and discarding carries on to wherever that way out was headed.

**While it loads, and when there is nothing to load.** The screen is titled `Loading...` and holds a spinner while it
reads the Observation. One that is gone — deleted from another route — is titled `Not found` and says `Observation not
found.`

## Usage

Open the Observation, tap ⋮ at its top right, then **Edit**.

The name sits at the top holding what the Observation is called now, the description below it holding whatever prose it
has. Overtype either; the form scrolls, so the description stays reachable with the keyboard up. **Save Observation**,
fixed at the bottom, writes both.

Saving lands you back on the Observation, its header reading the new name. The cross at the top right or the back arrow
leaves without saving, asking first if anything was changed.
