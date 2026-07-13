import React from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";
import {COLORS} from "@presentation/theme";

export interface CenteredStateProps {
    /**
     * When set, this short status line (e.g. a "not found" fallback) is shown
     * instead of the loading spinner.
     */
    message?: string;
}

/**
 * Fills the remaining vertical space and centers a transient screen state: a
 * large primary spinner by default, or `message` text once the screen has
 * finished loading but has nothing to show (e.g. a missing record).
 */
export function CenteredState({message}: CenteredStateProps) {
    return (
        <View style={styles.container}>
            {message !== undefined ? (
                <Text style={styles.message}>{message}</Text>
            ) : (
                <ActivityIndicator size="large" color={COLORS.primaryContainer}/>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        color: COLORS.onSurface,
    },
});
