# System Back Unzooms the Trend Charts

* 2026-07-28

## 1. Goal

[Tap an Aggregated Chart Point to Zoom](../3-7-tap-aggregated-point-to-zoom/spec.md) made zooming a ladder,
but only downwards. Every step is one-way: to get a wider window back the user has to re-enter it by hand
through the Custom Time Range modal, or drop to a preset and lose their place entirely. A chart holding
several aggregated points — the ordinary case at `1Y` — therefore costs one manual range entry per point
explored. Meanwhile Android's system back does nothing on this screen but leave it.

Make the system back button step back up the ladder, one window per press, and leave the screen only once
there is no zoom left to undo.

## 2. Requirements

* While the Trends section shows a window reached by zooming, a system back press restores the window that
  was showing before that zoom rather than leaving the screen. Every Numeric chart, the aggregation they are
  drawn at, and the TimeRangeSelector's own state all return with it.
* Successive zooms unwind one press at a time, newest first, until the window the first zoom started from is
  showing. The press after that leaves the screen, exactly as a back press does today.
* Selecting a preset or applying a range through the Custom Time Range modal makes that window a fresh
  starting point: the windows behind it are forgotten, so the next back press leaves the screen. Cancelling
  the modal changes nothing.
* A chart tap that doesn't zoom leaves nothing to undo — one that opens a Record, and one already at rest at
  a single day, both included.
* The `ScreenHeader` back arrow leaves the screen whether or not a zoom is showing.
* A back press has no effect at all while a window switch's Record fetch is in flight, and is not replayed
  afterwards.
* Remembered windows belong to a single visit to the screen: opening a Record from a chart point and
  returning keeps them, while leaving to the Observation List and reopening the Observation starts again at
  the default preset with nothing behind it.
* A dialog open over the screen — the overflow menu, either delete confirmation, or the Custom Time Range
  modal — still closes on a back press, leaving the window untouched.
* The Trends section gains no new control, label, or marker. What a back press does is the only observable
  change.

## 3. Technical Design

No domain, application, or storage change. A zoomed window is already nothing more than a `TimeRangeSelection`
held by `ObservationDetailsScreen` ([Tap an Aggregated Chart Point to Zoom](../3-7-tap-aggregated-point-to-zoom/spec.md)
§3.5), so this feature only changes how many of them the screen keeps and what a back press does with them.

### 3.1 The window history

`ObservationDetailsScreen`'s `timeRangeSelection` state widens from one `TimeRangeSelection` to a non-empty
array of them, the last entry being the active one that the trend-loading effect, `TimeRangeSelector`,
`CustomTimeRangeModal` and the aggregation all already read. It starts as a single entry holding
`DEFAULT_TIME_RANGE_SELECTION`. One array rather than a current-plus-previous pair, so there is exactly one
place the active window can come from.

Three transitions act on it:

* **A zoom pushes.** The narrowed range is appended, so the window it replaced stays underneath it. Only the
  branch of the tap handler that actually zooms does this; the Record-navigation branch and the two
  do-nothing branches leave the array alone, which is what makes an unzoomable point leave nothing for back
  to undo.
* **A back press pops**, and only while more than one entry remains. See §3.2.
* **A preset tap or an applied custom range replaces the array entirely** with a single entry. This is the
  one decision here that isn't forced: history could equally accumulate across manual switches. It doesn't,
  because a user who picks a window is stating where they want to be, not descending from somewhere — and
  because the alternative makes back unpredictable, with three idle preset taps quietly turning into three
  presses needed to leave a screen that was never zoomed. Zoom depth, by contrast, is bounded by
  [3-7](../3-7-tap-aggregated-point-to-zoom/spec.md)'s rule that zoom comes to rest at a single day, so the
  array realistically never holds more than three entries.

Ordinary screen-local state, like the selection it replaces: it survives a Record screen sitting on top and
dies when the screen is popped, which is the visit scoping from [ADR-2](../../../adr/2-navigation-foundation.md),
unchanged and free.

### 3.2 Intercepting the back press

A `hardwareBackPress` listener on React Native's `BackHandler`, registered from within the screen's existing
`useFocusEffect` and removed through its returned subscription on blur. It pops the history and returns
`true` when more than one entry remains, and returns `false` otherwise, letting React Navigation pop the
screen as it does today.

Registering on focus rather than on mount is what keeps the interception to this screen: `BackHandler`
listeners are global and fire regardless of which screen is on top, so a mount-scoped listener would silently
unzoom the charts underneath while the user was backing out of a Record.

`BackHandler` rather than React Navigation's `beforeRemove` event or `usePreventRemove` hook, even though
both are already available: those intercept every route removal, including `navigation.goBack()` from the
header arrow, and the arrow has to keep leaving. `BackHandler` sees only Android's system back — the button
and, because `android:enableOnBackInvokedCallback` is `false` in `AndroidManifest.xml`, the back gesture,
which is still dispatched as a classic back press while predictive back stays off. Enabling that flag later
would require this to be revisited. The hook has no equivalent on other platforms — `BackHandler` is inert
under `react-native-web` and there is no iOS target — so this is Android behaviour, and the rest of the
screen is unaffected on any platform.

The dialogs need no handling: an Android `Modal` runs in its own window and takes the back press through its
own `onRequestClose`, so the screen's listener is never reached while one is open.

A press arriving while `loadingTrends` is true is swallowed — consumed, but changing nothing — matching the
guard [3-7](../3-7-tap-aggregated-point-to-zoom/spec.md) already applies to chart taps, and for the same
reason: popping mid-fetch would stack a second reload on the one in flight. That guard has a known gap,
recorded in [the bug backlog](../../../backlog/backlog-bug.md) — `loadingTrends` is still false for the first
render after a switch — which this feature inherits rather than introduces, and does not attempt to close.

This is the codebase's first `BackHandler` use. It stays inline in the screen instead of becoming a shared
hook; the unsaved-changes confirmation sketched in the feature backlog for the Record form would be the
second caller that makes extracting one worthwhile, and it isn't specified yet.

## 4. Verification

### Seed Data

None. `mixed metrics` already carries what the ladder needs — `dense` aggregating heavily at `1Y`, and
`hourly`'s day-3 pair, which [testing-data.md](../../../../testing-data.md) notes is the one place in the
dataset where zoom's resting point can be reached by hand.

### Manual Verification

Reseed test data first. Every step below uses Android's system back button unless it names the header arrow.

1. Open `mixed metrics`, switch to `1Y`, and tap the middle of `dense`'s three points. With the zoomed window
   showing, press back: the window returns to `1Y`, every Numeric chart redraws at it, the selector's `1Y`
   segment is selected again, and the screen stays open.
2. From `1Y`, zoom twice — a `dense` point, then one of the finer points that appear. Press back twice: the
   intermediate window, then `1Y`. A third press leaves for the Observation List.
3. Zoom once from `1Y`, then tap the header's back arrow: the Observation List, immediately, with no unzoom
   step.
4. Zoom once from `1Y`, then tap the `1W` preset. Press back: the screen closes rather than returning to the
   zoomed window or to `1Y`.
5. Zoom once from `1Y`, open the Custom segment, and cancel. Press back: the pre-zoom `1Y` window returns —
   cancelling forgot nothing. Repeat, applying a range instead: back now closes the screen.
6. At `1D` on `mixed metrics`, tap `hourly`'s aggregated 09:00–10:00 point. Confirm nothing happens (zoom is
   at rest here), then press back: the screen closes, because nothing was zoomed.
7. Zoom once from `1Y`, then tap a point standing for a single Record to open it. Press back on the Record
   screen: the details screen returns still zoomed, not unzoomed a step. Press back again: the pre-zoom
   window.
8. Zoom once from `1Y`, then open the overflow menu and press back, and again with the delete confirmation
   open. Each dialog closes and the zoomed window is still showing underneath.
9. Zoom once from `1Y`, leave with the header arrow, and reopen `mixed metrics`: the selector shows the
   default `1M`, and a back press closes the screen.
10. Open `no numeric`, which renders no Trends section, and press back: the Observation List.

### Automated Tests

`ObservationDetailsScreen` tests, extending the pinned-clock suite [3-7](../3-7-tap-aggregated-point-to-zoom/spec.md)
added. Under Vitest `react-native` resolves to `react-native-web`, whose `BackHandler` logs an error and never
fires, so the suite's existing `react-native` mock needs a `BackHandler` that records its registered listeners
and lets a test invoke them and read what they returned — the same shape as the `focusListeners` set the
`useFocusEffect` mock already keeps.

* A press with nothing zoomed is declined, leaving the selection, the loaded data, and navigation untouched.
* A press after one zoom is consumed, restores the pre-zoom selection, and re-fetches and re-renders every
  Numeric chart at it, without navigating.
* Two zooms unwind over two presses, in reverse order; the press after that is declined.
* A preset tap and an applied custom range each discard a zoom's history, so the next press is declined; a
  cancelled modal does not.
* A tap that opens a Record, and a tap that is too narrow to zoom, each leave the next press declined.
* A press while `loadingTrends` is true is consumed and changes nothing.
* The listener registered on focus is removed on blur, so a press reaching the screen while it is covered
  cannot pop its history.

* **E2E:** `.maestro/3-10-back-to-unzoom-trend-chart.yaml`, on the `seed` fixture — the full ladder,
  plus the dialogs, pushed screen and header arrow that must leave it undisturbed.
