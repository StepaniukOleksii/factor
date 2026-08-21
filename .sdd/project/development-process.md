# Development Process

## Purpose

This document defines how work gets planned, specified, implemented and recorded in Factor, and why the project is
structured this way. The skills under `.claude/skills/` carry out this process — they reference this document when it's
necessary rather than repeating it.

---

## AI-First Development

Factor is built AI-first: most implementation work is carried out by AI coding agents working from written
specifications, not from verbal context or tribal knowledge.

This has direct consequences for how project documentation and specs must be written:

* Write things down. If a decision, constraint, or convention isn't documented, an agent starting a fresh session has no
  way to know it.
* Be explicit and unambiguous. Short, direct statements are easier for a model to apply correctly than long, hedged
  prose.
* Keep documents lean. Every extra page is something a future session has to read and reconcile — say it once, in the
  right place.
* Never duplicate the same instruction across multiple documents. Duplication drifts out of sync over time, and
  conflicting instructions in different files are worse than no instructions at all.

---

## Spec-Driven Development

All product functionality is divided into slices, each defined through a spec before it is implemented, and every code
change traces back to one. Project knowledge lives under `.sdd/` in artifacts, split by lifetime rather than by subject:

| Artifact            | Lifetime                      | Answers                         | Location                          |
|---------------------|-------------------------------|---------------------------------|-----------------------------------|
| **Backlog entry**   | until promoted                | "someone should look at this"   | `.sdd/backlog/`                   |
| **Spec**            | until the slice ships         | "what are we building, and how" | `.sdd/specs/`                     |
| **Feature**         | permanent, rewritten in place | "what does the app do"          | `.sdd/features/`                  |
| **Domain overview** | permanent, rewritten in place | "what does the app work with"   | `.sdd/project/domain-overview.md` |
| **ADR**             | permanent, rewritten in place | "why is it built this way"      | `.sdd/adr/`                       |

**No permanent document keeps a sentence that has stopped being true.** All three are rewritten in place, so every
sentence in each claims to be true now — a feature file and the domain overview say what the app does, an ADR says why
it is built that way.

No format is defined here. Each artifact's template or worked example lives with the skill that creates it.

### Standing guidelines

The rest of `.sdd/project/` is durable too, but it sets the rules the work follows rather than recording what the work
produced, so it changes when a decision changes rather than when a slice ships: `product.md` (what Factor is for),
`design.md` (UX and visual principles), `architecture.md` (layering, and the bar an ADR has to clear), `tech-stack.md`
(the approved technologies and what each costs), `coding-guidelines.md` (how code is written and tested), and this
document.

Three testing documents sit at the repository root, beside the code they describe:
[testing-android-e2e.md](../../testing-android-e2e.md),
[testing-android-manually.md](../../testing-android-manually.md), and [testing-data.md](../../testing-data.md).

---

## The Life of a Slice

A **slice** is the unit this process moves: one spec, on one branch, through the stages below, retired whole. One name
serves it throughout — `.sdd/specs/[slice-name]/`, `feat/[slice-name]` — and nothing else identifies it, because a slice
keeps no record of itself beyond the commits it leaves on master.

A slice is not a feature. A feature is durable and behavioural, and outlives every slice that shaped it. What survives a
slice is code, unit tests, an E2E flow, a rewritten feature file and sometimes an ADR; its spec, its mockups and its
branch are gone by then.

1. **The idea is captured** in `.sdd/backlog/`, where it stays informal until it is worth specifying. Not every slice
   starts here — a spec can be commissioned directly.
2. **The spec is written** to `.sdd/specs/`, named for the capability and contains all necessary information for
   implementation including design and E2E tests if needed. `spec-creating` owns this step, and cuts the slice's branch
   along with it.
3. **The slice is implemented** with its unit tests, until all unit tests and typecheck are green. `spec-implementing`
   owns this step.
4. **The E2E flow is written**, where the spec calls for one, against the code that now exists — briefed by the spec.
   `e2e-testing` owns this step.
5. **The feature file is written or existing file description is rewritten** to match what now exists — the feature file
   always, and `domain-overview.md` where the slice changed a concept rather than only what a screen does with it — and
   **the spec is deleted**. `feature-writing` owns this step.
6. **The branch is landed** on master. `slice-landing` owns this step.

**Stages run in order, and one slice is in flight at a time.** Anything else is a deliberate exception, said out loud.

### The stage checklist

A spec carries checkboxes for implementation and E2E testing under its date, and each stage ticks its own as it commits.
The E2E box is marked `n/a` from the outset where the spec calls for no flow.

The other two stages need none. A spec that exists is a spec that has been written, and a spec that *still* exists is
one whose feature file has not yet been rewritten. `feature-writing` deletes the spec once both boxes are settled.

### The branch

Each slice runs on `feat/[slice-name]`, matching its folder under `.sdd/specs/`. Every stage commits under its own tag:
`[SPEC]`, `[IMPL]`, `[E2E]`, `[FEAT]`.

Landing folds each run of commits sharing a tag into one, rebases onto master and fast-forwards, then deletes the
branch. Master carries no merge commits.

Work that is not a slice — a small fix, a documentation change, a backlog edit — can land on master directly under its
own tag, with no spec, no branch and no checklist.

### The spec retirement

A spec is retired only when both its boxes are settled, and its feature file rewritten to match what shipped.

The slice's mockups are deleted with it. A mockup shows one screen as one slice intended it, at one moment, and unlike
prose it cannot be cheaply rewritten in place. The durable design record is `design.md` — the system, not a screen —
plus the running app.

---

## Scoping a Slice

* A slice should be small and meaningful — not a whole feature area, and not a fragment too small to reason about on its
  own.
* Prefer vertical slices: a spec that delivers a complete, usable sliver of functionality end to end, rather than a
  horizontal layer (e.g. "the data model" or "the UI") that isn't useful by itself.
* Vertical slicing is a preference, not a rule. When it would force a spec to become convoluted, or blur its Goal, a
  smaller or differently-shaped slice that stays simple is the better choice — simplicity of the individual spec takes
  priority over strict vertical slicing.
* If a spec's goal can't be explained in a sentence or two, it's probably too big.

---

## Naming a Feature

A feature is named for a **user action**, as a noun of the verb: `observation-creation`, `record-deletion`,
`trend-time-range-selection`. A name that is a *thing* — `record-form`, `trend-charts` — names a screen or a component
instead, and a file named after a screen quietly becomes a description of that screen's implementation, which is the
failure a behavioural feature file exists to avoid.

* **Two actions sharing a screen are still two features.** One Record form serves both creating and editing, but a user
  reaching those two arrives from different places and ends somewhere different, so they get a file each.
* **Behaviour they genuinely share becomes a third feature they both link to**, rather than a copy in each or a
  possession of one. `record-value-entry.md` holds what the Record form accepts on either route.
* **Feature count has no fixed relation to spec count.** Some features absorb multiple slices; some are delivered whole
  by one. The ratio is an outcome, not a target.

---

## Where Technical Reasoning Goes

The most valuable thing in a spec is often reasoning that is neither behaviour nor architecture — why one API was used
rather than the obvious one, why a listener registers where it does. A feature file is behavioural prose and has no
place for it, so it is routed as the spec is written, while the reasoning is still being done:

* **Alternatives weighed and rejected → an ADR**, written alongside the spec and linked from its Technical Design, so
  the spec argues nothing it is the only copy of. That is precisely the shape of the ADR template's `Alternatives`
  section. `architecture.md` states the bar.
* **A constraint outside the code forcing the code's shape → a code comment.** `coding-guidelines.md` states the
  principle, and both `spec-implementing` and `e2e-testing` carry the tests a comment has to pass.
* **Everything else dies with the spec, deliberately.** A choice that could have gone another way gets no memorial — the
  same standard the comment rules already apply.

---

## Verification

Verification splits by lifetime like everything else.

* **Unit and component tests (Vitest) are durable.** They own the variations, edge cases, validation and error states,
  and sit beside the code they test. `coding-guidelines.md` states what has to be covered.
* **E2E flows (Maestro) are durable.** At least one flow per feature, one representative pass, filed under
  `.maestro/flows/[feature]/` so the folder is the coverage map. Whether a slice gets one is decided in its spec;
  [testing-android-e2e.md](../../testing-android-e2e.md) states the rules and how flows are written.
* **A spec's Manual Verification is a one-time acceptance checklist.** It names seeded fixtures rather than rules — it
  is not behaviour, and it dies with the spec.

Neither durable form needs a document pointing at it: the flows sit in a folder named after the feature, and the Vitest
files sit beside their source.

---

## Skills

`.claude/skills/` holds the core and helper procedures. Each core procedure is invoked deliberately — none runs as a
side effect of another, and each states its own scope limit.

| Core Skill          | Invoked when                                        | Owns                                                                     |
|---------------------|-----------------------------------------------------|--------------------------------------------------------------------------|
| `spec-creating`     | a new slice is to be specified                      | the spec and its branch, and clearing the backlog entry it promotes      |
| `spec-implementing` | the user asks for a named spec to be implemented    | the code and its unit tests                                              |
| `e2e-testing`       | a spec's Verification names a flow, or a flow fails | Maestro flows, and the accessibility handles they need to reach elements |
| `feature-writing`   | the spec's boxes are settled                        | the durable descriptions, and the spec deletion that retires the slice   |

Two helpers carry no decisions of their own, and are listed nowhere above: `slice-landing` performs step 6, and
`emulator-verifying` boots the app and screenshots it where a question is settled faster by looking.

---

## The Backlog

`.sdd/backlog/` holds informal, unrefined ideas and known issues, one numbered list per kind: `backlog-bug.md`,
`backlog-doc.md`, `backlog-feat.md`, `backlog-ref.md`, `backlog-test.md`.

* **It is not a requirements source.** Entries are informal and may be stale or contradict what was later specified. A
  spec may draw on one, but nothing is implemented from the backlog directly.
* **Promotion clears the entry.** Once an entry becomes a spec it is struck from the backlog, so the informal version
  cannot later contradict the specified one.
