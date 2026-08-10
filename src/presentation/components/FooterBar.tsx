import React, {ReactNode} from "react";
import {StyleSheet, View} from "react-native";
import {COLORS, withAlpha} from "@presentation/theme";
import {useBottomInset} from "./useBottomInset";

export interface FooterBarProps {
    children: ReactNode;
}

const PADDING = 16;

/** A `PrimaryActionButton` measures a little under this, rounded up to the minimum touch target. */
const ACTION_HEIGHT = 56;

const BAR_HEIGHT = 1 + PADDING + ACTION_HEIGHT + PADDING;

/** Bottom padding a screen's scrolling content reserves so its last element clears the bar floating over it. */
export function useFooterClearance(): number {
    const bottomInset = useBottomInset();

    return BAR_HEIGHT + bottomInset;
}

/**
 * Fixed action bar pinned to the bottom of a screen, holding the primary
 * call-to-action (typically a `PrimaryActionButton`). It floats translucently
 * over the scrolling content with a hairline top divider that mirrors the
 * `ScreenHeader` bottom border. Screens reserve room for it with
 * `useFooterClearance`.
 */
export function FooterBar({children}: FooterBarProps) {
    const bottomInset = useBottomInset();

    return <View style={[styles.footer, {paddingBottom: PADDING + bottomInset}]}>{children}</View>;
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
        paddingHorizontal: PADDING,
        paddingTop: PADDING,
        zIndex: 50,
    },
});
