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

Check the `.specs/backlog/` directory for entries related to this feature — they can be a useful source of
requirements, but confirm with the user before folding them in, since backlog entries are informal and may be
outdated.

## 2. Use the Template

You **must** use the official template located at `c:\Users\olgau\Developer\factor\.specs\templates\spec-template.md` as
your structural foundation. Do not invent a new format.

## 3. Emulate Existing Specs

When filling out the template sections, match the depth and formatting of existing robust specifications (like
`.specs/features/1-observation-creation/spec.md`).

Pay special attention to the **Technical Design** section, ensuring it covers:

* **Data Models:** Define entities, their properties, primary/foreign keys, and data types.
* **Application Layer:** Define the use cases or commands, including inputs and expected behaviors.
* **Storage Layer:** Define the necessary repository interfaces and implementation details.
* **User Interface:** Detail the required screens, components, and user interactions.

The **Verification Plan** section must include both *Manual Verification* steps and expectations for *Automated Tests*.

## 4. Saving the Spec

Save the final generated markdown file into a new directory:
`.specs\features\[feature-name]\spec.md`

*(Note: Create a logical, hyphenated directory name for the feature. If the project prefixes feature folders with
sequential numbers, check the `.specs/features` directory to determine the next logical number).*

## 5. Promote Backlog Items

If the feature originates from (or overlaps with) an entry in `.specs/backlog/`, remove that entry from the backlog
once the spec is saved, so the idea isn't left behind to later contradict the spec it became.

## 6. Scope Limit

Do **NOT** write any application code when this skill is invoked. Your sole responsibility is to produce the
specification document.
