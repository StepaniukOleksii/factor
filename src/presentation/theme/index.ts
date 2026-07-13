/**
 * Design Tokens
 *
 * This is the central registry of all shared design tokens (colors, and future
 * spacing/typography categories). Always check here before hardcoding a color
 * or other design value in a screen or component.
 *
 * `@presentation/theme` resolves to this barrel, so adding a new token category
 * (e.g. `./spacing`, `./typography`) only requires a re-export here.
 */

/** Material color roles (dark scheme) - background, surface, primary, error, etc. **/
export {COLORS} from './colors';

/** Derives a translucent `rgba()` string from a solid `COLORS` token (scrims, fills, faded borders). **/
export {withAlpha} from './withAlpha';
