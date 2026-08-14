# Record Editing

## Goal

A stored Record can be wrong: a value mistyped, a Metric left unanswered that should not have been, or an entry made
hours after the thing it describes. Editing reopens the Record exactly as it was stored and lets every part of it —
values, note, and when it happened — be corrected in one pass.

## Behaviour

Editing is reached from a listed Record's actions ([Record Listing](record-listing.md)) and from a trend chart ([Trend
Exploration](trend-exploration.md)). What the fields themselves accept is the same on both Record routes and belongs to
[Record Value Entry](record-value-entry.md).

The form opens pre-populated: each Metric's stored value in its own field, the note as it was written, and the Record's
timestamp shown as a **Date** field and a **Time** field at the top. A Metric the Record holds no value for opens
unanswered. The header carries the Observation's name, a back arrow, and a cross for abandoning the edit.

**Date** and **Time** open the platform's own pickers, each pre-filled with what the Record currently holds. The date
picker changes only the day, the time picker only the time-of-day, so correcting one leaves the other as it was. The
date picker offers today and any day before it — a Record describes something that has already happened — and reaches
back indefinitely; the time picker offers the whole clock.

The action at the bottom reads **Save Record**. Saving writes values, note and timestamp together in one step, and the
Record keeps its identity — it is the same Record, changed.

A field cleared in the form is cleared on the Record: what the form holds at the moment of saving is what the Record
holds afterwards, so clearing a value is a way of removing it rather than a way of skipping it. Saving returns to the
Observation.

Leaving without saving discards everything. A moved timestamp counts as a change on equal terms with an edited value, so
it raises the same confirmation the rest of the form does — including one consequence worth expecting: opening the time
picker and confirming it without moving it drops the timestamp's seconds, which is a real change and is treated as one.

A Record that no longer exists — deleted from elsewhere — opens as `Not found` and says `Record not found.`

## Usage

Long-press the Record in Recent Records and choose **Edit Record**, or tap a chart point standing for a single Record.

Correct whatever is wrong, tap **Date** or **Time** to move when it happened, then **Save Record** — which returns to
the Observation the Record belongs to. The cross or the back arrow leaves without saving, asking first if anything was
changed.
