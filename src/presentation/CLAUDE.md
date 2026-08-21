# Presentation Layer

Two catalogs govern everything in this tree. Read both before writing a screen, a view, or a component.

## Components — `components/index.ts`

Check it for an existing component before building a button, header, input, card or dialog. If one matches, import and
reuse it rather than writing another or duplicating its styling.

A genuinely new reusable component is exported from `index.ts`, so it becomes part of the catalog for the next screen.

**Build it in the catalog when a second use is already in sight**, rather than waiting for the duplicate to appear.
Something needed once is fine inside the screen that needs it; something you can already name another screen for starts
in `components/`. The test is a foreseeable second caller, not a possible one — a component generalized for a caller
that never arrives costs more than the duplication it was meant to save.

## Design tokens — `theme/index.ts`

Check it before hardcoding any color, spacing, typography, radius or elevation value — and the modules it re-exports
(`theme/colors.ts`, `theme/typography.ts`, …), since the barrel names the categories but the tokens themselves live in
those files. Import from the `@presentation/theme` barrel rather than writing a raw hex or number into a screen or
component.

A genuinely new token goes in the module it belongs to (`theme/colors.ts`, `theme/typography.ts`, …) and is re-exported
from the barrel. A new *category* of token gets its own module beside them, re-exported the same way.

Reuse is what keeps the design consistent, so use both catalogs as intended rather than working around them.
