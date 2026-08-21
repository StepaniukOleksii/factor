---
name: slice-landing
description: Lands a finished slice on master — folds its per-stage commits, rebases, fast-forwards, and deletes the feat/ branch. Use whenever a slice is done and its branch should go to master, whenever the user asks to land, merge, wrap up or finish a slice, and whenever `feature-writing` has just deleted a spec and the branch is sitting there. Not for merging arbitrary branches, and not for committing work in progress.
metadata:
  version: "1.0.0"
---

# Slice Landing

The last step in the life of a slice. Everything of value has already been written — the code, its tests, the flow, the
feature file — and what remains is turning a branch full of working commits into the one-per-stage record master keeps.
`development-process.md` describes the shape; this skill produces it.

The work is mechanical and the failure modes are not, so the mechanics live in
[scripts/land-slice.sh](../../../scripts/land-slice.sh) and the judgment lives here.

## 1. Check the slice is finished

The script enforces what it can — a `feat/` branch, a clean tree, commits to land, and no spec left under `.sdd/specs/`.
It refuses rather than guessing, so a refusal is information: read what it says instead of working around it.

What the script cannot see is whether the *work* is done. A spec is deleted by `feature-writing`, which runs only once
both stage boxes are settled, so an absent spec is good evidence — but if you arrived here without that having happened,
stop and say so. Landing is the point after which the slice stops being a thing anyone can look at.

## 2. Show the plan, and get a yes

```bash
bash scripts/land-slice.sh --dry-run
```

This prints the commits as they stand and the commits as they will land, and changes nothing. Show the user both, and
wait for them to agree before going further.

This confirmation is not ceremony. Landing rewrites history and deletes a branch — recoverable from the backup ref, but
only by someone who knows it exists. A dry run costs a second and turns an irreversible step into a reviewed one.

## 3. Land it

```bash
bash scripts/land-slice.sh
```

The script writes a backup ref under `refs/slice-landing/` before touching anything, folds each run of same-tag commits,
rebases onto master, fast-forwards, and deletes the branch. It prints what master now carries and the command that
undoes it. Pass that undo line on to the user — it is worthless in a transcript nobody reads again.

**A fold that leaves more commits than expected is not a bug.** Only consecutive same-tag commits collapse, so a slice
sent back by a later stage lands with the extra commit standing where the rework happened. That is the honest record,
and `development-process.md` chose it deliberately over reordering history to look tidier.

## 4. If the rebase stops

A conflict means the fold could not replay cleanly. Nothing has reached master, and the backup ref still points at the
original commits, so there is no hurry and no damage.

Resolve it as an ordinary rebase conflict and `git rebase --continue`, or `git rebase --abort` to put the branch back.
Where the conflict is between two commits of the *same* slice, prefer the abort: the branch is still intact, and landing
it as more commits is better than resolving a conflict whose only purpose was cosmetic tidiness. Report what conflicted
either way.

## 5. Scope limit

This skill runs the landing and nothing else. It does not write code, specs, features or flows, and it does not fix a
slice that turns out to be unfinished — that belongs to whichever stage was skipped. Where landing reveals the slice is
not ready, **report it and stop**, leaving the branch where it is.
