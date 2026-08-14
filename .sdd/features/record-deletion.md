# Record Deletion

## Goal

A Record captured by mistake — a mis-tap, a duplicate, an entry against the wrong Observation — should be removable
without touching anything else. Deleting one is confirmed, permanent, and leaves the user where they were.

## Behaviour

Deletion is reached from a listed Record's actions ([Record Listing](record-listing.md)), as **Delete Record**. It asks
`Delete this record?`, saying the entry will be permanently removed, with **Cancel** and a destructive **Delete**.

Cancel closes the question and changes nothing. Delete removes that Record and the values it held, and leaves every
other Record, the Observation and its Metrics exactly as they were. The removal is permanent.

While it is being deleted both buttons are inert and the destructive one reads `Deleting…`.

Afterwards the user stays on the Observation, which catches up where it is: this is the only change made without leaving
the screen, so it is the only one that has to refresh it in place rather than on return. Everything the screen shows is
re-read, and the window the charts are drawn over is left alone.

A deletion that fails says so — `Failed to delete record. Please try again.` — and nothing is removed.

Records are deleted one at a time, and only from the Observation they belong to.

## Usage

Open the Observation, long-press the Record in Recent Records, choose **Delete Record**, and confirm.

The screen updates where it is.
