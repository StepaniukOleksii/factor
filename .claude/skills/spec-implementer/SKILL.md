---
name: spec-implementer
description: Implements a specific feature specification. ONLY use this skill when the user explicitly asks to implement a spec (e.g., "Implement .specs/features/..."). Do NOT use this skill for general fixes, bugs, or minor adjustments.
---

# Spec Implementer

When the user asks you to implement a specification, follow these steps:

## 1. Understand the Request

* Identify the path to the main `spec.md` file (e.g., `.specs/features/[feature-name]/spec.md`) mentioned in the user's
  prompt.
* Identify if a specific design file (e.g., an HTML file) is mentioned.

## 2. Read the Specification and Design

* Read the contents of the `spec.md` file to understand the feature requirements.
* Read design files from `.specs/features/[feature-name]/design/` folder to ensure the screen design corresponds to the
  requirements. If design is represented by HTML file, make sure to **use only the mobile version**.

## 3. Read Project Guidelines

* You **must** review the general project guidelines located in the `.specs/project/` directory. List the files in this
  directory and read them to ensure your implementation adheres to all overarching project standards, conventions, and
  architectural rules.

* **Do not use `.specs/backlog/` as a requirements source.** It holds an informal idea/issue list, not specs, and its
  contents may be stale or contradict the spec you are implementing. Requirements come only from the target
  `spec.md` and `.specs/project/` guidelines.

## 4. Implement

* Implement the feature exactly as described in the specification and design.
* Ensure the implementation fully respects the general guidelines from `.specs/project/`.
* Take care not to deviate from the provided specification.
* **Resolve Contradictions:** If you find that the feature specification contradicts itself, or if it contradicts the
  general project guidelines, **DO NOT make assumptions**. You **MUST** stop and ask the user clarification questions
  before proceeding with the implementation.

## Important Note

This skill is strictly reserved for the initial implementation of features from specification documents. If the user
asks for bug fixes, adjustments, or modifications to already implemented code without asking to implement a new spec, do
**not** use this skill.
