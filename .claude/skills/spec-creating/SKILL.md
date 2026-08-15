---
name: spec-creating
description: Creates a new feature specification based on the skill's worked example and the project guidelines. Triggered when the user asks to create or write a spec for a new feature.
metadata:
  version: "2.0.1"
---

# Spec Creating

When tasked with creating a new feature specification, you must ensure the generated document rigorously adheres to the
project's standard structure and expectations.

## 0. Read Project Guidelines

Read these `.sdd/project/` documents before writing anything: `development-process.md`, `product.md`,
`domain-overview.md`, `design.md`, `architecture.md`, `tech-stack.md`.

Skip `coding-guidelines.md`; that's implementation concern, not spec creation.

## 1. Read What the App Already Does

`.sdd/features/` is the account of current behaviour, one file per user action. Read the files this slice
touches. Where what you are about to write contradicts one, **stop and ask the user** which is meant: the
feature file may be out of date, or the slice may be deliberately changing that behaviour. Both are ordinary,
and they produce different specs, so it is not a call to make on your own. A deliberate change has to be
stated in the spec — the feature file is rewritten from it once the slice ships.

`.sdd/specs/` is **not** context. It is empty when nothing is in flight, and anything sitting in it is a
slice someone else has not finished.

## 2. Information Gathering

Before writing the spec, ensure you have a clear understanding of:

- **Goal:** What is the feature trying to achieve?
- **Requirements:** What are the specific functional constraints and user flows?
- **Technical Design:** What data models, application logic, storage, and UI changes are needed?

If the user's initial prompt is too brief or ambiguous, **stop and ask clarifying questions** before you begin
generating the document.

Check the `.sdd/backlog/` directory for entries related to this feature — they can be a useful source of
requirements, but confirm with the user before folding them in, since backlog entries are informal and may be
outdated.

## 3. Name the Target Feature File

Decide which `.sdd/features/` file the shipped slice will belong to, and record it under the spec's date, like it's done
in the [example-spec.md](example-spec.md). `development-process.md` carries the rules this decision follows — how a
feature is named, and how large a slice should be.

* **Usually one file.** A slice that would rewrite several might be too big; check it against the scoping
  rules before accepting it.
* **A new file where the slice is the first of its capability.** Add `(new)` after the name, so nobody looks
  for a file that isn't there yet.

## 4. Writing the Spec

Read [example-spec.md](example-spec.md) and match its structure, depth, and voice. It defines the
document's format — do not invent another. It is a worked example built for this skill — a fictional feature
of a fictional app, so nothing in it can be mistaken for a Factor requirement. Take its shape, never its
subject.

**Each section has one job.** Never let one do another's:

* **Goal** — the problem, then one sentence naming the feature. Not a summary of the requirements.
* **Requirements** — one statement each of what must be true, phrased so it can be checked. Not why it is
  wanted, not how it will be built. Merge bullets that are really a single statement.
* **Technical Design** — the decisions, and the reasoning behind any that isn't obvious.
* **Verification** — the seed data a check needs, the manual steps, the automated tests expected, and the E2E
  flow in a section of its own.

**Say it once.** The Goal does not summarize the Requirements; the Technical Design does not repeat them back,
it turns them into decisions. Where something is already stated or argued elsewhere, link to it rather than
restating it — a feature file for existing behaviour (`../../features/record-listing.md`), a `.sdd/project/`
document for a standing rule, an ADR for a settled decision. Copies drift apart; a link cannot.

**Don't restate the domain.** What an Observation, a Metric or a Record *is* — its parts, its rules, its
limits — is `domain-overview.md`'s. A spec says what this slice does with them.

**Describe, don't implement.** Write the Technical Design in prose and structured bullet lists. Name entities,
fields, types, methods, and components with inline code formatting (e.g. `observationId: UUID`,
`CreateObservationUseCase`), but do **not** include code blocks containing actual implementation — function
bodies, JSX, full type/interface declarations, or anything resembling a diff. Choosing exact syntax and control
flow is the implementer's job, not the spec's: embedding it in the spec creates a second, unmaintained copy of
the implementation that silently drifts from the real code as the feature evolves.

**Prefer prose to nested bullets.** A paragraph carries reasoning that a bullet tree flattens away. Use bullets
for genuine lists — states, props, test cases — not to shard one explanation into fragments.

**Brevity is not vagueness.** Cut restatement, never content. Keep every decision the implementer would
otherwise have to guess or re-derive: why something lives where it does, what happens at the edge case, which
existing pattern to follow.

**Reuse the seeded fixtures.** Before writing a manual step that enters data by hand, check `testing-data.md`
for a seeded Observation or Metric already covering the scenario, and name it in the step. Add seed data only
when nothing fits; only a complex feature needs that addition written up in `testing-data.md`.

**Decide the E2E flow, in a section of its own.** `testing-android-e2e.md` states which slices get one and how
flows are filed; the preference is to extend the feature's existing flow rather than add another beside it.

Verification's `E2E Flow` section carries the decision, and it is written to be lifted whole: the flow may be
written long after this spec is deleted, and the section is copied into the test queue as the brief. So name
the flow to extend or the one to write, the fixture it opens from, what the pass should cover, and any handle
the app does not expose yet. Or `None`, with the reason — which queues nothing at all.

**Draw the screens the slice changes.** A slice that introduces a screen or reshapes an existing one needs a
mockup; one that changes no visible layout does not. Produce one mobile-width HTML file per screen, showing it
as it will look once the slice ships — the final state only, not a set of variants or a before-and-after.
Follow `design.md` and the screens the app already has, and take colors, type and radii from
`src/presentation/theme/` so the mockup and the build cannot disagree.

**Write the ADR if needed, and cite it.** Where the Technical Design weighs an alternative and rejects it, that
reasoning outlives the spec — so it goes into an ADR as part of writing this spec, not left as a note for
someone to extract later. Nothing rescues it once the spec is deleted. Write it from
[adr-template.md](adr-template.md), save it to `.sdd/adr/[next-id]-[title].md`, and have the Technical Design
link to it rather than argue the decision twice. `architecture.md` states the bar, which is low: a decision a
later change would get wrong without knowing is enough.

## 5. Saving the Spec

Save to `.sdd/specs/[slice-name]/spec.md` — a flat tree, one folder per slice, named for the capability in
hyphenated lowercase (`record-note`, `name-uniqueness`). There is no numbering and no grouping folder.

Design mockups for the slice go in a `design/` folder beside it. Both the spec and its mockups are deleted
when the slice retires, so nothing here is written to last.

## 6. Clear the Promoted Backlog Entry

If the feature originates from (or overlaps with) an entry in `.sdd/backlog/`, remove that entry from the backlog
once the spec is saved, so the idea isn't left behind to later contradict the spec it became.

## 7. Scope Limit

Do **NOT** write any application code when this skill is invoked. This skill only writes documents.
