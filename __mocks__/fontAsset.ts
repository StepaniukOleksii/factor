/**
 * Vitest stand-in for a bundled binary font asset. Node would try to parse a
 * `.ttf` as JavaScript, so every font import is aliased here (see
 * `vitest.config.ts`). The value itself is never read - the Skia mock's
 * `useFont` ignores its source argument.
 */
export default 1;
