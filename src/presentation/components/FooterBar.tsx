import React, {ReactNode} from "react";
import {Platform, StyleSheet, View} from "react-native";
import {COLORS, withAlpha} from "@presentation/theme";

export interface FooterBarProps {
    children: ReactNode;
}

/**
 * Bottom padding a screen's scrolling content must reserve so its last element
 * clears the `FooterBar` floating over it. Lives here rather than in each
 * screen because it answers to the paddings below: a screen that copies the
 * number instead drifts from them silently, and the content it ends on is what
 * the footer then covers.
 *
 * Sized for the tallest case - Android, whose footer adds the navigation-bar
 * padding - so one value serves both platforms.
 */
export const FOOTER_CLEARANCE = 120;

/**
 * Fixed action bar pinned to the bottom of a screen, holding the primary
 * call-to-action (typically a `PrimaryActionButton`). It floats translucently
 * over the scrolling content with a hairline top divider that mirrors the
 * `ScreenHeader` bottom border, and adds extra bottom padding to clear the
 * Android navigation bar.
 */
export function FooterBar({children}: FooterBarProps) {
    return <View style={styles.footer}>{children}</View>;
}

const styles = StyleSheet.create({
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: withAlpha(COLORS.background, 0.8),
        borderTopWidth: 1,
        borderTopColor: COLORS.outlineVariant,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'android' ? 40 : 16,
        zIndex: 50,
    },
});
