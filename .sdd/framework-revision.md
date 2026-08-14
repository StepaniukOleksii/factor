# SDD Framework Revision — Specs Become Temporary, Features Become Durable

* Date: 2026-08-10
* Status: proposal, not yet adopted

**This document is itself a temporary artifact.** It describes a change to the framework and a plan to carry
it out. Once the migration is complete it is deleted — the framework it describes lives in
`development-process.md` and the skills, not here.

---

## 1. Why

Factor's specs try to be two documents at once: a record of a decision made on a date, and a description of
how the app behaves. Those two jobs pull in opposite directions. A record must not be rewritten, so a spec
whose behaviour later changes can only be *annotated* — which is where the "Superseded by" convention came
from, and why `2-1` spec now reads as four corrections interleaved with the text they correct.

The convention works when applied. What fails is everything around it:

* **Nothing writes backwards.** Across four skills there is exactly one authorised edit to an existing spec
  (`e2e-tester` §2, the E2E bullet). Marking what a new spec invalidates is nobody's job.
* **Discovery is manual.** `0-1` listed the documents it superseded from memory and missed `2-1`. ADR-3 was
  applied to `2-6`'s §3.2 and missed its Requirements and Verification.
* **The project already distrusts old specs.** `spec-creator` says outright that existing specs "are not the
  reference — they vary in age and quality." Thirty documents are being read past rather than read.

Making specs temporary removes the reason the annotation exists. A document that is discarded never needs a
correction; a document that describes *now* is rewritten rather than annotated, so it can never be half-right.

---

## 2. The Model

Four artifacts, split by lifetime rather than by subject.

| Artifact          | Lifetime                      | Answers                         | Location         |
|-------------------|-------------------------------|---------------------------------|------------------|
| **Backlog entry** | until promoted                | "someone should look at this"   | `.sdd/backlog/`  |
| **Spec**          | until the slice ships         | "what are we building, and how" | `.sdd/specs/`    |
| **Feature**       | permanent, rewritten in place | "what does the app do"          | `.sdd/features/` |
| **ADR**           | permanent, append-only        | "why is it built this way"      | `.sdd/adr/`      |

Ephemeral above the line, durable below it. Nothing durable is ever annotated as stale: a feature is rewritten,
an ADR is superseded by a later ADR.

### Lifecycle

```
backlog entry ──promote──▶ spec ──▶ code + tests ──▶ E2E flow ──▶ feature rewritten ──▶ spec deleted
                                      │
                                      └──▶ ADR, where a decision earns one
```

The feature file is rewritten **after** the implementation is done.

**A spec still on disk means the slice is not finished.** That is the whole queue mechanism — no separate
tracking file, no status field. `.sdd/specs/` at rest is empty.

The spec is retired only when all three are true: implemented and unit-tested, its E2E flow written and green
(or declared `None`), and its feature file rewritten to match. The last of those is what makes deletion safe.

### What is lost, and what isn't

Deleted specs stay in git forever. "Temporary" narrows the *read path*, it does not destroy anything.

**The feature rewrite and the spec deletion land in one commit.** That single rule makes git the index:
`git log` on a feature file reaches every spec that ever shaped it, at the commit where each one retired. No
list is maintained by hand, so no list can go stale — which is the same reason there is no version field.

---

## 3. Feature File Anatomy

`.sdd/features/<capability>.md` — a plain Markdown file of behavioural prose, carrying no implementation
detail. Every sentence claims to be true *now*.

```markdown
# <Capability Name>

## Goal

What this capability is for, from the user's side. Two or three sentences.

## Behaviour

What the app does. States, rules, edge cases — always as what happens rather than what does not. The bulk of
the file.

## Usage

How a user reaches and works the capability, in order. The narrative a newcomer reads.
```

Three sections under the title, and nothing else. Three things a first draft reaches for are deliberately
absent:

**No version number and no provenance list.** Git already records what changed and when.

**No implementation detail.** No file name, no component, no use case — behaviour only, so the file outlives
the code being rewritten under it.

---

## 4. Decisions That Fall Out

### 4.1 A feature is bounded by a user action, not by a slice

**A feature is named for an action**, as a noun of the verb: `observation-creation`, `observation-listing`,
`record-deletion`, `trend-time-range-selection`. A name that is a *thing* — `record-form`, `trend-charts` — names a
screen or a component rather than something a user does, and a file named after a screen quietly becomes a
description of that screen's implementation, which is the failure this whole revision is trying to escape.

**Two actions sharing a screen are still two features.** The Record form serves both creating and editing, and
the temptation is to make the form the feature because the code does. That names the implementation. Creating
a Record and editing one are different things a user does, arrive from different places, and end differently —
they get a file each, and what they genuinely share becomes a third feature of its own rather than a copy in
each or a possession of one.

That third file is the test of the rule: what a user fills in — values per Metric type, the note, and what
happens to it all if they leave — is itself something they do, and it reads better as one description than as
the same description twice. So the shared behaviour is not homeless, and neither mode-file owns the other's
rules.

Feature count therefore has no fixed relation to spec count. Some features absorb six slices, some exactly
one — `observation-deletion` was delivered whole in `1-4` and needs no company. Thirty specs map to
twelve features in §6.2, and the ratio is an outcome, not a target. What features get for free is their own
tree rather than a `feature.md` beside each `spec.md`: co-location would force the ratio to 1:1 and rebuild
the thirty-fragment problem in a new folder.

### 4.2 Epics retire

An epic exists to group specs into a shared outcome and hold permanent numbering so cross-spec links stay
valid. With specs ephemeral, both jobs disappear — links into a deleted document need no stability, and a
folder whose contents are deleted on completion is a folder that is always empty.

The grouping itself survives, because the three epics already *are* the feature areas — observation
management, record management, visualization. It just moves to the feature tree.

Specs move to a flat `.sdd/specs/`, named by capability with no numeric prefix. Numbering existed for
permanence; nothing here is permanent.

### 4.3 E2E flows group into per-feature folders

`testing-android-e2e.md` currently names flows after spec folders and calls the filename "the entire coverage
map." With specs deleted, that map points at nothing.

Granularity changes with it. Slice-sized was never chosen so much as inherited from one-flow-per-spec, and it
buys six near-identical relaunch-and-reseed passes where a feature absorbed six slices. The rule becomes one
flow per feature by preference — a slice touching covered ground extends the flow rather than adding one —
splitting only where a case is genuinely separate or a merged flow grows long enough that a failure stops
naming what broke. Phase 4 does the merging.

Each feature still gets a folder, held even when it contains a single flow, so that coverage stays a directory
check and property flows are marked by sitting outside every folder.

```
.maestro/flows/observation-creation/observation-creation.yaml
.maestro/flows/record-value-entry/record-value-entry.yaml
                                 /numeric-metric-boundaries.yaml
.maestro/flows/persistence-restart.yaml
```

The folder takes the feature file's own name, so the two need nothing to bind them and the feature file says
nothing about its flows — the map is the filesystem, in both directions.

**This costs a config change.** `.maestro/config.yaml` sets `flows: ["*.yaml"]` — deliberately non-recursive,
with a comment explaining that recursion would run every fragment in `subflows/` as a flow of its own. Nesting
flows one level down therefore needs a dedicated parent (`flows/`) so `subflows/` stays outside the glob,
rather than a negation pattern whose support I have not verified. Property flows belonging to no feature —
`persistence-restart.yaml` — sit directly in `flows/`.

The convention this replaces is already breaking down on its own. `create-observation-validation.yaml`
(`42f19f7`) was written from a `backlog-test.md` entry rather than from a spec, so it has no number to carry
and no spec folder to be named after — and it covers the Create Observation screen, which means the filename
map cannot place it while the folder model puts it in `flows/observation-creation/` without a decision. Two
of the twenty-nine flows now sit outside a scheme that claims to be exhaustive.

### 4.4 Technical reasoning splits three ways

The most valuable thing in the specs is reasoning that is neither behaviour nor architecture — `3-10` §3.2 on
why `BackHandler` rather than `beforeRemove`, why the listener registers on focus, why
`android:enableOnBackInvokedCallback` matters. It has no place in a behavioural feature file, and losing it
means the next agent re-derives it or breaks it. It splits by kind, using machinery that already exists:

* **Alternatives weighed and rejected → ADR.** This is precisely the shape of the ADR template's
  `Alternatives` section. It requires lowering the bar in `architecture.md` from "significant, hard-to-reverse"
  to include "small, but a later change would get it wrong without knowing." ADRs are cheap; the template is
  nine lines. The bar has in practice already moved: [ADR-4](adr/4-name-uniqueness-rule-placement.md) settles
  which layer enforces a name-uniqueness rule — narrower than the storage and navigation choices
  `architecture.md` gives as its examples, and it is the reasoning that would otherwise have died inside
  `1-6`'s spec. Lowering the bar ratifies what is already happening rather than inviting something new.
* **A constraint outside the code forcing the code's shape → a code comment.** `coding-guidelines.md` already
  permits exactly this, and `spec-implementer`'s first comment test is *"something outside the code forced it
  to be this way."* The `enableOnBackInvokedCallback` note is a textbook case and should have been a comment
  all along.
* **Everything else dies with the spec, deliberately.** Choices that could have gone another way get no
  memorial; that is the same standard the comment rules already apply.

### 4.5 Verification splits by lifetime

A spec's Manual Verification is a one-time acceptance checklist against seed fixtures. It is not behaviour —
it names `mixed metrics` and `dense` — and it does not belong in a feature file. It dies with the spec.

Durable verification is the automated suite: Vitest for rules and edge cases, Maestro for the representative
pass. Neither needs a document to point at it — the flows sit in a folder named after the feature, and the
Vitest files sit beside the code they test, as `coding-guidelines.md` already requires.

### 4.6 Design mockups die with the spec

A mockup is an *input* to a slice: it shows one screen as one feature intended it, at one moment, and the next
slice touching that screen invalidates it. Unlike prose it cannot be cheaply rewritten in place — it is HTML
or a PNG — so "rewrite rather than annotate" is not available to it. Keeping it durable would reintroduce the
whole problem in the one artifact type least able to survive it.

So `design/` stays beside the spec while the slice is in flight, feeding `spec-implementer` as it does today,
and is deleted with it. The durable design record is `design.md` — the system, not a screen — plus the running
app. If a per-screen visual reference is ever wanted, a screenshot of the built app is the honest artifact,
and `emulator-verifier` already produces those.

---

## 5. Documents to Change

### Rewritten

| Document                               | Change                                                                                                                                                                                                                                         |
|----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `.sdd/project/development-process.md`  | The artifact table, the lifecycle, the retirement gate. Delete "Epics and Features" and the numbering convention; replace with feature granularity and the flat spec tree. Keep "AI-First Development" and "Scoping a Spec" — both still hold. |
| `.claude/skills/spec-creator/SKILL.md` | Reads feature files for context instead of prior specs. Drops the epic-placement step and the numbering. Gains: name the feature file(s) this spec will change, so the update target is decided at write time, not recalled later.             |

### Amended

| Document                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                              |
|--------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `.claude/skills/spec-implementer/SKILL.md` | Reads the target feature file alongside the spec, so it knows what already exists. Does **not** update it, and does **not** delete the spec — both belong after E2E.                                                                                                                                                                                                                                                                |
| `.claude/skills/e2e-tester/SKILL.md`       | Flow naming loses the spec-folder rule. The §2 amend rule generalises in both directions: a declared flow that proves impractical *and* a `None` that proves writable both amend the source. Currently it says to stop on `None`, which forbids catching the `3-10` case.                                                                                                                                                           |
| `.sdd/project/coding-guidelines.md`        | Line 52 "Update specifications and ADRs when behavior or decisions change" → feature files and ADRs. Line 62 "update the specification before implementing" → still the spec, but say so unambiguously. Line 43's per-spec E2E rule → per-slice.                                                                                                                                                                                    |
| `.sdd/project/architecture.md`             | Lower the ADR bar per §4.4.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `testing-android-e2e.md`                   | "One flow per spec, named after the spec's folder" → one flow per slice, filed under `flows/<feature>/`. The filename stops being the coverage map; the folder is. "Whether a feature gets a flow is decided when its spec is written … the only place that decision is written down" → decided in the spec and expressed by the folder afterwards; a reason that generalises is added here as a rule, as the Skia one already was. |
| `.maestro/config.yaml`                     | `flows: ["*.yaml"]` → `["flows/*.yaml", "flows/*/*.yaml"]`, keeping `subflows/` outside the glob. Its comment explains the non-recursive glob and must be updated with it (§4.3).                                                                                                                                                                                                                                                   |
| `.sdd/backlog/*.md`                        | Header text on all five: "until they're ready to become a real spec" still holds; no change needed beyond `backlog-doc.md` entry 4, which this document promotes.                                                                                                                                                                                                                                                                   |

### New

| Document                                            | Purpose                                                                                                                                 |
|-----------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `.claude/skills/feature-writer/SKILL.md`            | Rewrites a feature file from a shipped spec, then retires the spec. Owns the deletion gate. Also the skill that runs the §6.2 backfill. |
| `.claude/skills/feature-writer/feature-template.md` | The §3 anatomy. Lives with the skill that writes feature files, not with `spec-creator`, which only reads them.                         |

### Deleted

| Document                                       | Reason                                                                           |
|------------------------------------------------|----------------------------------------------------------------------------------|
| `.claude/skills/spec-creator/epic-template.md` | Epics retire (§4.2).                                                             |
| `.sdd/epics/*/epic.md`                         | Same. Any Goal text still saying something moves into the matching feature file. |

### Unchanged

`product.md`, `domain-overview.md`, `design.md`, `tech-stack.md`, all four ADRs, `example-spec.md` (the spec
format itself does not change — only its lifetime), `presentation-layer` and `emulator-verifier` skills,
`testing-data.md`, `testing-android-manually.md`.

---

## 6. Migration Plan

Five phases. Phases 1–2 are the expensive ones and are worth doing before the framework docs change, so the
backfill is written against the app as it is rather than against a half-updated process.

### Phase 1 — Repair the known-stale specs first

`2-1` (four sites) and `2-6` (five sites) still instruct an implementer wrongly. Fix them under the *current*
convention before backfilling, so the feature files are written from correct sources. Roughly an hour.

Do not fix anything else. The backfill in Phase 2 catches the rest by reading the app.

### Phase 2 — Backfill the feature tree

One pass, not lazily — two regimes coexisting for months is worse than a day of work, and writing these files
*is* an audit of what the app actually does, which is how this whole problem surfaced.

Each file is written from the running app and the code, using the old specs only as a checklist of what to
look for. Where a spec and the app disagree, **the app wins and the disagreement is recorded** — that list is
the real output of this phase.

Proposed initial set, mapped from all 30 existing specs:

| Feature file                    | Absorbs                                    | Action named |
|---------------------------------|--------------------------------------------|--------------|
| `observation-creation.md`       | `1-1`, `1-5`, `1-6`                        | creating     |
| `observation-listing.md`        | `1-2`                                      | listing      |
| `observation-viewing.md`        | `1-3`                                      | viewing      |
| `observation-deletion.md`       | `1-4`                                      | deleting     |
| `record-creation.md`            | `2-1`                                      | creating     |
| `record-editing.md`             | `2-4`, `2-5`                               | editing      |
| `record-value-entry.md`         | `2-6`, `2-7`, `2-8`, `2-9`, `2-10`, `2-11` | entering     |
| `record-listing.md`             | `2-2`                                      | listing      |
| `record-deletion.md`            | `2-3`                                      | deleting     |
| `trend-charting.md`             | `3-1`, `3-2`, `3-6`, `3-9`, `3-11`, `3-12` | charting     |
| `trend-exploration.md`          | `3-3`, `3-7`, `3-8`, `3-10`                | exploring    |
| `trend-time-range-selection.md` | `3-4`, `3-5`                               | selecting    |

`0-1` gets no file of its own: its user-visible behaviour distributes across the twelve above, and its
reasoning is ADR-2's. See §7.

The three-way split of the Record form is the only non-obvious row, and it follows the specs' own mode
boundaries rather than a guess:

* **`record-creation.md`** — `2-1` only. Reaching the form from an Observation tile, and where saving lands.
* **`record-editing.md`** — `2-4` (reopening a stored Record, pre-populated) and `2-5` (changing its
  timestamp, which `2-5` states is edit mode only).
* **`record-value-entry.md`** — the six specs that say *both routes* outright: the per-type inputs
  (`2-6` Boolean, `2-11` Enum, `2-10` Numeric bounds), the Metric description help (`2-7`), the note (`2-9`,
  "on both routes — creating a Record and editing one"), and the unsaved-changes confirmation (`2-8`, "both
  routes are covered"). Six of the nine Record-form specs are mode-neutral, which is why this is a feature and
  not an appendix to one of the other two.

Records end up with five files to Observations' four — creation, editing, entry, listing, deletion — which is
what a Record actually supports.

### Phase 3 — Rewrite the framework documents

Everything in §5, in one commit so the framework is never internally inconsistent. `development-process.md`
and `spec-creator` first, since the others reference them.

### Phase 4 — Regroup and consolidate the E2E flows

Two jobs, and the second is the expensive one.

**Move.** All 29 flows into `.maestro/flows/<feature>/`, stripping numeric prefixes, and
`persistence-restart.yaml` to `flows/`. Update `config.yaml`'s glob and comment, and every `runFlow:`
reference (`subflows/launch.yaml` → `../../subflows/launch.yaml`, since flows land two levels deeper).
`backlog-test.md` needs nothing — `42f19f7` retired its last entry, so the file is now header-only.

**Consolidate.** The 29 are slice-shaped, written under the one-flow-per-spec rule that
`testing-android-e2e.md` no longer states: six flows land in `trend-charting/` alone, each relaunching the app
and reseeding to walk a path the one before it mostly already walked. The rule is now one flow per feature by
preference, so each folder is merged down toward a single pass, splitting only where a case is genuinely
separate or the merged flow grows long enough that a failure stops naming what broke. This is a rewrite, not a
move: work folder by folder, keeping every assertion that covers something the others do not, and run each
folder green before starting the next.

Consolidating here rather than letting it happen slice by slice is the same call Phase 2 made — two regimes
coexisting for months is worse than the work, and the merge is where the redundancy between neighbouring flows
actually becomes visible.

Then run the full suite — `npm run e2e` — since this touches every flow file and the config that finds them,
and proves nothing until it is green from cold. Expect it to get faster.

### Phase 5 — Retire the old tree

Delete `.sdd/epics/` and this document. Git keeps both.

### Ordering constraints

* Phase 1 before 2 — feature files must not inherit known-wrong statements.
* Phase 2 before 3 — the backfill needs the old tree intact to work from.
* Phase 4 after 2 — flow folders take their names from the feature files.
* Any in-flight spec finishes under the old rules; do not migrate a slice mid-implementation.

---

## 7. Open Questions

**Settled:** epics retire in favour of a flat `.sdd/specs/` (§4.2), and `feature-writer` owns both the feature
rewrite and the spec deletion (§5). Nothing remains open.

1. **`app-navigation.md` gets no file** — decided while writing Phase 2, as §6.2 said it would be. Every
   user-visible consequence of `0-1` belongs to an action that already has a file and now carries it: a
   saved Record landing on the Observation (`record-creation`), cancelling returning where the form was
   opened from (`record-creation`), the list refreshing on return and back exiting the app from it
   (`observation-listing`), the chart window surviving a Record and dying on leaving
   (`trend-time-range-selection`), back stepping out of a zoom (`trend-exploration`), and a deleted Observation
   taking its journey with it (`observation-deletion`). What is left is the stack itself, whose reasoning
   ADR-2 holds. A file for it would be named after a mechanism rather than an action — the failure §4.1
   describes.
