# Trend Exploration

## Goal

A trend chart is a summary, and the useful question about a summary is "what is behind that?". Tapping a chart answers
it: what stands for a single Record opens that Record, and what folds several together narrows the whole section onto
them, so they separate into marks of their own. Every card answers the gesture, so reaching the Records behind a chart
is learned once and works across the section.

## Behaviour

**What a tap lands on.** A tap is answered by the mark nearest it horizontally, and only when it falls within a
comfortable distance of that mark across. One distance serves every card and every window, so a mark's target is a
fingertip-sized patch of chart wherever it is drawn and however many neighbours it has. What counts as a mark, and what
else is asked of the tap, is each card's own:

*A Numeric card* is answered by its points, and a point must also be near enough up or down — the same distance again,
which makes its target a fingertip-sized box centred on the dot.

*A swimlane* ([Trend Charting](trend-charting.md)) is answered by its bucket columns, and a column answers anywhere down
its height, running the plot from top to bottom as it does. Its target is centred on the middle of the column as drawn,
which puts the far end of a wide column as comfortably in reach as its near end. Whichever lane the tap fell in, the
column answers whole: every mark in it stands for Records of the one bucket, and that bucket is what the tap is asking
after.

*A Text card* is answered by its marks, and a mark must also be near enough up or down — the same distance again, which
makes its target a box like a Numeric point's. The card is the shortest in the section ([Trend
Charting](trend-charting.md)), so that box is taller than the card: a mark answers from the top and bottom edges as
readily as from the rule it sits on.

**What a tap does.** Every mark stands for a bucket, so what follows is decided by the Records in it rather than by the
card it was drawn on.

A bucket holding exactly one Record opens that Record for editing ([Record Editing](record-editing.md)).

A bucket holding several narrows the Trends section onto the days those Records actually fall on, whole days at a time,
rather than onto the bucket that held them — a bucket is a grid laid over the window, and zooming to one strands the
data in whatever part of it the Records do not reach. Every card in the section narrows together, so a tap on a swimlane
carries the Numeric cards beside it along as readily as one of their own points would. On a Text card, narrowing is the
only way to separate the Records behind a mark, because the mark says nothing that would tell them apart.

Zooming is a ladder rather than a single step: the narrowed window can be zoomed again wherever its buckets still fold
several Records together, so a year typically descends in two taps — a month of Records, then one of its days. A zoom is
followed when it genuinely closes in, which settles it at a single day: a day-wide window is bucketed by the hour, every
Record in one of those buckets already shares a day, and asking to narrow again returns the same window. A bucket still
folding several Records at that resolution stays one bucket, a swimlane column mixing several values there stays one
column, and a mark still standing for several Records stays one mark — what a tap separates is time.

A tap arriving while the section is fetching is left where it fell, so one window switch completes before another can
start.

**Getting back out.** Each zoom is a step, and the Android back button retraces them one at a time — back once returns
to the window zoomed from, back again to the one before it. Every chart, the resolution they are drawn at, and the
window selector come back with it. Only when there is nothing left to undo does back leave the screen. The header's back
arrow leaves the screen, whatever steps stand behind it.

A back press arriving while Records are being fetched is spent where it fell, as a tap is. A dialog open over the screen
takes the press itself and closes, leaving the window as it was.

Choosing a window from the selector ([Trend Time Range Selection](trend-time-range-selection.md)) clears the steps and
starts fresh, because picking one outright is a statement of where to be rather than a move deeper. What a zoom produces
is an ordinary custom window, adjustable like any other.

Leaving the Observation drops the steps, so coming back has nothing behind it to undo.

## Usage

Open an Observation and work the cards in its TRENDS section ([Trend Charting](trend-charting.md)): on a Numeric card
tap the dot itself, on a Yes/No or Choice card the column of marks standing over one slice of time, which answers
anywhere down its height, and on a Text card the dot on its rule, which answers from anywhere above or below it on the
card. The stretches between belong to the chart, and a tap there leaves the card as it is.

If what you tapped stands for one Record, that Record opens for editing ([Record Editing](record-editing.md)); if it
stands for several, every card in the section zooms onto the days behind them and you stay where you are, on a narrower
window. On a Text card, zooming is how you reach what was written: keep tapping until a mark stands for a single Record,
which then opens.

Press back to undo a zoom, or pick a window from the selector ([Trend Time Range
Selection](trend-time-range-selection.md)) to start over.
