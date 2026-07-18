# Feature Spec: Navigation Foundation

* Date: 2026-07-18

## 1. Goal

Replace the hand-rolled `AppNavigator` with React Navigation's native stack, so navigating deeper into
the app stacks screens instead of destroying them.

This fixes three things the current navigator causes: screen state lost after one step of navigation
(patched today by holding the Trends time range in the navigator), a dead Android back button, and
backward navigation faked as forward navigation. The rationale, alternatives considered and trade-offs
are recorded in [ADR-2](../../../adr/2-navigation-foundation.md).

A foundation slice: no visual design changes and no new user-facing feature.

## 2. Requirements

* [ ] **Native Stack Replaces the Screen Switch:** `AppNavigator` is rebuilt on
  `@react-navigation/native-stack`, hosting the same five screens with the same entry points. The
  `ScreenState` union, the `navigate` funnel, `exploredObservationId` and `assertNever` are removed.
* [ ] **Screens Are Preserved, Not Rebuilt:** Pushing a screen leaves the one below mounted, with its
  local state intact. Popping returns to that same screen instance rather than a fresh one.
* [ ] **System Back Works:** The Android hardware back button and back gesture pop one screen. From the
  Observation list — the root — they exit the app, as standard.
* [ ] **Trend Window Returns to the Screen:** `timeRangeSelection` becomes ordinary `useState` inside
  `ObservationDetailsScreen` again. The `timeRangeSelection` / `onTimeRangeSelectionChange` props are
  removed, and the navigator holds no chart state.
* [ ] **Exploration Behavior Is Preserved Exactly:** The window survives a trip to Record
  creation/editing and back, for presets and custom ranges alike; leaving to the Observation list
  discards it, so reopening even the same Observation starts at "1M". This must now fall out of the
  stack's own lifetime rather than from an explicit rule — see 3.4.
* [ ] **Returning to a Screen Refreshes Its Data:** Because screens are no longer rebuilt, they no
  longer reload on return by accident. `ObservationDetailsScreen` must reload its Observation, Recent
  Records and trend data whenever it regains focus, so a Record added or edited on a screen above it
  appears on return. The reload must not reset the selected time range.
* [ ] **Cancelling Returns Where the User Came From:** Backing out of Record creation returns to the
  screen it was opened from — the Observation list or that Observation's details — instead of always
  landing on the list as it does today.
* [ ] **Creating a Record Ends on the Observation:** Saving a new Record from the Observation list ends
  on that Observation's details screen, and the record form is not left in the back stack — pressing
  back from there goes to the list, never back into the form just submitted.
* [ ] **Deleting an Observation Returns to the List:** After deletion the user lands on the Observation
  list with no stale details screen left in the stack to go back to.
* [ ] **The App's Own Header Stays:** React Navigation's native header is disabled; `ScreenHeader`
  remains the app's header on every screen, unchanged.
* [ ] **No Visual Change:** Identical layout, spacing and colours, with no double status-bar padding
  introduced by the new safe-area dependency, and existing modals continuing to render translucent over
  the status and navigation bars as they do today.
* [ ] **Screens Stay Testable Without a Navigator:** A screen's own test must be able to render it
  directly, without standing up a `NavigationContainer` — see 3.6.
* [ ] **Decision Recorded as an ADR:** Adopting a navigation framework is a stack change, which
  `tech-stack.md` and `architecture.md` both require an ADR for. ADR-2 is written as part of this slice,
  and ADR-1 is amended — see 3.7.
* [ ] **Out of Scope:** Deep linking, tab or drawer navigation, a Home screen, native headers, screen
  transition customisation, and migrating `ScreenContainer` to
  `react-native-safe-area-context`'s `SafeAreaView`. All become straightforward afterwards; none are
  needed to fix what this slice fixes.

## 3. Technical Design

### 3.1 Data Models

No domain entities change. The navigator's `ScreenState` union is replaced by a route parameter list,
which is the same information expressed as React Navigation types:

```ts
export type RootStackParamList = {
  ObservationList: undefined;
  CreateObservation: undefined;
  ObservationDetails: {observationId: string};
  CreateRecord: {observationId: string};
  EditRecord: {observationId: string; recordId: string};
};
```

Screens read their parameters from the route rather than from props passed by the navigator, and
navigate by name rather than by calling a passed-in callback.

### 3.2 Application Layer

None. No use case changes.

### 3.3 Storage Layer

None.

### 3.4 Navigation Structure

A single native stack, rooted at `ObservationList`, with the native header disabled globally.

The exploration-scoping rule is **deleted, not relocated**. A stack already encodes it: screens opened
from an Observation sit on top of its details screen, which stays mounted and keeps its state, and
popping back to the list unmounts it. Nothing replaces `exploredObservationId`.

Navigation actions per screen:

| From | Action | Behaviour |
|------|--------|-----------|
| Observation list | open an Observation | push `ObservationDetails` |
| Observation list | create an Observation | push `CreateObservation` |
| Observation list | add a Record | push `CreateRecord` |
| Create Observation | back / saved | pop |
| Observation details | add a Record | push `CreateRecord` |
| Observation details | tap a chart point / edit a Record | push `EditRecord` |
| Observation details | back | pop |
| Observation details | Observation deleted | pop to the list root |
| Record form | back / cancel | pop |
| Record form (from details) | saved | pop |
| Record form (from the list) | saved | replace with `ObservationDetails` |

The last two rows are the only asymmetric case. Opened from an Observation, saving pops back onto the
preserved details screen. Opened from the list there is no details screen underneath, so the form is
*replaced* by one — which both lands the user on the Observation they just recorded against and keeps the
submitted form out of the back stack.

### 3.5 User Interface

No visual design changes; no mockup accompanies this spec.

**New dependencies**, all installed with `npx expo install` so Expo pins SDK 54-compatible versions:
`@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`,
`react-native-safe-area-context`. The latter two ship native code, so a dev-client rebuild is required —
see `testing-android.md`.

**`ObservationDetailsScreen`** — the screen that carries most of this slice:

* Regains `timeRangeSelection` as local `useState(DEFAULT_TIME_RANGE_SELECTION)`; the two props added
  for the navigator are removed.
* Its data loading moves from a mount effect to a focus effect (`useFocusEffect` from
  `@react-navigation/native`), refreshing the Observation, its Recent Records and its trend data on
  every return. A mount effect now fires only on the first visit, so without this a Record added or
  edited above this screen never appears on it.
* The focus refresh must not touch `timeRangeSelection`. Reloading data and resetting the window are
  different things, and only the first is wanted.

**Other screens** take their `observationId` / `recordId` from route params and navigate by name;
otherwise unchanged.

**`ScreenContainer`** keeps its current `SafeAreaView` and manual Android status-bar padding. Installing
`react-native-safe-area-context` does not change behaviour on its own, but the screens must be checked
for double padding once the provider is in the tree.

### 3.6 Testing Seams

The existing suite is the safety net for this refactor and most of it must keep passing untouched, so
two things need care:

* **Screen tests must not need a navigator.** `useFocusEffect` is the only React Navigation API reaching
  into a screen. Screen tests mock `@react-navigation/native` so that `useFocusEffect` simply runs its
  callback on mount, which is exactly what the current mount effect does — leaving every existing
  `ObservationDetailsScreen` test meaningful as written. The `NavigatorHarness` those tests use to feed
  the selection back in is deleted, since the screen owns its selection again.
* **`react-native-screens` cannot load under Node**, the same problem Skia has (see `vitest.setup.ts`
  and `__mocks__/`). Navigator-level tests either mock it the same way or render the stack inside a
  `NavigationContainer` with that module stubbed. `@testing-library/react-native` is already a
  devDependency and is the more natural fit than `react-test-renderer` for this.

`AppNavigator.test.tsx` is rewritten rather than extended: its current tests assert a prop contract
(`timeRangeSelection` passed down, reset on scope change) that ceases to exist. What must survive is the
*behaviour* those tests protect — see the Automated Tests section.

### 3.7 Documents to Update

The decision is recorded in [ADR-2](../../../adr/2-navigation-foundation.md), and ADR-1 has already been
annotated where it is superseded. This slice must leave the remaining documents consistent too:

* **`3-5-custom-time-range-input`** — the "Selection Lasts as Long as the Exploration" requirement and
  the `AppNavigator` notes in its §3.5 describe the arrangement this slice replaces. The user-visible
  behaviour is unchanged; only the mechanism is.
* **`3-4-time-range-selector`** — the revision note under "Preset Resets on Screen Remount" likewise.
* **`tech-stack.md`** — add a Navigation entry alongside the existing ones.

## 4. Verification Plan

### Manual Verification

Run "Reseed test data" first (see `testing-data.md`). A dev-client rebuild is required before any of
this — the new dependencies ship native code.

1. Open `mixed metrics`, select "1W", then tap a chart point to open its Record. Press back. Confirm the
   selector still reads "1W" and the charts are still on that window.
2. Repeat with a custom range applied. Confirm it is likewise still applied on return.
3. From the same screen, add a Record via "Add Record" and save. Confirm the app returns to the
   Observation, the selected window is unchanged, and **the new Record appears in RECENT RECORDS** — the
   focus-refresh requirement, and the most likely thing to be missed.
4. Edit a Record's value from a chart point and save. Confirm the change is reflected in the chart and
   RECENT RECORDS on return.
5. Press the **Android hardware back button** on the details screen. Confirm it goes back to the
   Observation list rather than exiting the app. Repeat from a Record form, and repeat with the system
   back gesture.
6. Press hardware back on the Observation list. Confirm it exits the app, as a root screen should.
7. Go back to the list and reopen `mixed metrics`. Confirm it starts at "1M" — leaving the Observation
   still discards the window.
8. Open "Add Record" from the Observation list (not from details) and save. Confirm the app lands on
   that Observation's details screen, and that pressing back from there goes to the list rather than
   back into the form.
9. Open "Add Record" from the details screen and cancel out of it. Confirm the app returns to the
   details screen it was opened from, not to the list.
10. Delete an Observation from its details screen. Confirm the list is shown and hardware back does not
    return to the deleted Observation.
11. Check every screen for unchanged spacing — in particular no extra gap above the header, which would
    indicate the safe-area provider double-padding.
12. Confirm the delete-confirmation, record-actions and custom-range modals all still render over the
    status and navigation bars as before.

### Automated Tests

* The **existing suite must pass** with the smallest possible edits. Beyond the navigator's own tests
  and the removal of `NavigatorHarness`, changes to test files should be limited to the
  `@react-navigation/native` mock; widespread test churn is a signal the refactor drifted.
* **`ObservationDetailsScreen`**: reloads its data when the screen regains focus, and does so *without*
  resetting the selected time range — a focus refresh with a custom range applied must re-query that
  same range, not the "1M" default. Its existing time-range tests carry over with the selection owned
  locally again.
* **Navigator**: the list is the root; opening an Observation pushes its details screen; a Record opened
  from there pushes on top of it and popping returns to the *same* details screen instance rather than a
  new one — the property the whole slice rests on, and the direct regression test for the original bug.
* **Navigator**: saving a Record opened from the Observation list lands on that Observation's details
  screen with the form no longer in the back stack; cancelling a Record form returns to the screen it
  was opened from; deleting an Observation returns to the list root.
* **Trend window lifetime**, re-expressed against the stack rather than the deleted classifier: the
  window survives a push-and-pop through a Record screen, and is gone after popping to the list and
  reopening the same Observation.
