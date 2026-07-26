---
name: spec-creator
description: Creates a new feature specification based on the skill's worked example and the project guidelines. Triggered when the user asks to create or write a spec for a new feature.
metadata:
  version: "1.7.0"
---

# Spec Creator Skill

When tasked with creating a new feature specification, you must ensure the generated document rigorously adheres to the
project's standard structure and expectations.

## 0. Read Project Guidelines

Read these `.sdd/project/` documents before writing anything: `development-process.md`, `product.md`,
`domain-overview.md`, `design.md`, `architecture.md`, `tech-stack.md`.

Skip `coding-guidelines.md`; that's implementation concern, not spec creation.

## 1. Information Gathering

Before writing the spec, ensure you have a clear understanding of:

- **Goal:** What is the feature trying to achieve?
- **Requirements:** What are the specific functional constraints and user flows?
- **Technical Design:** What data models, application logic, storage, and UI changes are needed?

If the user's initial prompt is too brief or ambiguous, **stop and ask clarifying questions** before you begin
generating the document.

Check the `.sdd/backlog/` directory for entries related to this feature — they can be a useful source of
requirements, but confirm with the user before folding them in, since backlog entries are informal and may be
outdated.

Determine which Epic this feature belongs to (see `development-process.md` for what an Epic is):

* Check `.sdd/epics/` for an existing epic (other than `0-unparented`) this feature clearly extends. If one looks
  like a fit, confirm with the user before attaching to it.
* If the user indicates this feature is the start of a new logical group of related features, ask whether to
  create a new epic for it.
* Otherwise, the feature belongs in `.sdd/epics/0-unparented/`.

## 2. Writing the Spec

Read `.claude/skills/spec-creator/example-spec.md` and match its structure, depth, and voice. It defines the
document's format — do not invent another. It is a worked example built for this skill — a fictional feature
of a fictional app, so nothing in it can be mistaken for a Factor requirement. Take its shape, never its
subject.

Existing specs under `.sdd/epics/` are not the reference. They vary in age and quality, and the older ones
predate the rules this skill now imposes.

**Each section has one job.** Never let one do another's:

* **Goal** — the problem, then one sentence naming the feature. Not a summary of the requirements.
* **Requirements** — one statement each of what must be true, phrased so it can be checked. Not why it is
  wanted, not how it will be built. Merge bullets that are really a single statement.
* **Technical Design** — the decisions, and the reasoning behind any that isn't obvious.
* **Verification** — the seed data a check needs, the manual steps, and the automated tests expected.

**Say it once.** The Goal does not summarize the Requirements; the Technical Design does not repeat them back,
it turns them into decisions. Where a decision is already argued in another spec or a `.sdd/project/`
document, link to it — `[Feature Name](../relative/path/spec.md) §3.3` — rather than restating its reasoning.
Copies drift apart; a link cannot.

**Describe, don't implement.** Write the Technical Design in prose and structured bullet lists. Name entities,
fields, types, methods, and components with inline code formatting (e.g. `observationId: UUID`,
`CreateObservationUseCase`), but do **not** include code blocks containing actual implementation — function
bodies, JSX, full type/interface declarations, or anything resembling a diff. Choosing exact syntax and control
flow is the implementer's job, not the spec's: embedding it in the spec creates a second, unmaintained copy of
the implementation that silently drifts from the real code as the feature evolves, and forces later specs to
carry "superseded by" corrections when it does.

**Prefer prose to nested bullets.** A paragraph carries reasoning that a bullet tree flattens away. Use bullets
for genuine lists — states, props, test cases — not to shard one explanation into fragments.

**Brevity is not vagueness.** Cut restatement, never content. Keep every decision the implementer would
otherwise have to guess or re-derive: why something lives where it does, what happens at the edge case, which
existing pattern to follow.

**Reuse the seeded fixtures.** Before writing a manual step that enters data by hand, check `testing-data.md`
for a seeded Observation or Metric already covering the scenario, and name it in the step. Add seed data only
when nothing fits; only a complex feature needs that addition written up in `testing-data.md`.

## 3. Saving the Spec

Save to `.sdd/epics/[epic-id]-[epic-name]/[epic-id]-[feature-id]-[feature-name]/spec.md`, following the numbering
convention in `development-process.md`.

If the feature belongs to a new epic that doesn't exist yet, create it first using
`.sdd/templates/epic-template.md`, saved as `.sdd/epics/[epic-id]-[epic-name]/epic.md` (check `.sdd/epics/` for
the next sequential epic id). Populate its Goal from the shared purpose of the features that will live inside it.
The `Related ADRs` section is optional — omit it entirely unless an ADR actually relates to this epic.

*(Note: Create a logical, hyphenated name for the feature folder.)*

## 4. Clear the Promoted Backlog Entry

If the feature originates from (or overlaps with) an entry in `.sdd/backlog/`, remove that entry from the backlog
once the spec is saved, so the idea isn't left behind to later contradict the spec it became.

## 5. Scope Limit

Do **NOT** write any application code when this skill is invoked. This skill only writes documents.
