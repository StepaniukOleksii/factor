---
name: e2e-testing
description: Writes, runs, and debugs Maestro E2E flows for Factor. Use when backlog-test.md queues a flow to be written, when the user asks for a Maestro flow, or when an E2E run fails and needs diagnosing. Not for Vitest unit/component tests, and not for screenshot-based visual checks (see emulator-verifying).
metadata:
  version: "2.0.0"
---

# E2E Testing

Write a queued Maestro flow, run it on the emulator until it passes, and diagnose failures. Slow — minutes,
and it needs an emulator. This is a deliberate step against code that already ships, not part of every change.

## 1. Read the Strategy

Read `testing-android-e2e.md`: the authoring conventions, the rules, and the gotchas. Read `testing-data.md` for what
the `seed` fixture already contains — a flow reuses it rather than building data through the UI.

Those documents carry the strategy; this skill is only the procedure. Nothing in them is repeated here.

## 2. Read the Queue Entry

`.sdd/backlog/backlog-test.md` names the flow to write: the feature folder it belongs in, the fixture it opens
from, and what the pass should cover. That is the whole brief — it was written to stand alone.

The brief was settled before anyone tried to drive the screen, so it can turn out wrong: the behaviour may have
no on-screen handle at all, or a handle nobody expected — a Skia canvas that exposes nothing selectable can
still be tapped through its own `testID`.

**Either way, stop and ask the user.** Do not quietly skip what was asked for, and do not quietly write
something else instead. Report what you found — what is reachable and through which handle, or what is not and
why — and let them decide. Then **amend the entry** to record the decision, so a later attempt starts from what
you learned rather than repeating it.

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

`.maestro/flows/<feature>/<name>.yaml`, in the feature folder the queue entry names. The folder is the
coverage map, so the filename only has to say what this one flow covers. A property flow belonging to no
feature sits directly in `flows/`.

Open with `subflows/launch.yaml` and follow the conventions in the strategy document.

One representative pass. Resist covering the variations, edge cases and error states the Vitest suite
already owns — that limit is what keeps the suite runnable.

### Comments

The strategy document states the principle. Default to none: a flow that is bare steps is a good flow, and
every comment is one more thing that has to stay true as the screens change. When one is earned, write the
shortest sentence that carries the reason.

These are the narrow tests that earn one, each learned from a comment that had to be deleted again:

* **Something must have *forced* the code to be this way.** A fixture that is the only one that works, a
  wait that exists because of a race, an assertion whose purpose is invisible. A choice that could have
  gone any other way gets no comment — justifying it implies a significance it does not have.
* **Never restate the steps beneath it.** If the sentence can be reconstructed by reading the next four
  lines, delete it. Bare section labels — `# Cancel path`, `# Confirm path` — are not restatement; they
  are navigation, and they are allowed.
* **Cite only what outlives the flow.** Where a step exists because of a decision argued elsewhere, point at
  an ADR or the feature file — anything ephemeral leaves the comment pointing at nothing. A property flow
  covers no feature at all, so its header states the invariant instead.
* **Never argue against the alternatives.** One clause for why this fixture; nothing about the others.
* **Never justify the flow's existence.** Why this earns a flow rather than Vitest coverage was settled before
  you got here. A flow states what it covers, never why it is entitled to exist.
* **Name the route when the screen has more than one.** Which entry point a flow takes is a real choice
  and is not inferable from the steps.
* **Protect a line that reads as removable.** An assertion that looks redundant but is not — one about an
  Observation the flow never touched, say — needs the sentence that stops the next reader deleting it.

If justifying one line takes more than a couple of sentences, the reason belongs in the strategy document
instead. Before finishing, reread every comment and cut the ones whose sentence you
could have written from the code alone.

## 5. Run It

Iterate with the loop in the strategy document's "Iterating on a flow" — the emulator stays up between
attempts, so no attempt pays for a rebuild.

Once it's green, confirm from cold:

```bash
npm run e2e -- .maestro/flows/<feature>/<flow>.yaml
```

That rebuilds, relaunches and tears down. A flow that only passes against an app already warmed up by the
previous attempt is not finished.

Where the entry in `.sdd/backlog/backlog-test.md` named existing flows as well, run the whole suite —
bare `npm run e2e` — since a single-flow run proves nothing about the ones you edited.

Green from cold retires that entry: **delete it**, leaving the file's header and intro behind if it was
the last one.

If you stop before that point, tear the environment down yourself: `bash scripts/emulator-teardown.sh`.

## 6. Diagnose Failures

Maestro writes the failing step's screenshot and the view hierarchy to `.maestro/tests/<timestamp>/`. Read
the hierarchy before touching the flow — most failures are a selector that stopped matching, not a bug.

Rule out the known causes in the strategy document's Gotchas before concluding anything: a stale dev
client after a native dependency change, `hideKeyboard` flakiness, and the two dev-link timing rules.

## 7. Scope Limit

This skill writes flows, plus the accessibility labels and testIDs they need to reach elements. It does not
change product behaviour or write Vitest tests. The queue entry — amended in step 2, struck in step 5 — is the
only file outside `.maestro/` it touches.

If a flow fails because the app is wrong, **report the defect — do not fix it here.**
