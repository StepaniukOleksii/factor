---
name: presentation-layer
description: Enforces the use of reusable presentation components. Should be triggered whenever the agent is creating a new UI screen, modifying the presentation layer, or building UI components.
metadata:
  version: "1.0.0"
---

# Presentation Layer Skill

When you are tasked with creating a new screen, UI view, or any presentation layer element, you **MUST** follow these
guidelines to maximize component reuse and maintain design consistency.

## 1. Check the Component Catalog

Before writing any new UI components (such as buttons, headers, inputs, cards, etc.), you must analyze the reusable
components catalog located at:
`src/presentation/components/index.ts`

Use the Read tool to read `src/presentation/components/index.ts` and understand what components are already
exported and available for reuse.

## 2. Reuse Existing Components

If an existing component from the catalog matches your needs (e.g., a CTA button, a screen header), you **MUST** import
and reuse it instead of creating a new one from scratch or duplicating styling logic.

## 3. Add to the Catalog

If you determine that a truly new, reusable component needs to be created, you must export it from
`src/presentation/components/index.ts` so that it becomes part of the catalog for future reuse.

## 4. Design Consistency

Always strive to keep the design consistent by leveraging these shared components and adhering to their intended usage.
