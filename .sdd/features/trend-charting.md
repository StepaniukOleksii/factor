# Trend Charting

## Goal

A list of Records says what was entered; a chart says what has been happening. The Trends section turns an Observation's
stored Records into one small chart per Metric, so a month of entries reads as a shape rather than as a scroll.

## Behaviour

**What gets a card.** Every Metric gets one, whatever its type, so the section is on every Observation. A card is titled
with its Metric's name, followed in parentheses by the unit where the Metric declares one, and cards come in the order
the Observation declares its Metrics, so they interleave by declaration rather than grouping by type. Every card in the
section is drawn over one shared window, chosen once at the top of the section ([Trend Time Range
Selection](trend-time-range-selection.md)), and what a tap on a card reaches belongs to [Trend
Exploration](trend-exploration.md).

**Aggregation.** Charts plot buckets rather than Records. The window is cut into fixed buckets — an hour each for a
one-day window, a day for a week or a month, a month for a year, and roughly thirty whole-hour buckets for a window
chosen by hand — and each bucket holding Records becomes one point, drawn at its true position in time across the
window, so a stretch with nothing recorded reads as the gap it is.

A series is built from the Records holding a value the Metric can chart: a number for a Numeric Metric, text for a Text
Metric, one of the declared values for a Choice, an actual answer for a Yes/No.

**Numeric cards.** A Numeric bucket reduces to the mean of its Records. The series is drawn as a smooth curve over a
gradient fill, with a small dot marking each point. A point standing for more than one Record carries that count above
it in small muted type, `99+` past ninety-nine.

Five gridlines run across the card, evenly spaced, each labelled with its value down the left edge. Each card scales to
the data it draws — the lowest and highest points of its own series — so two Metrics side by side each keep the scale
their values ask for. Labels are rounded to what distinguishes neighbouring gridlines; an axis whose numbers grow too
wide switches to `k`, `M`, `B` or `T`, one unit for the whole axis. A series whose values are all the same — a single
point included — has no range to spread over: it draws mid-height with all five gridlines reading that one value.

One point is a chart: the dot is drawn on the usual axes, the curve and the fill both needing a second point to mean
anything. A window holding zero points is where the card reads `Not enough data yet` beside a chart glyph.

**Yes/No and Choice cards.** These draw as a swimlane: one lane per value the Metric declares, read top down in the
order that Metric's values are presented in — `Yes` above `No`, a Choice Metric's first-declared value at the top —
labelled down the left edge and coloured on a single-hue ramp, darkest at the top lane. The labels down the edge are
what name the lanes. A Metric declaring four values draws its four lanes over every window, including one in which only
two of them were recorded.

Each bucket draws one mark per value its Records took, in that value's lane, as wide as the bucket and as tall as the
number of Records that took it. Heights are measured against one scale shared by the whole card — the largest count any
value reaches in any bucket fills a lane — so a quiet bucket draws a shorter column than a busy one beside it, while
within a bucket the marks keep that bucket's own proportions. A value that occurred at all stays visible, however rare,
since a mark holds a minimum height.

**Text cards.** A Text bucket draws one mark on a faint rule across the middle of the card: a dot saying that something
was written in that stretch of time rather than what it said, a bucket folding several entries having no one text to
show for them. Every mark is the same size whatever its bucket holds, so nothing on the card reads as a quantity — where
a mark stands for more than one Record, the count above it says how many in figures, as it does on a Numeric point.

**Card heights.** Numeric cards all stand the same height, whatever scale they draw against. A swimlane is sized from
its lanes instead: every lane on every swimlane card is the same height, whatever Metric it draws, so a mark of a given
height stands for the same share of a lane on every card, and a card carrying another lane is taller by exactly that
lane. That lane height is the least a mark can be drawn in and still read as tall or short. A Text card, needing room
for neither a value axis nor lanes, is the shortest in the section. Every card holds its height whether it draws marks
or the empty-window placeholder, so nothing below a card moves as the window changes.

**Time labels.** Every card labels its bottom edge, at a coarseness taken from how long the window is rather than from
which control produced it: hours within a day, weekday initials within a week, short dates up to about two months, and
month with a two-digit year beyond that. The two finer scales caption each slice at its centre — eight hours across a
day, one letter per day up to a week — because an hour scale's last hour and a week's last day are its first again, and
a label at the edge would repeat the opening one. The two date scales instead put five labels end to end, the first at
the window's start and the last at its end, both being dates worth naming exactly. Every card reserves the same width
down its left edge, whether or not it has labels to put there, so a given moment sits at the same place across every
card in the column.

**Refreshing.** The section re-reads its Records whenever the window it is drawn over changes, and whenever the screen
it sits on refreshes. A refresh redraws the window that was showing rather than resetting it.

## Usage

Open an Observation; the **TRENDS** section carries one card per Metric.

Pick a window with the selector above the cards. Read a Numeric card as a curve against the values down its left edge, a
Yes/No or Choice card as marks in the lane of the value they stand for, and a Text card as dots on a rule, one wherever
something was written.
