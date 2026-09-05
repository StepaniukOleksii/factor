# Observation Creation

## Goal

Creating an Observation is how everything else becomes possible: there is nothing to record against, list or chart until
one exists. It is declared in a single pass on one screen — the Observation and every Metric it will ever ask for.

## Behaviour

The form asks for the Observation's name, an optional description, and at least one Metric; for each Metric, its name,
its type, an optional description, and whatever that type declares.

**Names.** The Observation's name is required, and so is each Metric's. A name that collides — with an existing
Observation, or with another Metric on this one — is refused, and the offending field says which kind of collision it
is: an Observation name conflicts with something the user cannot see and has to be told about, while two Metric names
conflict on screen. Of a colliding pair of Metrics the second is marked, never the first: the first is the one being
kept.

The Observation names compared against are the ones that existed when the screen opened. A collision with an Observation
created elsewhere in the meantime is refused too, as a dialog rather than a field mark, since no field on screen could
have shown it coming.

**Descriptions.** Optional, on the Observation and on each Metric. Left blank, there is simply none.

**Types.** The type picker offers all four. Numeric adds a Min, a Max and a Unit field, any of which may be left empty;
a bound that is not a number, and a minimum above its maximum, are both refused. Choice adds value rows, starting at the
two it needs, with an **Add Value** button that stops being offered once the Metric holds as many as it may, and refuses
a set holding two values a user could not tell apart. Text and Yes/No add nothing. Changing a Metric's type discards
what was typed for the previous one, so nothing is submitted unseen.

**Every length limit is enforced as it is typed** rather than on save: the field stops accepting characters at its limit
and shows a counter throughout, so the limit is visible before it is met.

**When refusals appear.** The first attempt to save is what marks the form, and it marks every field that is wrong at
once — until then the form stays clean, since one that opens marked faults the user for what they have not done yet.
From that first attempt on, each mark answers to what is currently on screen, so a field clears as it is corrected
rather than at the next attempt. A refusal belonging to no single field sits under the pair or the group it is about: a
minimum exceeding its maximum belongs to neither bound alone, and a Choice short of values belongs to no one row.

**Metrics are this Observation's own.** Each is declared here from scratch, in an order the form itself sets ([Metric
Ordering](metric-ordering.md)), so two Observations both measuring hours each define one of their own.

## Usage

From the [Observation list](observation-listing.md), the + button at the bottom right opens New Observation.

The name field sits at the top and stays in place while the rest scrolls. Below it are the description, then the
Metrics, then a dashed **Add Metric** button that appends another card.

Each Metric card holds its name, its type, and whatever that type needs. Choosing Numeric adds Min, Max and Unit fields
side by side; choosing Choice adds two value rows and a dashed **Add Value** button. A Metric card can be removed once
there are two, and a value row once there are three — the last of each stays, being the minimum.

**Create Observation**, fixed at the bottom, saves. On success the screen closes and the user is back on the Observation
list, the new Observation among them. Anything wrong is marked in place and the screen stays open. While the write is
under way the button holds a spinner in place of its label and takes no further tap; it stays that way as the screen
closes, and only a write that fails hands it back.
