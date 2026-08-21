---
name: spec-implementing
description: Implements a specific feature specification. ONLY use this skill when the user explicitly asks to implement a spec (e.g., "Implement .sdd/specs/..."). Do NOT use this skill for general fixes, bugs, or minor adjustments.
metadata:
  version: "2.1.0"
---

# Spec Implementing

When the user asks you to implement a specification, follow these steps:

## 1. Understand the Request

* Identify the path to the main `spec.md` file (e.g. `.sdd/specs/[slice-name]/spec.md`) mentioned in the user's prompt.
* Identify if a specific design file (e.g., an HTML file) is present.
* The slice runs on `feat/[slice-name]`, cut when the spec was written. Switch to it if you are not on it already, and
  never implement a slice on master.

## 2. Read the Specification and Design

* Read the contents of the `spec.md` file to understand the feature requirements.
* Read design files from the slice's `design/` subfolder (sibling to its `spec.md`) to ensure the screen design
  corresponds to the requirements. Each file is one screen at mobile width, as it should look once the slice ships.
* Read the feature file named on the spec's `* Feature:` line, unless it says the file is new. It describes the
  behaviour that exists today, which the spec assumes rather than repeats — a spec is a delta, and the feature file is
  what it is a delta from.

## 3. Read Project Guidelines

* You **must** read these `.sdd/project/` documents before implementing: `product.md`, `domain-overview.md`,
  `design.md`, `architecture.md`, `tech-stack.md`, `coding-guidelines.md`.

* Skip `development-process.md`; it governs how work is specified and retired, and the steps here are this skill's share
  of it.

* **Do not use `.sdd/backlog/` as a requirements source.** It holds an informal idea/issue list, not specs, and its
  contents may be stale or contradict the spec you are implementing. Requirements come only from the target `spec.md`
  and the `.sdd/project/` guidelines above.

## 4. Implement

* Implement the feature exactly as described in the specification and design.
* Ensure the implementation fully respects the general guidelines from `.sdd/project/`.
* Take care not to deviate from the provided specification.
* **Resolve Contradictions:** If you find that the feature specification contradicts itself, or if it contradicts the
  general project guidelines, **DO NOT make assumptions**. You **MUST** stop and ask the user clarification questions
  before proceeding with the implementation.

### Comments

`coding-guidelines.md` states the principle. Default to none: a slice that reads without commentary is a good slice, and
every comment is one more thing that has to stay true as the code around it moves. When one is earned, write the
shortest sentence that carries the reason.

A comment has to pass every one of these:

* **Something outside the code forced it to be this way.** A choice that could have gone any other way gets no comment —
  justifying it implies a significance it does not have.
* **Never restate the line beneath it.** If the sentence can be reconstructed from the code it sits on, delete it.
* **Never label a block that already names itself.** A blank line separates without claiming to inform.
* **Never narrate an assertion.** The test name states the behaviour and the assertion states the check; a sentence
  between them is a third telling. Comment the fixture instead — why this data, and which property of it the assertions
  turn on.
* **Never document somebody else's API.** A reader who needs it reads their docs, not ours.
* **State the present rule, never the change.** A comment phrased as a delta is unreadable to anyone who never saw the
  previous version. Git holds the history; the comment holds the rule.
* **Put the fact where it binds.** Document an interface's fields rather than the interface, and put a file-level note
  at the top of the file — JSDoc otherwise claims to describe whichever declaration follows it.

## 5. Database Schema Changes

* If the feature changes the database schema (adding, renaming, or dropping a column or table), **stop and ask the
  user** whether a special in-place migration is needed to preserve existing data, or the database can just be recreated
  from scratch. Do not assume either approach.

## 6. Verify

* Run `npm run test` and `npm run typecheck`. Both must pass before you report the implementation done.
* **Never attempt `expo start --web` or any browser preview.** This app has no working web target — `expo-sqlite` hangs
  at startup on web, and `@react-native-community/datetimepicker` has no web build — so it cannot demonstrate the
  change. Don't try it and then report the failure; just skip it.
* On-device Android verification (`testing-android-manually.md`) is the user's own reference — don't read or run it
  yourself.
* **Emulator/visual verification is not this skill's job.** It's a separate concern, covered by the `emulator-verifying`
  skill — invoke that one if the user explicitly asks for it.
* **The spec's E2E flow is not this skill's job either.** Writing and running it is the next stage, and `e2e-testing`
  reads Verification's `E2E Flow` section from the spec itself. Where implementation changed what the flow will have to
  do, **amend that section** so it describes what is true now, and report the flow as outstanding.

## 7. Tick the Implemented Box

Tick the spec's `Implemented` box as the last act of the implementation, so the spec on disk says what is true of the
working tree.

Leave the `E2E` box alone. It is `e2e-testing`'s concern.

## 8. Scope Limit

The slice is not finished when the code is. Two things that look like tidying up belong to stages this skill does not
run:

* **Do not touch the feature file.** It describes what the app does, and it says so in the present tense.
  `feature-writing` rewrites it.
* **Do not delete the spec.** A spec still on disk is what marks the slice unfinished, and the next stage reads it.

Report the slice as implemented, and name what is still outstanding.

## Important Note

This skill is strictly reserved for the initial implementation of features from specification documents. If the user
asks for bug fixes, adjustments, or modifications to already implemented code without asking to implement a new spec, do
**not** use this skill, unless the user explicitly instructs you to.
