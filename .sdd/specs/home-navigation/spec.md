# Home Navigation

* 2026-09-06
* Feature: home-navigation.md (new)
* [x] Implemented
* [ ] E2E tested

## 1. Goal

The Observation list is the stack's root, so it is both the app's front door and its only top-level destination. Events
are owned by nothing and have no Observation to sit under, so the Event slices that follow need a second destination and
there is nowhere to put one. Give the app a Home screen as the stack's root, hosting the Observation list as its first
entry.

## 2. Requirements

* Launching the app lands on a Home screen headed `Factor`, carrying no back control and no other action in its header.
* Home carries one entry, reading `Observations`, which opens the Observation list ([Observation
  Listing](../../features/observation-listing.md)).
* `Observations` is the only entry. A second destination, the Event list included, is out of scope.
* Home reads nothing from the database: no count, no Observation names, no times, and nothing that has to be refreshed
  when a screen above it changes something.
* Pressing back from the Observation list returns to Home. Pressing back from Home leaves the app.
* Deleting an Observation still lands on the Observation list, not on Home, and still drops everything opened on the way
  ([Observation Deletion](../../features/observation-deletion.md)).
* No screen above the Observation list changes. A Record form cancelled or saved returns exactly where it returns today.

## 3. Technical Design

Nothing below the presentation layer changes: no domain, application or infrastructure work, and no new dependency. Home
displays nothing it would need a use case to fetch.

### 3.1 Navigation

`RootStackParamList` (`src/presentation/navigation/routes.ts`) gains `Home: undefined`. `AppNavigator` declares
`HomeScreen` as its first `Stack.Screen` and sets `initialRouteName="Home"`; `ObservationList` keeps its registration
and becomes an ordinary pushed screen.

Two things read differently once the root moves, and both are in the existing code rather than the new screen:

* **`ObservationDetailsScreen`'s deletion path.** `onDeleted` calls `navigation.popToTop()`, which meant the Observation
  list and now means Home. It becomes `navigation.popTo('ObservationList')`, so a deleted Observation still leaves the
  user on the list with the whole journey above it dropped — the behaviour [Observation
  Deletion](../../features/observation-deletion.md) describes, unchanged.
* **`ObservationListScreen`'s refresh-on-focus comment.** It explains the `useFocusEffect` by the screen being the
  stack's root and therefore mounted for the whole session. That premise stops being true — the screen is pushed from
  Home and destroyed on the way back — while the code stays correct for the ordinary reason every other screen's refresh
  is. Rewrite the comment; leave the effect alone.

Two sentences of [Observation Listing](../../features/observation-listing.md) stop being true with this slice — that the
list is where the app opens, and that pressing back from it leaves. This is a deliberate change, and that feature file
is rewritten alongside `home-navigation.md` when the slice ships.

### 3.2 Presentation

**`HomeScreen`** (`src/presentation/screens/HomeScreen.tsx`) — a `ScreenContainer` holding a `ScreenHeader` titled
`Factor` with neither `onBack` nor `rightAction`, above a list of destination rows. It holds no state, runs no effect,
and takes only the `navigation` object from its `NativeStackScreenProps`.

One row, for the Observation list: a `TouchableOpacity` carrying a `MaterialIcons` `show-chart` glyph — the line-chart
glyph the trends empty state already uses — in a rounded tile on the left, the label `Observations`, and a
`chevron-right` at the right edge, navigating to `ObservationList` on press. Its visible label is what a screen reader
and a Maestro flow both select on, so it needs no `accessibilityLabel` of its own.

The row is defined in `HomeScreen.tsx` rather than added to `src/presentation/components`. There is one of them, and
what a second destination needs — a subtitle, a disabled state, a count — is unknown until the slice that adds one says
so; promoting it early would fix a shape against a single use.

Colours, radii and type come from `@presentation/theme` as everywhere else. No FAB and no `FooterBar`: Home starts
nothing, it only goes somewhere. See `design/home-screen.html` for the screen as it should look.

## 4. Verification

### Seed Data

None added. The existing set ([testing-data.md](../../../testing-data.md)) covers everything here — this slice displays
no data of its own, and needs Observations to exist only so that the list it opens is not empty.

### Manual Verification

Reseed test data first.

1. Launch the app: it lands on Home, headed `Factor`, showing a single `Observations` entry and no back arrow.
2. Tap `Observations`: the Observation list opens with the four seeded Observations, headed `Observations` with a back
   arrow.
3. Press back: Home again. Press back on Home: the app exits rather than showing an empty screen.
4. Reopen the app, tap into the list, and open `mixed metrics`. Press back twice: the list, then Home.
5. From the list, tap the round **+**, then back out of the form — it returns to the list, not to Home.
6. Open `no records`, delete it through ⋮ → **Delete**, and confirm: the app lands on the **Observation list** with it
   gone, not on Home.
7. Open `stale records`, tap a chart point to reach the Record, and go back twice: the Observation, then the list. The
   journey behaves as it did before the root moved.

### Automated Tests

* **Navigator (`AppNavigator.test.tsx`):** the stack starts on `Home`; `ObservationList` is pushed onto it and popping
  back leaves `Home` alone. Every existing assertion on the stack's contents gains `Home` at the bottom, and the test
  named for starting on the Observation list is rewritten for the new root. The deletion test drives
  `popTo('ObservationList')` and expects `['Home', 'ObservationList']`, replacing the `popToTop` it asserts today.
* **Screen (`HomeScreen.test.tsx`):** renders the `Observations` entry; pressing it navigates to `ObservationList`; the
  header carries no back control.

### E2E Flow

Two pieces of work, and the subflow is the one that gates the suite.

**`.maestro/subflows/launch.yaml` — every flow's opening, and it no longer lands where it thinks it does.** The
navigator remounts when a dev-link command finishes, which returns the app to the stack's root — now Home rather than
the Observation list. So the subflow has to walk to the list itself, and it must never tap while a command is in flight:
a tap that lands first is thrown away by the remount behind it, and the wait that follows then fails on a screen the
flow was already carried off. The revised opening, with `DEV_COMMAND` and `READY_TEXT` unchanged so no flow file needs
touching:

1. `stopApp` and the Metro launch link, as now.
2. Wait for `Factor` instead of `Observations`. It names what the root actually shows, and `Observations` now appears on
   Home as well as in the list's header, which would make the boot wait ambiguous.
3. Tap `Observations` to reach the list.
4. Fire `dev/reset`, then wait for `Factor` to come back. The header reappearing is the proof the command finished
   writing and the navigator remounted — the same guarantee the old wait on the list's empty text gave, which is no
   longer on screen after a remount.
5. Tap `Observations`, then wait for `No observations created yet.` This keeps the reason the reset is there at all:
   `READY_TEXT` below cannot already be on screen from the previous flow's fixture.
6. Fire `dev/${DEV_COMMAND}`, wait for `Factor`, tap `Observations`, wait for `${READY_TEXT}`.

Step 6 runs for a `reset` flow too, and needs no special case: the wait on `Factor` is a real transition either way,
because the flow is standing on the list when the command fires.

**No flow of its own, and none for a destination screen added later.** Every flow opens through that subflow, so the
suite walks Home on every run already: the app landing there, the `Observations` entry, and that entry opening the list.
What is left over — back from a destination returning to Home — belongs to the destination rather than to the hub, and
is covered where that screen's flow already runs. The `popTo` change comes free with the suite as it stands:
`observation-deletion.yaml` asserts a seeded Observation's name after a confirmed delete, and that text shows only on
the Observation list, so a deletion landing on Home fails there.

So no `.maestro/flows/home-navigation/` folder. `home-navigation.md` is covered by construction rather than by a
directory entry, and the reason generalises past this slice — the Event list will cover its own edge back to Home the
same way — so the E2E stage writes it into [testing-android-e2e.md](../../../testing-android-e2e.md) as a rule under
**What gets a flow**, alongside the Skia one, rather than leaving it here to be deleted with this spec.

**Extend `.maestro/flows/observation-listing/observation-listing.yaml`** instead, on the screen whose route in and out
of Home this slice changes.

* **Fixture:** unchanged.
* **Covers:** the subflow leaves the app on the Observation list, so the flow presses back and asserts `Factor`, then
  taps `Observations` and asserts the seeded list is back. Two steps, at the end of the pass that flow already makes.
* **Handles:** none new. `Factor` and `Observations` are both visible text.

Back out of Home exiting the app is left to manual step 3: Maestro asserting an app it has just closed is a check on the
harness rather than on the app.
