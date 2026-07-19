/**
 * Vitest stand-in for a bundled binary font asset.
 *
 * Metro resolves `require('….ttf')` to an opaque asset handle it hands to
 * Skia's font loader. Node's own loader has no such step and would try to parse
 * the font file as JavaScript, so every `.ttf` import is aliased here under
 * Vitest (see `vitest.config.ts`).
 *
 * Nothing ever reads this value: the Skia mock's `useFont` ignores its source
 * argument and returns whichever font the test asked for.
 */
export default 1;
