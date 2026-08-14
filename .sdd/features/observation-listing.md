# Observation Listing

## Goal

The list of Observations is where the app opens and where every other capability is reached from. It is built for
scanning: enough of each Observation to recognise it and to tell whether it has been kept up, and nothing more.

## Behaviour

Every stored Observation appears, most recently created first. Creation order is the whole of it: an Observation holds
its place however often it is recorded against.

Each Observation shows as a card carrying three things: its name, the names of its first three Metrics as chips, and
when it was last recorded against. An Observation with more than three Metrics gets a final chip counting the remainder
— `+2` — rather than a fourth name. The last-record line reads `Last record:` followed by a date and time in the
device's own format, or `No records yet` for an Observation nothing has been recorded against.

A card has two targets. Its body opens the Observation ([Observation Viewing](observation-viewing.md)); the outlined
**+** at its right starts a Record for it without opening it first ([Record Creation](record-creation.md)) — the
shortest path from launching the app to capturing a value.

With no Observations at all, the list is replaced by `No observations created yet.` and a line pointing at the round
**+** that fixes it ([Observation Creation](observation-creation.md)). A load that fails shows the same pair of lines.

The list is re-read every time it is returned to, so an Observation created, deleted, or recorded against above it is
reflected on arrival rather than on the next launch. While it is reading, a spinner holds the screen.

The list is the root of the app: pressing back from it leaves, as standard.

## Usage

Launching the app lands here.

Tap an Observation's card body to open that Observation, or the **+** at the card's right to record against it without
opening it. Tap the round **+** at the bottom right to create a new Observation.
