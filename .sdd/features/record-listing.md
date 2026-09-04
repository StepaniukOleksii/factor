# Record Listing

## Goal

Recent Records answers "what did I last put in, and was it right?". It shows the three newest Records for an
Observation, opens each one up to the values it holds, and is where editing or deleting a Record starts.

## Behaviour

The three most recent Records appear under **RECENT RECORDS**, newest first. Fewer than three are shown when fewer
exist, and an Observation with none reads `No records yet.` Three is the whole of it: this is a view of what was last
put in, kept to a glance.

Each Record is a tile, collapsed to begin with. A collapsed tile carries a clock icon, when the Record was made, and a
chevron; a Record with a note also carries a small note icon, which says a note is there before the tile is opened, and
says so to a screen reader as much as on screen.

The time is written relative to now: `Today, 14:05`, `Yesterday, 09:30`, a weekday within the last week, and a date from
then on.

Tapping a tile expands it, and tapping it again collapses it. Only one tile is open at a time — opening a second closes
the first.

An expanded tile shows every Metric the Observation defines, in declaration order and the unanswered ones included: each
as a column with the Metric's name above its value, all on a single row that stays a single row. The name is set in
capitals, and a Metric's unit follows it in parentheses in the case it was declared in — capitals would make a different
unit of it. A Metric the Record holds no value for reads `-`, so it keeps its column and says what it holds. A Yes/No
value reads as `Yes` or `No`, in the words the form offered. When the columns overrun the width, the row scrolls
sideways between two arrows, with a thumb appearing to show how far along it is.

A note, when there is one, sits below the values behind a small icon, which stands in for a caption: the word "note"
would otherwise be on screen twice for an Observation that happens to define a Metric named `note`.

**Long-pressing a tile** opens a dialog titled `Record actions`, subtitled with that Record's time, offering **Edit
Record** ([Record Editing](record-editing.md)) and **Delete Record** ([Record Deletion](record-deletion.md)), with
**Cancel** below them. Tapping outside it or pressing back dismisses it, leaving the Record as it was.

The list is re-read whenever the screen holding it refreshes, so what it shows is never behind what is stored.

## Usage

Open an Observation and find **RECENT RECORDS**.

Tap a Record to see its values, tap it again to close it. Long-press one to reach Edit Record or Delete Record.
