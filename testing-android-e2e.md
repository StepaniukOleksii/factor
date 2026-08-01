# End-to-end (E2E) testing

## Purpose

E2E tests drive the **real, running app** on an Android emulator the way a person would. They exercise the one
combination the Vitest suite mocks out piece by piece: real navigation, real SQLite, and real Skia chart rendering
together.

## What gets a flow

Most client-facing features get one, so that a green suite means the app works rather than that a
handful of paths do.

* **One flow per spec**, named after the spec's folder — `.maestro/3-10-back-to-unzoom-trend-chart.yaml`
  covers `.sdd/epics/3-observation-visualization/3-10-back-to-unzoom-trend-chart/`. The filename is
  the entire coverage map, so there is nothing to keep in sync.
* **One representative pass per feature.** A flow walks the path a user would take, once. Variations,
  edge cases, validation and error states stay in Vitest, which is faster and needs no emulator.
  Covering each requirement separately instead would give a six-requirement spec six flows. The suite
  then grows slow enough to start skipping, and a suite that isn't run protects nothing.
* **Property flows** cover invariants belonging to no single spec — that data survives a process
  restart, for instance. They take a descriptive name with no numeric prefix, which is what marks
  them as not a spec's flow.
* **Whether a feature gets a flow is decided when its spec is written**, and recorded in that spec's
  Verification section — the only place that decision is written down.

Flows are therefore independent: adding one never disturbs another, and a failure names the feature
that broke.

## Prerequisites

E2E runs against the **dev-client build connecting to Metro** on the `Pixel_7` emulator. The `npm run
e2e` runner (below) handles booting the emulator, building/installing the dev client, and starting
Metro for you — so the only standing prerequisites are:

* **The `Pixel_7` AVD and the Android SDK/JDK are set up**
* **The Maestro CLI is installed** and on `PATH`. It's a standalone CLI, **not** an npm dependency:
  install it once per machine with `curl -Ls "https://get.maestro.mobile.dev" | bash`, and confirm with
  `maestro --version`. On Windows, install it under WSL or Git Bash; it drives the same emulator via `adb`.

The emulator (not a physical device) is required: flows reach Metro at `10.0.2.2:8081`, the emulator's
fixed host-loopback alias, which does not resolve on a physical device.

## Running the tests

```bash
npm run e2e                            # = bash scripts/e2e.sh — all flows
npm run e2e -- .maestro/<flow>.yaml    # a single flow
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
maestro test .maestro/<flow>.yaml   # re-run directly against the still-running app
maestro studio                      # interactive inspector for discovering selectors
```

Tear down manually when done: `bash scripts/emulator-teardown.sh`.

## How flows are written

Each flow is one file of declarative [Maestro](https://maestro.mobile.dev) YAML (`tapOn`, `inputText`,
`assertVisible`, …) directly in `.maestro/`, opening with the app id — `com.anonymous.factor`, matching
`app.json`'s `android.package`.

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
* **Comment why a step exists, not what it does.** `tapOn: "Add Record"` explains itself; the reason a
  flow waits, reseeds, or reaches for a `testID` does not.

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

* **Emulator + Metro only.** Besides the `10.0.2.2` dependency above, the dev links are `__DEV__`-only
  commands. A release-build target would need both replaced.
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
