---
name: comment-pruning
description: Audits the comments in code that already works. Corrects the ones that have drifted from what the code does, deletes the ones that earn nothing — restatements, block labels, assertion narration, justified free choices, delta phrasing — and tightens what survives. Never changes code.
disable-model-invocation: true
metadata:
  version: "1.0.0"
---

# Comment Pruning

`coding-guidelines.md` carries the rule. This is the procedure for applying it to comments somebody has already written.
Each is judged on its own, and keeps its line only by earning it.

## 1. Range

The slice by default: files the branch touched, plus anything uncommitted.

```bash
git diff --name-only master...HEAD; git status --porcelain
```

Of those, only the ones carrying code comments — `.ts` and `.tsx` under `src/`, shell and Node under `scripts/`.
Markdown, generated files and Maestro flows are out of range.

**Where that comes back empty**, on master with a clean tree, say so and **ask which file, directory, branch or commit
to take.** Never sweep the repository unasked.

**Read whole files, never the diff.** A comment is judged against what surrounds it — the field two lines up already
carrying the fact, the test name the sentence repeats — and a diff hides exactly that. Over a directory, take one at a
time and report between them.

## 2. Correctness First

A drifted comment is the only kind that actively misleads; the rest merely waste a line. Before judging whether one
earns its place, check that the code still does what it says and that a JSDoc block still sits on the declaration it
describes. Fix it or cut it — **never repair one by describing what changed.**

## 3. Cut

Any one of these is enough.

* **It restates the line beneath it.** Cover the sentence, read the code, write your own. Same sentence, delete.
* **It labels a block that names itself.** A blank line separates without claiming to inform.
* **It narrates an assertion.** The test name and the assertion have already said it twice.
* **It justifies a choice that was free.**
* **It argues against the alternatives.** That is an ADR's.
* **It quotes a value the code owns.** `32px`, `6 + 96 + 14`. One edit makes it false and nothing fails.
* **It documents somebody else's API.**
* **It is phrased as a change** — *now*, *previously*, *no longer*, *used to*.
* **It points at something ephemeral** — a spec path, a slice name, a branch.
* **It repeats a fact stated nearby**, on the interface above the field or in a test echoing its source.

## 4. Keep

An over-eager pass is worse than a verbose one: a restatement costs a line, a deleted constraint costs a defect and
nobody sees it go.

* **Something outside the code forced the shape** — a platform limit, a library defect, a race, a contrast ratio.
* **A line that reads as removable**, where the sentence is what stops the next reader deleting it.
* **A rule the type cannot carry** — a unit, a bound, a canonical form — on the field itself.
* **A file-level note**, at the top of the file.
* **Why this fixture**, and which of its properties the assertions turn on.

**Doubt protects reasons, not restatements.** A claim you cannot verify — a race, a device quirk — stays, and goes in
the report. A sentence you can watch the code saying is never a close call.

## 5. Finish

Cut each survivor to the shortest form that carries the reason, dropping every clause the code beside it already
carries. Leave a passing comment alone; rewriting one to taste is churn, and churn is where a real change hides in a
diff made of deletions.

Then `npm run test && npm run typecheck`. A `*/` taken along with the sentence above it silently swallows the code
below.

## 6. Report

What was cut, per file, with the test it failed. What was left in doubt. And where a comment disagrees with its code
badly enough to look like a defect, **say so and change nothing.**

The pass carries no commit tag of its own. On a slice branch it takes the tag of the stage whose comments it corrects.

## 7. Scope Limit

**Comments, and nothing else.** No rename, no extraction, nothing tidied on the way past — a pass that also changes code
cannot be reviewed as a comment pass. Defects and duplication go to `.sdd/backlog/`.
