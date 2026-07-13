import {TextStyle} from 'react-native';
import {COLORS} from './colors';

/**
 * Shared text style presets. Spread a preset into a `StyleSheet` rule and add
 * only layout on top (e.g. `{...TYPOGRAPHY.fieldLabel, marginBottom: 8}`), so
 * the same role reads identically everywhere instead of being hand-copied and
 * silently drifting apart.
 */
export const TYPOGRAPHY = {
    /** Uppercase caption above a screen section, e.g. "METRICS" / "TRENDS". */
    sectionCaption: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 1,
        color: COLORS.onSurfaceVariant,
    },
    /** Caption above a form field, e.g. "OBSERVATION NAME" / "TYPE". */
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.onSurfaceVariant,
    },
    /** Inline validation error shown below a field. */
    error: {
        fontSize: 12,
        color: COLORS.error,
    },
} satisfies Record<string, TextStyle>;
