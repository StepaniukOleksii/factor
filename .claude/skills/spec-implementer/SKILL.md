---
name: spec-implementer
description: Implements a specific feature specification. ONLY use this skill when the user explicitly asks to implement a spec (e.g., "Implement .sdd/epics/..."). Do NOT use this skill for general fixes, bugs, or minor adjustments.
metadata:
  version: "1.7.1"
---

# Spec Implementer

When the user asks you to implement a specification, follow these steps:

## 1. Understand the Request

* Identify the path to the main `spec.md` file (e.g.,
  `.sdd/epics/[epic-id]-[epic-name]/[epic-id]-[feature-id]-[feature-name]/spec.md`) mentioned in the user's prompt.
* Identify if a specific design file (e.g., an HTML file) is mentioned.

## 2. Read the Specification and Design

* Read the contents of the `spec.md` file to understand the feature requirements.
* Read design files from the feature's `design/` subfolder (sibling to its `spec.md`) to ensure the screen design
  corresponds to the requirements. If design is represented by HTML file, make sure to **use only the mobile version**.

## 3. Read Project Guidelines

* You **must** read these `.sdd/project/` documents before implementing: `product.md`, `domain-overview.md`,
  `design.md`, `architecture.md`, `tech-stack.md`, `coding-guidelines.md`.

* Skip `development-process.md`; that's spec creation concern, not implementation.

* **Do not use `.sdd/backlog/` as a requirements source.** It holds an informal idea/issue list, not specs, and its
  contents may be stale or contradict the spec you are implementing. Requirements come only from the target
  `spec.md` and the `.sdd/project/` guidelines above.

## 4. Implement

* Implement the feature exactly as described in the specification and design.
* Ensure the implementation fully respects the general guidelines from `.sdd/project/`.
* Take care not to deviate from the provided specification.
* **Resolve Contradictions:** If you find that the feature specification contradicts itself, or if it contradicts the
  general project guidelines, **DO NOT make assumptions**. You **MUST** stop and ask the user clarification questions
  before proceeding with the implementation.

## 5. Database Schema Changes

* If the feature changes the database schema (adding, renaming, or dropping a column or table), **stop and ask
  the user** whether a special in-place migration is needed to preserve existing data, or the database can just
  be recreated from scratch. Do not assume either approach.

## 6. Reuse Seeded Test Data

* If the repo has a `testing-data.md` (seeded dev/QA fixture data, loaded via a "Reseed test data" dev
  command), check whether an existing seeded observation or metric already covers the feature's manual
  verification scenarios before describing new manual data entry.
* Reference the specific seeded observation/metric in the spec's Verification Plan section for each
  scenario it covers. Only propose new seed data if nothing existing covers the scenario.

## 7. Verify

* Run `npm run test` and `npm run typecheck`. Both must pass before you report the implementation done.
* **Never attempt `expo start --web` or any browser preview.** This app has no working web target —
  `expo-sqlite` hangs at startup on web, and `@react-native-community/datetimepicker` has no web build —
  so it cannot demonstrate the change. Don't try it and then report the failure; just skip it.
* On-device Android verification (`testing-android-manually.md`) is the user's own reference — don't read or
  run it yourself.
* **Emulator/visual verification is not this skill's job.** It's a separate concern, covered by the
  `emulator-verifier` skill — invoke that one if the user explicitly asks for it.

## Important Note

This skill is strictly reserved for the initial implementation of features from specification documents. If the user
asks for bug fixes, adjustments, or modifications to already implemented code without asking to implement a new spec, do
**not** use this skill.
