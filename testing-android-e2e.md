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

E2E runs against the **dev-client build connecting to Metro** on the `Pixel_7` emulator. The `npm run
e2e` runner (below) handles booting the emulator, building/installing the dev client, and starting
Metro for you — so the only standing prerequisites are:

* **The `Pixel_7` AVD and the Android SDK/JDK are set up** — the same one-time setup as manual testing
  ([testing-android-manually.md](testing-android-manually.md#one-time-setup)).
* **The Maestro CLI is installed** and on `PATH` (see above).

The emulator (not a physical device) is required: flows reach Metro at `10.0.2.2:8081`, the emulator's
fixed host-loopback alias, which does not resolve on a physical device.

## Running the tests

```bash
npm run e2e                                        # = bash scripts/e2e.sh — all flows
npm run e2e -- .maestro/create-observation-and-record.yaml   # a single flow
```

`npm run e2e` runs [`scripts/e2e.sh`](scripts/e2e.sh), which wraps the run end to end:

1. [`scripts/emulator-setup.sh`](scripts/emulator-setup.sh) — boots (or reuses) the emulator, frees a
   stale Metro on port 8081, resets the on-device database, then builds, installs, and launches the
   app, **blocking until it's actually running** (Metro serving → window displayed → JS runtime up). It
   prints `READY device=<serial> …`, and the serial is passed to Maestro as `--device` so a physical
   device connected alongside the emulator is never picked.
2. `maestro test --device <serial> <flow>` — the actual flows.
3. [`scripts/emulator-teardown.sh`](scripts/emulator-teardown.sh) — kills Metro and shuts the emulator
   down. Runs even if setup or Maestro failed (idempotent).

The runner exits with Maestro's own exit code, so it gates a script or CI step. Maestro writes
per-flow screenshots and view hierarchies (including on failure) under `.maestro/tests/<timestamp>/`
(gitignored).

### Iterating on a flow

Booting and rebuilding on every run is wasteful while authoring. Keep the emulator up between runs:

```bash
E2E_KEEP_EMULATOR=1 npm run e2e     # leaves the emulator + Metro running at the end
maestro test .maestro/foo.yaml      # re-run directly against the still-running app
maestro studio                      # interactive inspector for discovering selectors
```

Tear down manually when done: `bash scripts/emulator-teardown.sh`.

## How flows are written

Each flow is one YAML file directly in `.maestro/`, beginning with the app id:

```yaml
appId: com.anonymous.factor   # matches app.json's android.package
---
- runFlow:
    file: subflows/launch.yaml
    env:
      DEV_COMMAND: reset
      READY_TEXT: "No observations created yet."
- ...
```

`.maestro/subflows/` holds fragments shared between flows. `.maestro/config.yaml` limits the runner's
glob to `*.yaml` in `.maestro/` itself; without it, `maestro test .maestro/` recurses and runs every
fragment as a flow.

Conventions this project follows:

* **Open with `subflows/launch.yaml`.** It starts the app against Metro and puts the database into a
  known state, parameterised by `DEV_COMMAND` (`reset` for empty, `seed` for the
  [testing-data.md](testing-data.md) fixture set) and `READY_TEXT` (text that appears only once that
  command has landed). Starting from a stated fixture is what makes a re-run idempotent.
* **Set fixtures up through dev links, not through the UI.** `exp+factor://dev/seed` and
  `exp+factor://dev/reset` are `__DEV__`-only commands handled in `App.tsx`. They exist because a flow
  cannot open the dev menu — that takes a shake or `KEYCODE_MENU` — and because building fixtures
  through the Record form is slow and impossible for backdated Records.
* **Select by visible text and accessibility labels, never coordinates.** Buttons match on their
  label (`"Add Record"`), inputs on their `accessibilityLabel` (`"Hours value"`) or `placeholder`
  (`"e.g., Duration"`), screens on their header text. This keeps flows stable across layout changes,
  and keeps a passing assertion evidence that a user would see the same thing. When adding a screen,
  give tappable elements an `accessibilityLabel` so a flow has a stable handle.
* **`testID` only where nothing readable exists**, or where a flow must read state text cannot express.
  Both current uses qualify: `numeric-trend-chart-pressable` is a Skia canvas, `time-range-preset-1Y`
  is matched on its `selected` state.

### Two rules for dev links

Neither is visible from reading the YAML, and both cost a failed run to find:

* **Fire a link only once the app is on screen.** `launchApp` returns before the JS bundle runs, and a
  link arriving before the listener exists is dropped — Android does not re-deliver it, and
  `getInitialURL` only ever returns the intent that launched the activity.
* **Wait for a link's effect, never just the next step.** `openLink` returns on delivery, seconds
  before a seed finishes writing. The navigator remounts only once a command resolves, so waiting for
  the resulting text proves the whole command landed. Skip the wait and you act on a half-written
  database, with the `openLink` step still reported green.

## Gotchas

* **Emulator + Metro only.** Two things tie these flows to a dev build on the emulator: `10.0.2.2` is
  the emulator's own host-loopback alias and resolves nowhere else, and the dev commands are
  `__DEV__`-only. A release-build target would need both replaced.
* **A plain `launchApp` hangs rather than fails.** Left to itself the dev client reconnects to the
  host's LAN IP, which the emulator cannot reach, then sits on its bundling banner indefinitely —
  waiting never recovers it. Hence `subflows/launch.yaml` passing Metro's address explicitly, as
  [`scripts/emulator-setup.sh`](scripts/emulator-setup.sh) does.
* **`hideKeyboard` can be flaky on Android.** Flows call it before tapping footer buttons so the
  keyboard doesn't cover them; if a run fails intermittently at such a step, that's the usual cause.
* **Stale dev client.** If a native dependency changed, rebuild with `npm run android` before running
  E2E — a dev client built before the change loads the new JS bundle and then crashes when the missing
  native module is first touched (see
  [testing-android-manually.md](testing-android-manually.md#day-to-day-workflow)).
