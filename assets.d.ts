/**
 * Types for the binary assets in `assets/`.
 *
 * Metro bundles a font file and resolves its import to an opaque numeric handle,
 * which is what asset consumers — Skia's `useFont`, for one — take as their
 * source. TypeScript has no built-in knowledge of non-code imports, so that
 * shape is declared here.
 */
declare module '*.ttf' {
  const asset: number;
  export default asset;
}
