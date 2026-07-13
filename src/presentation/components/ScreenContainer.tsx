import React, {ReactNode} from "react";
import {Platform, SafeAreaView, StatusBar as RNStatusBar, StyleProp, StyleSheet, ViewStyle} from "react-native";
import {COLORS} from "@presentation/theme";

export interface ScreenContainerProps {
    children: ReactNode;
    /** Optional style merged onto the base safe-area container. */
    style?: StyleProp<ViewStyle>;
}

/**
 * Full-screen root wrapper used as the outermost element of every screen: a
 * flex-filling safe area painted with the app background and padded below the
 * Android status bar. Use this instead of re-declaring a local `safeArea` style.
 */
export function ScreenContainer({children, style}: ScreenContainerProps) {
    return <SafeAreaView style={[styles.safeArea, style]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
    },
});
