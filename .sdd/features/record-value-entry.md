# Record Value Entry

## Goal

Whether a Record is being [created](record-creation.md) or [corrected](record-editing.md), what the user fills in is the
same: a field per Metric shaped by that Metric's type, an optional note, and a set of rules about what may be left out.
This is that form's behaviour, held once rather than described twice.

## Behaviour

**Every value is optional.** Every field may be left alone, and a form saved untouched creates a Record like any other.
What an empty field enters is silence: the Metric goes unanswered on the Record, where a zero, a blank or a `No` would
each have been an answer.

**A field per Metric type.** Each Metric renders as the input its own type calls for.

*Numeric* takes a number, on a numeric keyboard. A Metric declaring bounds states them before anything is typed — `1-5`,
`Min 0`, `Max 10` — and an unbounded one shows nothing. What is typed stays as typed while the field is open, so `0.`
and `1.50` survive being read back. A decimal comma is not a decimal point: `0,5` is refused rather than quietly saved
as `0`.

*Text* takes anything, and keeps it as written less the spaces, tabs and line breaks around it. A field holding only
those counts as empty, and nothing is saved for that Metric.

*Yes/No* is two segments, `Yes` then `No`, neither selected to begin with — visibly different from `No` being chosen.
One tap sets the value from any starting state; tapping the selected segment again clears it.

*Choice* is a field that opens a list of the Metric's declared values, in declaration order, one at most. The list's
first row is `None`, which returns the Metric to unanswered, and the chosen row carries a check. The field itself reads
the chosen value, or `None` in the colour a placeholder uses while nothing is chosen.

Segments and list rows alike report whether they are the chosen one, so which value is held reaches a screen reader as a
state rather than only as a highlight.

**Metric descriptions.** A Metric defined with a description shows a small info button beside its label, whatever its
type. Tapping it opens a dialog carrying the Metric's name and the description, with the line breaks it was written
with, so a per-value legend reads as a list rather than a paragraph. It closes by its own **Close** action, by a tap
outside it, or by the back gesture, and leaves the form exactly as it was, values entered included — the layout beneath
it holds still throughout. A screen reader announces the description as the field's hint, reaching it without the dialog
being opened at all.

**The note.** Below every Metric field, past a dividing rule, is the note — capped, with a counter, and taking the line
breaks it is given. The rule and the position are what keep it from being read as one more Metric field: its caption
stays generic and its placeholder says what it is for, so an Observation that happens to define a Metric named `note`
cannot be confused with it. Editing pre-fills it, and emptying it removes it.

**Refusals.** Nothing is judged while typing. On save, every entered value is checked against its Metric and the ones
that fail are marked in place: a number outside its bounds gets the bound it broke — `Must be between 1 and 5`, `Must be
at least 0`, `Must be at most 10` — and anything else unusable reads `Invalid value`. A marked field clears its message
as soon as it is changed, rather than at the next attempt. Only entered values are checked, so what blocks a save is
always something on screen to correct.

Bounds bind what is entered now: a stored value opens in its field as it stands, whatever the Metric's bounds have to
say about it.

**Leaving without saving.** Leaving a form that differs from what is stored asks `Discard changes?` first. Every exit is
covered: the header back arrow, the cross in edit mode, the Android back button, and the system back gesture. **Keep
editing** returns to the form with every entered value, every validation message, and the timestamp exactly as they
were; **Discard** leaves by whichever route was taken and persists nothing. Dismissing the dialog with the back gesture
counts as keeping the edit. A form that matches what is stored — untouched, changed and changed back, or holding only
whitespace a Text field would not store — leaves straight away, as saving does.

## Usage

Work down the form: each Metric in the order the Observation declares it, then the note at the bottom.

Tap the info button beside a Metric's name when it is not obvious what a value should mean. Leave anything you have
nothing to say about — an empty field is an answer.

Save with the button at the bottom. Anything the app cannot accept is marked where it was entered, and the form stays
open.
