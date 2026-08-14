# Trend Time Range Selection

## Goal

How much history a chart shows decides what it can say — a year of Records in one view hides the week a user came to
look at. The window control puts that choice in the user's hands, as four common spans and an arbitrary one, applied to
the whole Trends section at once.

## Behaviour

The selector sits above the cards: four preset segments — **1D**, **1W**, **1M**, **1Y** — and a wider **Custom**
segment beside them. Exactly one is active, and the choice scopes every card in the section ([Trend
Charting](trend-charting.md)), so Metrics are always read over the same span.

Opening an Observation starts at **1M**.

Each preset reaches back from now: a day, a week, thirty days, a year. Four rather than a free span, because these are
the questions actually asked — how was today, this week, this month, this year — and a control that answers them in one
tap is worth more than one that answers everything in five.

**Custom** opens a dialog asking for a start and an end day, each a field that opens the platform's date picker. The end
day offers today and any day before it, while the start reaches back indefinitely. An end before the start holds
**Apply** inert and shows `End can't be before start` until it is put right. Start and end on the same day is a
legitimate one-day window. Applying scopes the charts and writes the range into the segment in place of the word Custom
— `Jul 15 – Jul 18`, the last day being one the user actually picked rather than the boundary behind it. The range shows
for as long as it is the active window: tapping a preset moves the selection and the segment reads `Custom` again,
carrying no memory of the window it held. Cancel leaves the current window alone.

Custom always opens on whatever window is currently showing, however that window was arrived at, so tapping it again
adjusts rather than restarts — and each open starts from that window, so a cancelled edit stays cancelled.

While the Records for a new window are being read, the whole selector is dimmed and inert, so one window switch
completes before another can start.

The window belongs to the visit rather than to the Observation. It survives opening a Record and coming back — the
charts return to what was on screen — and is forgotten on leaving the Observation, so opening it again, or opening any
other, starts at 1M.

## Usage

Tap **1D**, **1W**, **1M** or **1Y** above the trend cards to scope every chart to that span.

Tap **Custom** for anything else: pick a start day and an end day, then **Apply**. The segment then shows the range it
is holding; tap it again to adjust.
