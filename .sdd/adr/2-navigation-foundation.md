# ADR-2: Navigation foundation

* Date: 2026-07-18

## Context

The app navigates with a hand-rolled `AppNavigator`: a `useState` holding a discriminated union of
screens, rendering exactly one of them and discarding the rest. That was adequate at three screens. It
is now five, with more anticipated — an Observation Config screen, an Observation Info screen, and
eventually a Home screen or tab bar.

Rendering one screen and destroying the others has three consequences, all surfaced while implementing
`3-5-custom-time-range-input`:

1. **A screen's state does not survive one step of navigation.** This shipped as a bug: applying a
   custom time range, tapping a chart point to inspect the Record behind it, and coming back discarded
   the range and reverted to the "1M" default. It was patched by lifting the selection into
   `AppNavigator` and adding a rule that classifies each screen as inside or outside an Observation's
   "exploration", clearing the selection when that classification changes. The router now holds chart
   state, and that rule exists only to simulate a behaviour a stack would provide structurally.
2. **The Android hardware back button and system back gesture do nothing.** Nothing in the codebase
   listens for them, so back exits the app from every screen, including mid-form.
3. **Backward navigation is faked as forward navigation** to a freshly built screen. This is why
   cancelling out of Record creation lands on the Observation list rather than the screen it was opened
   from.

The decision is taken now rather than deferred because both workarounds compound: every screen added to
an Observation's journey has to be registered with the exploration rule, and every future piece of
journey-scoped state repeats the lifting into the router.

`tech-stack.md` does not currently name a navigation approach. This ADR establishes one.

## Alternatives

1. **Keep the hand-rolled navigator, holding journey-scoped state in it.** What is in place today. No
   new dependency and the least code. But feature state accumulates in the router, each new piece of
   such state repeats the pattern, and neither the dead back button nor the faked backward navigation is
   addressed. The exploration-scoping rule is machinery whose only purpose is to imitate a stack.
2. **Keep the hand-rolled navigator, moving the state into a Zustand store** — `tech-stack.md`'s
   declared state-management library. This gets feature state out of the router, but a store answers
   *where state lives*, not *when
   it dies*: an explicit reset rule is still required, making it strictly more machinery than option 1
   for this need. It also places screen-scoped state in an application-wide store whose lifetime must
   then be managed by hand, which is the wrong shape for state belonging to one screen's visit. The back
   button and backward-navigation problems remain untouched.
3. **Hand-build a mounted stack** — keep every screen in the stack rendered and show only the topmost.
   This gets the correct preservation semantics with no new dependency. It is also the first step of
   writing a navigation library: back handling, focus notification, transitions, memory management, and
   later deep links all follow.
4. **Adopt React Navigation's native stack.** The de facto standard for React Native, supported
   first-class by Expo.

## Decision

Adopt React Navigation (`@react-navigation/native` with `@react-navigation/native-stack`, plus its
`react-native-screens` and `react-native-safe-area-context` requirements) as the navigation foundation.

The stack's own semantics answer the problem directly rather than working around it: a screen pushed on
top of another leaves it mounted, popping returns to that same instance, and popping a screen off
destroys it. "Screens opened from an Observation are part of exploring that Observation" is precisely
what a stack means, so the exploration-scoping rule is deleted rather than relocated, and the trend
window returns to ordinary local state in the screen that owns it.

The framework's native header is **not** adopted. `ScreenHeader` remains the app's header on every
screen, so this decision changes navigation mechanics only, not visual design.

## Trade-offs

Benefits:

* Screen state survives navigation without a store or router-held state, removing the workaround in
  `AppNavigator` rather than moving it.
* The hardware back button and system back gesture work, which they do not today.
* Journey scoping becomes structural. A future Config, Info or Home screen is a push and a pop, with
  nothing to register and no rule to extend.
* Deep linking, tabs and drawers become available later without rearchitecting.
* Cancelling a form returns where the user came from, as a side effect of real backward navigation.

Costs:

* Four new dependencies, two of them shipping native code — a dev-client rebuild and a larger binary.
  This cuts against the "minimal operational complexity" principle in `tech-stack.md`, accepted here
  because these are the standard, Expo-supported packages rather than bespoke native code.
* **Preserved screens remove a behaviour the app currently gets by accident.** Today a screen reloads
  its data because it is rebuilt on return; once it is preserved, it will not. Every screen showing data
  that a screen above it can change must explicitly refresh when it regains focus. This is the main
  hazard of the change and the most likely source of a regression.
* Unit tests touching the navigator need a mock for `react-native-screens` under Vitest, the same class
  of problem `@shopify/react-native-skia` already has.
* A framework's conventions replace roughly ninety lines of transparent, obvious code.

## Consequences

* A dev-client rebuild is required, as with ADR-1's native dependencies. See `testing-android.md`.
* **ADR-1 no longer proposes a Zustand store for shared time-range/view state; that seam has been
  removed from it.** Its intent — one window shared across an Observation's chart cards rather than
  duplicated per card — is satisfied by screen-local state once screens survive navigation, so the seam
  described a mechanism for a problem that this decision dissolves. The forward-looking rule it leaves
  behind: view state scoped to one screen's visit belongs in that screen's own state, while Zustand
  remains the approved choice in `tech-stack.md` for state that is genuinely application-wide — where it
  remains unused anywhere in `src/` as of this decision.
* Refreshing on focus becomes a standing convention for every screen that displays data another screen
  can modify, not a one-off in the Observation details screen.
* `3-4-time-range-selector` and `3-5-custom-time-range-input` document the superseded arrangement and
  are corrected by the implementing slice; the user-visible behaviour they describe is unchanged.
* `tech-stack.md` gains a Navigation entry.
* Implemented by `0-1-navigation-foundation`.
