/**
 * Design Tokens
 *
 * This is the central registry of all shared design tokens (colors, typography,
 * radius, elevation, and future categories). Always check here before hardcoding
 * a color, text style, or other design value in a screen or component.
 *
 * `@presentation/theme` resolves to this barrel, so adding a new token category
 * (e.g. `./spacing`) only requires a re-export here.
 */

/** Material color roles (dark scheme) - background, surface, primary, error, etc. **/
export {COLORS} from './colors';

/** Derives a translucent `rgba()` string from a solid `COLORS` token (scrims, fills, faded borders). **/
export {withAlpha} from './withAlpha';

/** Shared text style presets - section captions, field labels, inline errors. **/
export {TYPOGRAPHY} from './typography';

/** Border-radius scale - xs/sm/md/lg/xl/pill. **/
export {RADIUS} from './radius';

/** Shadow / elevation presets for floating surfaces - dialog, dropdown. **/
export {ELEVATION} from './elevation';
