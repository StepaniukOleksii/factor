---
name: feature-writing
description: Writes the feature file for a newly shipped capability, or rewrites the one an implemented slice made out of date, then deletes that slice's spec. Use when the spec's boxes are settled. Not for writing specs (see spec-creating) or code (see spec-implementing).
metadata:
  version: "1.1.0"
---

# Feature Writing

A feature file describes what the app does today. Shipping a slice makes that description out of date, so this
skill writes the file again from what was actually built — or writes it for the first time, where the slice
introduced the capability — and then deletes the spec the slice came from.

## 1. Check the Slice Is Done

The spec's boxes say whether it is. `Implemented` must be ticked, and `E2E` ticked or marked `n/a`. An
unsettled box means a stage is still to run, and the flow it is waiting on can still send the code back —
so **stop and tell the user which box is open** rather than describing behaviour that may yet change.

## 2. Read What Shipped

Three sources, in this order of authority:

* **The code.** What actually shipped, and what the file has to describe. Where a screenshot would settle a
  question faster than reading, `emulator-verifying` takes one.
* **The spec.** What was intended — a checklist of what to look for, not the thing being described. Where it
  and the app disagree, **the app wins and the disagreement is reported**, not written up as though it shipped.
* **The feature file as it stands**, where one exists. What the file claimed before — you are rewriting it, not
  appending to it. The spec's `* Feature:` line names the target, and marks it `(new)` where the slice is the
  first of its capability and there is nothing yet to read.

## 3. Write the File

`.sdd/features/[capability].md`. Read [example-feature.md](example-feature.md) and match its structure, depth
and voice — it defines the format. It describes a fictional app, so take its shape and never its subject. The
files in `.sdd/features/` are the real examples; read the ones nearest your subject before writing.

### The shape

* **Three sections under the title, and nothing else.** No heading level below them. A long Behaviour is a run
  of paragraphs, each opening with a bold lead-in naming its sub-topic (**Name.**, **Description.**,
  **Metrics.**) — length is not a licence to add a heading. Where sub-topics under one lead-in need marking
  off, italics keep them subordinate instead of competing with it.
* **No version number and no provenance list.** Git records what changed and when.
* **No implementation detail.** No file name, no component, no use case — behaviour only, so the file outlives
  the code being rewritten under it.
* **Usage needs all three beats:** how the capability is reached, how it is worked in order, and where the user
  ends up. "You stay where you are" is a landing too.

### The prose

* **Only what this capability does.** No sentence whose subject is another feature — not what another screen
  displays, not another feature's rules or gestures. Such a sentence goes stale when that other feature changes.
* **But own both ends of the action.** The gesture that reaches this capability, and the place it leaves the
  user, are this feature's to state. What that place displays in general is not.
* **Limits are stated as behaviour, without the number.** "The field stops accepting characters at its limit
  and shows a counter" — the number itself sits in `domain-overview.md`, beside the field it bounds.
* **Say what it does, never what it does not.** No absent-capability sentences, including ones that look like
  they describe this capability's own surface. What such a sentence protects survives as a positive statement:
  "there is no undo" becomes "the removal is permanent". Roadmap phrasing ("planned", "not settled yet") and
  historical contrast ("no longer", "rather than always") go with them.
* **Say why, not where.** Explain the choice this feature made rather than pointing at where a rule lives. The
  purpose of a *concept*, though, belongs to `domain-overview.md`.
* **Link every hand-off.** Wherever a sentence defers to another feature — a section it declares but does not
  describe, the destination of an action, the screen it is reached from, the rules behind a refusal it only
  names — that mention is a relative Markdown link, every time and not only on first mention. A concept named
  in passing is not a hand-off.
* **Say each thing once, including what the previous sentence already entails.** The repeat to watch for is not
  the one that copies words. The test: what would a reader not know if this sentence were deleted? Nothing —
  cut it.

## 4. Update the Domain Overview if a Concept Changed

Where the slice changed what an Observation, a Metric or a Record *is* — a new field, a changed invariant, a
new limit — rewrite that part of `domain-overview.md` in the same pass. The prose rules above hold there too;
the last one in particular came out of that file.

A slice that only changed what a screen does with a concept leaves it alone.

## 5. Retire the Slice

Delete `.sdd/specs/[slice-name]/` entirely — the spec and its `design/` mockups with it. That deletion and the
feature rewrite belong together.

## 6. Scope Limit

This skill writes documents. No application code, no tests, no flows. Landing the slice's branch is
`slice-landing`'s, and it runs after this.

If the rewrite reveals that the app is wrong, **report the defect — do not fix it here, and do not describe the
intended behaviour as though it shipped.** A feature file that describes an intention is worse than one that is
out of date, because nothing later contradicts it.
