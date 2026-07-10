# Development Process

## Purpose

This document defines how work gets planned, specified, and implemented in Factor, and why the project is
structured this way. `spec-creator` and `spec-implementer` implement this process — they reference this
document rather than repeating it.

---

## AI-First Development

Factor is built AI-first: most implementation work is carried out by AI coding agents working from written
specifications, not from verbal context or tribal knowledge.

This has direct consequences for how project documentation and specs must be written:

* Write things down. If a decision, constraint, or convention isn't documented, an agent starting a fresh
  session has no way to know it.
* Be explicit and unambiguous. Short, direct statements are easier for a model to apply correctly than long,
  hedged prose.
* Keep documents lean. Every extra page is something a future session has to read and reconcile — say it once,
  in the right place.
* Never duplicate the same instruction across multiple documents. Duplication drifts out of sync over time, and
  conflicting instructions in different files are worse than no instructions at all.

---

## Spec-Driven Development (SDD)

All product functionality is defined through a spec before it is implemented. Code changes should trace back to
a spec.

Project knowledge lives under `.sdd/`:

* `.sdd/project/` — standing guidelines that apply across the whole project (this document and its siblings).
* `.sdd/epics/` — feature specs, grouped into Epics (see below).
* `.sdd/adr/` — Architecture Decision Records for significant, hard-to-reverse technical choices.
* `.sdd/backlog/` — informal, unrefined ideas and known issues, not yet worth a spec.
* `.sdd/templates/` — the canonical templates for specs, epics, and ADRs.

---

## Epics and Features

Every feature spec lives inside an Epic folder under `.sdd/epics/`.

* An Epic is a group of features working toward one shared, bounded outcome. It holds an `epic.md` (see
  `.sdd/templates/epic-template.md`) plus one folder per feature.
* Features that don't share a genuinely common outcome with anything else live under the standing
  `0-unparented` epic. Most features start here — a new epic is only created when several features clearly
  belong together.
* Feature folders are numbered `[epic-id]-[feature-id]-[feature-name]`, where `feature-id` starts at 1 and
  increments within its own epic (a separate counter per epic).
* Numbers are permanent once assigned — never reused or renumbered, even if a feature is abandoned.
* An epic never lists its features, and a feature never links back to its epic — folder co-location is the
  association, so there is nothing to keep in sync.

---

## Scoping a Spec

* Specs should describe small, meaningful features — not an entire epic, and not a fragment too small to
  reason about on its own.
* Prefer vertical slices: a spec that delivers a complete, usable sliver of functionality end to end, rather
  than a horizontal layer (e.g. "the data model" or "the UI") that isn't useful by itself.
* Vertical slicing is a preference, not a rule. When it would force a spec to become convoluted, or blur its
  Goal, a smaller or differently-shaped slice that stays simple is the better choice — simplicity of the
  individual spec takes priority over strict vertical slicing.
* If a spec's goal can't be explained in a sentence or two, it's probably too big.
