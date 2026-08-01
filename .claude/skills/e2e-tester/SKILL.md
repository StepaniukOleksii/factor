---
name: e2e-tester
description: Writes, runs, and debugs Maestro E2E flows for Factor. Use when a spec's Verification section names an E2E flow to be written, when the user asks for a Maestro flow, or when an E2E run fails and needs diagnosing. Not for Vitest unit/component tests, and not for screenshot-based visual checks (see emulator-verifier).
metadata:
  version: "1.0.0"
---

# E2E Tester

Write the Maestro flow a spec asked for, run it on the emulator until it passes, and diagnose failures.
Slow — minutes, and it needs an emulator. This is a deliberate step after a spec is implemented, not part
of every change.

## 1. Read the Strategy

Read `testing-android-e2e.md`: the authoring conventions, the two dev-link rules, and the gotchas. Read
`testing-data.md` for what the `seed` fixture already contains — a flow reuses it rather than building data 
through the UI.

Those documents carry the strategy; this skill is only the procedure. Nothing in them is repeated here.

## 2. Read the Spec

The spec's Verification names the flow to write and the fixture it needs. If it says `None`, there is
nothing to do — say so and stop.

If implementation made the declared flow impractical — the behaviour has no on-screen handle, or sits
behind a native surface Maestro cannot drive — **amend that bullet in the spec** to say so and why. The
spec is the only record of the decision; don't silently skip it.

## 3. Find the Handles

Bring the app up and leave it up:

```bash
bash scripts/emulator-setup.sh
```

It prints `READY device=<serial>`. Then `maestro studio` inspects the running app for selectors.

The Maestro CLI is **not** on a non-interactive shell's `PATH` — its installer adds it through the shell
profile, which `bash -c` never sources. Export it before any bare `maestro` command, exactly as
`scripts/e2e.sh` does:

```bash
export PATH="$HOME/.maestro/bin:$PATH"
```

Follow the selector priority in the strategy document. Where an element has no stable handle, **add an
`accessibilityLabel` or `testID` to it** — that's expected, and a tappable element missing an
accessibility label is worth fixing regardless. Change nothing else under `src/`.

## 4. Write the Flow

`.maestro/<spec-folder-name>.yaml`, opening with `subflows/launch.yaml` and following the conventions in
the strategy document.

One representative pass. Resist covering the variations, edge cases and error states the Vitest suite
already owns — that limit is what keeps the suite runnable.

## 5. Run It

Iterate with the loop in the strategy document's "Iterating on a flow" — the emulator stays up between
attempts, so no attempt pays for a rebuild.

Once it's green, confirm from cold:

```bash
npm run e2e -- .maestro/<flow>.yaml
```

That rebuilds, relaunches and tears down. A flow that only passes against an app already warmed up by the
previous attempt is not finished.

If you stop before that point, tear the environment down yourself: `bash scripts/emulator-teardown.sh`.

## 6. Diagnose Failures

Maestro writes the failing step's screenshot and the view hierarchy to `.maestro/tests/<timestamp>/`. Read
the hierarchy before touching the flow — most failures are a selector that stopped matching, not a bug.

Rule out the known causes in the strategy document's Gotchas before concluding anything: a stale dev
client after a native dependency change, `hideKeyboard` flakiness, and the two dev-link timing rules.

## 7. Scope Limit

This skill writes flows, plus the accessibility labels and testIDs they need to reach elements. It does
not change product behaviour, write Vitest tests, or edit specs beyond the amendment in step 2.

If a flow fails because the app is wrong, **report the defect — do not fix it here.**
