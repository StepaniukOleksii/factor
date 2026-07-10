---
name: spec-creator
description: Creates a new feature specification based on project templates and existing spec patterns. Triggered when the user asks to create or write a spec for a new feature.
---

# Spec Creator Skill

When tasked with creating a new feature specification, you must ensure the generated document rigorously adheres to the
project's standard structure and expectations.

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

Every feature lives inside an Epic folder under `.sdd/epics/`. Determine which one:

* Check `.sdd/epics/` for an existing epic (other than `0-unparented`) this feature clearly extends. If one looks
  like a fit, confirm with the user before attaching to it.
* If the user indicates this feature is the start of a new logical group of related features, ask whether to
  create a new epic for it.
* Otherwise, the feature belongs in `.sdd/epics/0-unparented/` — the default home for features that don't share a
  genuinely common, bounded outcome with anything else yet. Most features end up here.

## 2. Use the Template

You **must** use the official template located at `.sdd/templates/spec-template.md` as your structural foundation.
Do not invent a new format.

## 3. Emulate Existing Specs

When filling out the template sections, match the depth and formatting of existing robust specifications (like
`.sdd/epics/1-observation-management/1-1-observation-creation/spec.md`).

Pay special attention to the **Technical Design** section, ensuring it covers:

* **Data Models:** Define entities, their properties, primary/foreign keys, and data types.
* **Application Layer:** Define the use cases or commands, including inputs and expected behaviors.
* **Storage Layer:** Define the necessary repository interfaces and implementation details.
* **User Interface:** Detail the required screens, components, and user interactions.

The **Verification Plan** section must include both *Manual Verification* steps and expectations for *Automated Tests*.

## 4. Saving the Spec

Every feature is saved inside its epic folder under `.sdd/epics/`, using a composite id `[epic-id]-[feature-id]`
where `feature-id` starts at 1 and increments within that specific epic (a separate counter per epic):

`.sdd\epics\[epic-id]-[epic-name]\[epic-id]-[feature-id]-[feature-name]\spec.md`

* If no epic was a fit, use `.sdd/epics/0-unparented/` as the epic folder (id `0`).
* If the feature belongs to a new epic that doesn't exist yet, create it first using
  `.sdd/templates/epic-template.md`, saved as `.sdd/epics/[epic-id]-[epic-name]/epic.md` (check `.sdd/epics/` for
  the next sequential epic id). Populate its Goal from the shared purpose of the features that will live inside
  it. The `Related ADRs` section is optional — omit it entirely unless an ADR actually relates to this epic.
* No cross-links are required between a feature spec and its epic — folder co-location is the association. Do
  not add backlink lines to `spec.md` or maintain a feature list inside `epic.md`; the folder's contents are the
  source of truth for which features belong to the epic.
* Numbers, once assigned, are never reused or renumbered — if a feature is abandoned, leave the gap rather than
  shifting the ones after it.

*(Note: Create a logical, hyphenated name for the feature folder.)*

## 5. Promote Backlog Items

If the feature originates from (or overlaps with) an entry in `.sdd/backlog/`, remove that entry from the backlog
once the spec is saved, so the idea isn't left behind to later contradict the spec it became.

## 6. Scope Limit

Do **NOT** write any application code when this skill is invoked. Your sole responsibility is to produce the
specification document (and, when introducing a new epic, its `epic.md`).
