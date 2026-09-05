---
name: change-committing
description: Commits work that is already done — picks the tag, stages by path, and writes a message a stranger can read. Use when the user asks for something to be committed. Not for landing a slice (see slice-landing).
metadata:
  version: "1.0.0"
---

# Change Committing

Every stage of a slice ends in a commit, and so does work that is no slice at all. `development-process.md` describes
the one-commit-per-stage record master keeps; this skill writes the commits that record is folded from.

Two things carry all the judgment: which tag the change takes, and whether its message means anything to someone who was
not here.

## 1. See What Is There

```bash
git status --porcelain
```

Read that list before staging anything, then stage by path:

```bash
git add <path> <path>
```

**Never `git add -A` or `git add .`.** Both sweep up whatever else the tree is carrying — an emulator artifact, a
scratch file, a database a run wrote. A file you did not expect to see is worth naming to the user rather than
committing.

## 2. Pick the Tag

One tag per commit, and on a `feat/` branch it is the stage's rather than a judgment call.

| Tag      | Carries                                                                      |
|----------|------------------------------------------------------------------------------|
| `[SPEC]` | a spec, its mockups, any ADR alongside it, and the backlog entry it promotes |
| `[IMPL]` | code and its unit tests                                                      |
| `[E2E]`  | Maestro flows, and the accessibility handles they need                       |
| `[FEAT]` | a feature file, and `domain-overview.md` where the slice changed a concept   |
| `[FIX]`  | a defect fixed off-slice                                                     |
| `[REF]`  | a change that leaves behaviour exactly as it was                             |
| `[DOC]`  | project documents, skills, ADRs, the root testing documents                  |
| `[TODO]` | a backlog entry changed on its own                                           |

**A tree holding two kinds is two commits.** Landing folds each run of same-tag commits into one, so an implementation
committed together with a backlog edit vanishes into the `[IMPL]` fold and master never shows the backlog changed. Stage
one set of paths, commit, then stage the next.

## 3. Write the Subject

`[TAG] Sentence case`, no full stop, short enough to read at a glance — about 70 characters.

On a slice branch the slice's own name serves every stage: `[SPEC] Metric Editing`, `[IMPL] Metric Editing`. Where a
stage did something that name does not cover, say that instead — `[E2E] Metric editing steps on the observation-editing
flow`. Off a branch, the subject says what the change does: `[DOC] Pin line endings to LF`.

## 4. Write the Body

Wrapped at 72 columns, and written for one reader: somebody scanning `git log` months from now, who was not in the
session and whose eye is moving down a list of commits that have nothing to do with each other. Every commit in that
list is asking for a few seconds of their attention.

* **Short sentences, plain words.** One clause-heavy sentence carrying four facts reads slower than four sentences
  carrying one each, and a log is read at speed.
* **Name the thing, then say what it now does.** A body whose subject is a decision rather than a part of the app makes
  the reader reconstruct which part it was about.
* **Lean on nothing that has been deleted.** The spec, its mockups and the conversation are gone by the time this is
  read. A sentence that only makes sense beside one of them makes no sense at all.
* **Nothing git already carries.** Not the file list, not the branch, not how the change was produced.
* **No body at all where the subject is the whole change.** A backlog entry or a one-line doc fix needs no second
  telling.

The message ends at the body. **No trailer** — no co-author line, no generated-by note.

### The difference this makes

Same commit, same facts. Dense:

> `update` now writes the Observation's columns and a row per Metric it holds in one transaction, refusing an aggregate
> that has lost one. The Metric card is extracted from the creation form and shared, locked on a stored Metric so its
> type and constraint are stated rather than offered.

Scannable:

> Saving an Observation now writes its Metrics too, in one transaction. The Metric card is shared with the creation
> form. On a stored Metric the type and bounds are shown as text instead of pickers, so they cannot be changed.

## 5. Commit

Pass the message on stdin, so wrapping and punctuation survive the shell:

```bash
git commit -F - <<'EOF'
[IMPL] Metric Editing

Saving an Observation now writes its Metrics too, in one transaction.
EOF
```

Then show the user `git log -1 --stat`, so what landed is visible without them asking.

## 6. Scope Limit

Commits, and nothing else.

* **No amending.** `development-process.md` dropped that deliberately: where a later stage sends an earlier one back,
  the extra commit stands where the rework happened, and that is the honest record.
* **No rebasing, no pushing, no landing.** Everything that rewrites history belongs to `slice-landing`, and pushing is
  the user's to ask for.
* **No doing the work.** This skill records a change somebody else finished. A tree that is not ready — a stage
  half-run, a file that should not be there — is reported, not committed around.
