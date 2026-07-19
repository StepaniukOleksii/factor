# Bundled fonts

Fonts here are bundled with the app because something needs a typeface it can load itself, rather
than naming one for the platform to resolve. Today that is Skia: a `Canvas` draws its own glyphs and
cannot composite a platform `Text` element, so trend chart axis labels need a font file of their own
(see `tech-stack.md`'s Data Visualization section).

These are **not** the app's UI fonts — React Native `Text` throughout the app still uses the
platform's own font stack and needs nothing from this folder.

| File                 | Family | Source                                                    | Licence    |
|----------------------|--------|-----------------------------------------------------------|------------|
| `Roboto-Regular.ttf` | Roboto | [Google Fonts](https://fonts.google.com/specimen/Roboto)  | Apache-2.0 |

Roboto is Android's own system font, so axis labels sit naturally alongside the platform text around
them while still rendering identically on iOS.

Apache-2.0 requires the licence to travel with anything that redistributes the font, so shipping a
build means surfacing it — a bundled licence file or an in-app acknowledgements screen — not just
naming it here.
