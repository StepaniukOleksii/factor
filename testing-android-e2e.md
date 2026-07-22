# End-to-end (E2E) testing

## Purpose

E2E tests drive the **real, running app** on an Android emulator the way a person would — tapping
buttons, typing into fields, and asserting on what actually appears on screen. They exercise the one
combination the Vitest suite mocks out piece by piece: real navigation, real SQLite, and real Skia
chart rendering together (see the automated-tests section of
[testing-android-manually.md](testing-android-manually.md#automated-tests-and-typechecking)).

They complement, not replace, the Vitest unit/component tests. Keep E2E to a few high-value golden
paths; push detailed edge-case coverage down into Vitest, which is far faster and needs no emulator.

## Tooling: Maestro

We use [Maestro](https://maestro.mobile.dev) for E2E. Flows are written as declarative YAML
(`tapOn`, `inputText`, `assertVisible`, …), which stays readable and tolerates minor UI timing
without hand-written waits.

Maestro is a standalone CLI, **not** an npm dependency — install it once on the machine that runs the
tests:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Then confirm it's on `PATH`:

```bash
maestro --version
```

(On Windows, install under WSL or Git Bash per the Maestro docs; it drives the same emulator via `adb`.)

## Prerequisites

E2E runs against the **dev-client build connecting to Metro**, so the manual-testing setup is the
prerequisite. Before running a flow:

1. **Emulator running.** Start the `Pixel_7` AVD — see
   [testing-android-manually.md](testing-android-manually.md#1-confirm-your-device-is-visible-to-adb).
   The emulator is required: the flow reaches Metro at `10.0.2.2:8081`, the emulator's fixed
   host-loopback alias, which does **not** resolve on a physical device.
2. **Dev client installed and Metro up.** `npm run android` builds/installs the Factor dev client and
   starts Metro (or `npm start` if the dev client is already installed). See
   [testing-android-manually.md](testing-android-manually.md#day-to-day-workflow).

## Running the tests

```bash
npm run e2e          # = maestro test .maestro/
```

This runs every flow in [`.maestro/`](.maestro/). To run a single flow while iterating:

```bash
maestro test .maestro/create-observation-and-record.yaml
```

`maestro studio` opens an interactive inspector against the running app — useful for discovering the
right selector for a new element without guessing.

## How flows are written

Each flow is one YAML file in `.maestro/`, beginning with the app id:

```yaml
appId: com.anonymous.factor   # matches app.json's android.package
---
- launchApp: { clearState: true }
- ...
```

Conventions this project follows:

* **`clearState: true` on launch** makes every run idempotent — it wipes the local database so a
  flow that creates a "Sleep" observation doesn't accumulate duplicates across runs.
* **Select by visible text and accessibility labels, never coordinates.** Buttons match on their
  label (`"Add Record"`), inputs on their `accessibilityLabel` (`"Hours value"`) or `placeholder`
  (`"e.g., Duration"`), screens on their header text. This keeps flows stable across layout changes.
  When adding a screen, give tappable elements an `accessibilityLabel` so a flow has a stable handle.
* **Dev-launcher handling.** Because `clearState` also clears the dev client's memory of which Metro
  server to use, a cleared launch lands on Expo's launcher/dev-menu screens first. The flow dismisses
  them with `optional: true` steps (tap `http://10.0.2.2:8081`, tap `Continue`, `back` out of the dev
  menu). `optional` steps are skipped silently on a non-cleared relaunch where those screens don't
  appear.

## Current flows

* **`create-observation-and-record.yaml`** — the golden path: create an Observation with one Numeric
  metric, add a Record to it, and confirm the Record shows up and the empty state is gone.

## Gotchas

* **Emulator + Metro only.** The `10.0.2.2` launcher step ties these flows to the emulator running a
  dev build against Metro. They will not pass against a physical device or a standalone/release APK
  (a release build has no launcher picker — the `optional` steps would just be skipped, but the
  address assumption still makes the emulator the supported target). If we later add a release-build
  target, that would be a separate, launcher-free flow.
* **`hideKeyboard` can be flaky on Android.** Flows call it before tapping footer buttons so the
  keyboard doesn't cover them; if a run fails intermittently at such a step, that's the usual cause.
* **Stale dev client.** If a native dependency changed, rebuild with `npm run android` before running
  E2E — a dev client built before the change loads the new JS bundle and then crashes when the missing
  native module is first touched (see
  [testing-android-manually.md](testing-android-manually.md#day-to-day-workflow)).

## CI

Not wired into CI yet — E2E is run manually via `npm run e2e`. Automating it would require a CI job
that boots an emulator, installs the dev build, starts Metro, and then runs Maestro.
