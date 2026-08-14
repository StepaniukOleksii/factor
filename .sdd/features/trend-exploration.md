# Trend Exploration

## Goal

A trend chart is a summary, and the useful question about a summary is "what is behind that?". Tapping a Numeric chart
answers it: a point standing for one Record opens that Record, and a point that folds several together narrows the whole
section onto them, so they separate into points of their own.

## Behaviour

**What a tap does.** A tap lands on the nearest point horizontally, provided it also falls within a comfortable distance
of the curve vertically, which is what keeps the empty space above and below the line clear of it.

A point standing for exactly one Record opens that Record for editing ([Record Editing](record-editing.md)).

A point standing for several narrows the Trends section onto the days those Records actually fall on, whole days at a
time, rather than onto the bucket that held them — a bucket is a grid laid over the window, and zooming to one strands
the data in whatever part of it the Records do not reach. Every card in the section narrows together.

Zooming is a ladder rather than a single step: the narrowed window can be zoomed again wherever its points still fold
several Records together, so a year typically descends in two taps — a month of Records, then one of its days. A zoom is
followed when it genuinely closes in, which settles it at a single day: a day-wide window is bucketed by the hour, every
Record in one of those buckets already shares a day, and asking to narrow again returns the same window. A point still
folding several Records at that resolution stays one point.

A tap arriving while the section is fetching is left where it fell, so one window switch completes before another can
start.

**Getting back out.** Each zoom is a step, and the Android back button retraces them one at a time — back once returns
to the window zoomed from, back again to the one before it. Every chart, the resolution they are drawn at, and the
window selector come back with it. Only when there is nothing left to undo does back leave the screen. The header's back
arrow is not part of this: it always leaves.

A back press arriving while Records are being fetched is spent where it fell, as a tap is. A dialog open over the screen
takes the press itself and closes, leaving the window as it was.

Choosing a window from the selector ([Trend Time Range Selection](trend-time-range-selection.md)) clears the steps and
starts fresh, because picking one outright is a statement of where to be rather than a move deeper. A zoom is not a mode
of its own: what it produces is an ordinary custom window, adjustable like any other.

Leaving the Observation drops the steps, so coming back has nothing behind it to undo.

**Where taps apply.** Exploration belongs to the Numeric card, whose points each stand for Records a tap can reach. A
swimlane's marks are read rather than worked: a tap on a lane has no obvious meaning to give it, and a guess would be
harder to take back than the wait for one.

## Usage

On a Numeric card, tap a point. If it stands for one Record, that Record opens for editing; if it stands for several,
the section zooms onto the days behind it.

Press back to undo a zoom, or pick a window from the selector to start over.
