---
name: presentation-layer
description: Enforces the use of reusable presentation components. Should be triggered whenever the agent is creating a new UI screen, modifying the presentation layer, or building UI components.
metadata:
  version: "1.1.0"
---

# Presentation Layer Skill

When you are tasked with creating a new screen, UI view, or any presentation layer element, you **MUST** follow these
guidelines to maximize component reuse and maintain design consistency.

## 1. Check the Component Catalog

Before writing any new UI components (such as buttons, headers, inputs, cards, etc.), you must analyze the reusable
components catalog located at:
`src/presentation/components/index.ts`

Read `src/presentation/components/index.ts` to understand what components are already exported and available for reuse.

## 2. Reuse Existing Components

If an existing component from the catalog matches your needs (e.g., a CTA button, a screen header), you **MUST** import
and reuse it instead of creating a new one from scratch or duplicating styling logic.

## 3. Add to the Catalog

If you determine that a truly new, reusable component needs to be created, you must export it from
`src/presentation/components/index.ts` so that it becomes part of the catalog for future reuse.

## 4. Check the Token Catalog

Before hardcoding any color, spacing, typography, or other design value directly in a screen or component, you must
analyze the design token catalog located at:
`src/presentation/theme/index.ts`

Read `src/presentation/theme/index.ts` (and the token modules it re-exports, e.g. `theme/colors.ts`) to understand what
tokens are already available for reuse.

## 5. Reuse Existing Tokens

If an existing token matches your needs (e.g., a surface color, an outline color), you **MUST** import it from the
`@presentation/theme` barrel instead of hardcoding a raw hex/number value ad hoc in a screen or component.

## 6. Add to the Token Catalog

If you determine that a truly new, reusable token needs to be created, add it to the appropriate module (e.g.
`theme/colors.ts`) and ensure it is re-exported from the `theme/index.ts` barrel so it becomes part of the catalog for
future reuse. When a new token category appears (e.g. spacing, typography), create a dedicated module for it (e.g.
`theme/spacing.ts`) and re-export it from the barrel.

## 7. Design Consistency

Always strive to keep the design consistent by leveraging these shared components and tokens, and using them as
intended.
