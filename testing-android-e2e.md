# End-to-end (E2E) testing

## Purpose

E2E tests drive the **real, running app** on an Android emulator the way a person would. They exercise the one
combination the Vitest suite mocks out piece by piece: real navigation, real SQLite, and real Skia chart rendering
together.

## What gets a flow

Most client-facing behaviour gets a flow, so that a green suite means the app works rather than that a
handful of paths do.

* **Every feature gets a folder**, `.maestro/flows/<feature>/`, named for its feature file without the
  `.md`. The folder is the coverage map — whether a feature is covered is a directory check, and
  nothing has to be kept in sync. It stays a folder even holding a single flow.
* **One flow per feature, by preference.** A slice touching a feature that already has coverage extends
  that flow rather than adding one beside it: a small addition to an existing screen is a few more
  steps, not a whole new pass. Split into a second flow only when the case is genuinely separate, or
  when one flow has grown long enough that a failure in it no longer names what broke.
* **One representative pass.** A flow walks the path a user would take, once. Variations, edge cases,
  validation and error states stay in Vitest, which is faster and needs no emulator. Covering each
  requirement separately instead would give a six-requirement spec six flows. The suite then grows slow
  enough to start skipping, and a suite that isn't run protects nothing.
* **Property flows** cover invariants belonging to no single feature — that data survives a process
  restart, for instance. They sit directly in `flows/`, and being outside every feature folder is what
  marks them as nobody's.
* **Whether a slice needs coverage is decided when its spec is written**, and recorded in that spec's
  Verification section — as a flow to extend as often as one to write. That spec is deleted once the
  slice retires, so a reason that generalises past the one slice is written here as a rule instead — as
  the Skia one below was.
* **What a chart draws is out of reach.** `NumericTrendChart` renders inside a Skia canvas, and Skia's
  own text and marks never enter the Android view hierarchy Maestro reads. A flow can assert a chart
  is present, tap it, and read the platform elements around it — never what it drew. A feature living
  entirely inside the canvas is a `None`, left to unit tests and manual checks.

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
npm run e2e -- .maestro/flows/<feature>/<flow>.yaml    # a single flow
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
maestro test .maestro/flows/<feature>/<flow>.yaml   # re-run directly against the still-running app
maestro studio                      # interactive inspector for discovering selectors
```

Tear down manually when done: `bash scripts/emulator-teardown.sh`.

## How flows are written

Each flow is one file of declarative [Maestro](https://maestro.mobile.dev) YAML (`tapOn`, `inputText`,
`assertVisible`, …) under `.maestro/flows/`, opening with the app id — `com.anonymous.factor`, matching
`app.json`'s `android.package`.

`.maestro/subflows/` holds fragments shared between flows, and sits outside `flows/` on purpose.
`.maestro/config.yaml` globs `flows/*.yaml` and `flows/*/*.yaml`, so a fragment is never picked up and
run as a flow of its own — which is what a plain recursive glob over `.maestro/` would do. A flow
therefore reaches a fragment two levels up: `runFlow: ../../subflows/launch.yaml`.

Conventions this project follows:

* **Open with `../../subflows/launch.yaml`.** It starts the app against Metro and puts the database into a
  known state, parameterised by `DEV_COMMAND` (`reset` for empty, `seed` for the
  [testing-data.md](testing-data.md) fixture set) and `READY_TEXT`. Starting from a stated fixture is
  what makes a re-run idempotent. `READY_TEXT` must be text the *empty* list does not show — the
  subflow empties the database before running the command, so that any wait is a real transition, and
  a `READY_TEXT` already on screen beforehand would pass without waiting for anything.
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
* **A tap on a chart canvas is aimed inside it** — the one place coordinates are allowed, a canvas
  holding no element to select. A chart acts only where a point is, within 24px of one on both axes, and
  the centre of a canvas is not where a point is. `tapOn` takes an element-relative `point` beside its
  selector, so `{id: "numeric-trend-chart-pressable", point: "83%,50%"}` is 83% across *that canvas*
  rather than across the screen. A point falling a fraction `f` through the window is drawn at
  `f + (32 − 36f) / W` across a canvas of width `W` (`LABEL_GUTTER` and `PLOT_RIGHT_INSET` in
  [`chartAxis.tsx`](src/presentation/charts/chartAxis.tsx)), which is within a percentage point of `f`
  itself at any phone width. Take `f` from the fixture's bucket grid and comment each aim with that
  derivation: the number is meaningless alone, and a tap that silently stops landing is the hardest
  failure in the suite to read.
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
