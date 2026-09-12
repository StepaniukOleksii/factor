# Trend Event Overlay

## Goal

A trend card says how a Metric moved. It says nothing about what was going on while it moved, so a fortnight's dip reads
as a dip rather than as the illness behind it. The overlay draws the Events that fall inside the Trends section's window
across every card in it, and names them when one is tapped.

## Behaviour

**What is drawn.** Every Event whose moment falls inside the window the Trends section is drawn over ([Trend Time Range
Selection](trend-time-range-selection.md)) draws one dashed vertical line at that moment, on every card drawing a chart
([Trend Charting](trend-charting.md)). Each line stands at the same place across every card, and one Event reads
straight down the column. The lines are faint and dashed against the solid gridlines they cross, and each passes behind
the marks, lanes and labels of the card it crosses. Only a card drawing a chart carries them: a card reading `Not enough
data yet` ([Trend Charting](trend-charting.md)) stands exactly as it does with no Event in the window.

**The band and its marks.** A card with an Event in its window reserves a shallow band between the Metric's name and its
plot and grows by that band, the chart below keeping the height it has. Each line begins at a small mark at the top of
the band and runs from there to the foot of the plot. The band comes and goes with the Events, and a window holding none
leaves every card exactly as tall as it stands with nothing to mark.

**One mark for several Events.** Marks whose tap targets would overlap are drawn as one standing for every Event behind
it: a square where it stands for a lone Event, a pill spanning from its group's first line to its last. A target reaches
further above its mark than below and ends at the plot's top edge, and every tap on a chart still belongs to the chart
([Trend Exploration](trend-exploration.md)). A mark sweeps up a fixed width of the card, which is about five days across
a month-wide window and about two months across a year. A wide window carries few marks, each standing for several
Events. Each Event keeps a line of its own at the moment it occurred, grouped or not.

**What a mark opens.** Tapping one opens a card over the charts, carrying one entry per Event it stands for, oldest
first. An entry is the Event's name over the moment it occurred, written against now. An entry whose Event carries a
description carries a chevron, and tapping the entry reveals that description below the moment; tapping it again folds
it away, and opening a second entry folds the first. Only an entry carrying a chevron answers a tap. The card sizes
itself to the entries it holds, out to a width that takes the longest name an Event may carry on one line, and sits
below the mark that opened it, nudged sideways to stay within the screen.

**More Events than fit.** The entries scroll once they reach a share of the screen's height, the card holding that
height; below it the card hugs its entries. Opening an entry grows it inside that scroll.

**Dismissing it.** A tap outside the card closes it, as does the Android back button. Both leave the section's window
and the zoom steps behind it as they were ([Trend Exploration](trend-exploration.md)).

**Refreshing.** The Events are read again whenever the section re-reads its Records ([Trend
Charting](trend-charting.md)).

## Usage

Open an Observation and read down the cards in its TRENDS section ([Trend Charting](trend-charting.md)). Where an Event
falls inside the window ([Trend Time Range Selection](trend-time-range-selection.md)), a dashed line crosses every card
at that moment, with a small mark at its top, just under the Metric's name.

Tap a mark to find out what it stands for: a name and a moment for each Event behind it, and a chevron on any that has
more to say. Tap such an entry to read the description, and tap it again to close it. A mark drawn as a pill stands for
every Event across its width.

Tap outside the card, or press back, to dismiss it. You stay on the window you were reading, cards and all.
