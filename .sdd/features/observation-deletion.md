# Observation Deletion

## Goal

An Observation a user has stopped tracking should be removable, along with everything gathered under it. Deletion is
destructive and permanent, so it is deliberately kept two steps away from anything else and confirmed in words that say
what goes.

## Behaviour

Deletion starts at **Delete** in the ⋮ menu of the Observation's header ([Observation
Viewing](observation-viewing.md)) — a bin icon and red text, marking it as destructive before it is tapped.

Choosing it closes the menu and asks `Delete Observation?`, spelling out that the Observation and all its records go and
that the action cannot be undone. **Cancel** closes the question and changes nothing, leaving the user where they were.
**Delete** carries it out.

Everything belonging to the Observation goes with it: the Metrics it defined, every Record made against it, and every
value in those Records. The removal is permanent and immediate. The name becomes free, so a new Observation may take it.

While the deletion is in flight both buttons are inert and the destructive one reads `Deleting…`. On success the user
lands back on the Observation list, and not merely one screen back: the Observation this journey was about is gone, so
the journey goes with it — anything that had been opened on the way is dropped too.

A deletion that fails leaves the Observation intact and the confirmation open, its buttons live again, and reports the
failure only to the log.

What is deleted is always a whole Observation, one at a time, and always by opening it first.

## Usage

Open the Observation, tap ⋮ at the top right, tap **Delete**, and confirm.

You end up on the Observation list with it gone.
