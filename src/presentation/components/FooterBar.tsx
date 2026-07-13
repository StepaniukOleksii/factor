import React, {ReactNode} from "react";
import {Platform, StyleSheet, View} from "react-native";
import {COLORS, withAlpha} from "@presentation/theme";

export interface FooterBarProps {
    children: ReactNode;
}

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
