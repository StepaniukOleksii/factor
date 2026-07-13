import {ViewStyle} from 'react-native';

/**
 * Shadow / elevation presets for surfaces that float above the page. Spread a
 * preset into a `StyleSheet` rule so floating surfaces cast one consistent
 * shadow instead of each re-declaring the same five properties.
 */
export const ELEVATION = {
    /** Centered modal dialogs (confirmations, the record action sheet). */
    dialog: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 8},
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 16,
    },
    /** Anchored dropdown menus (e.g. the header overflow menu). */
    dropdown: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
} satisfies Record<string, ViewStyle>;
