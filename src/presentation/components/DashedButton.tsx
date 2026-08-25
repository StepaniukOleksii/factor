import React from "react";
import {StyleSheet, Text, TouchableOpacity, ViewStyle} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {COLORS, RADIUS} from "@presentation/theme";

export interface DashedButtonProps {
    label: string;
    onPress: () => void;
    style?: ViewStyle;
}

/**
 * A dashed outline button for adding another of something to a form - one more
 * Metric, one more Choice value. Its outline says it appends to the form rather
 * than acting on what is already in it.
 */
export function DashedButton({label, onPress, style}: DashedButtonProps) {
    return (
        <TouchableOpacity style={[styles.button, style]} onPress={onPress} accessibilityRole="button">
            <MaterialIcons name="add" size={20} color={COLORS.onSurfaceVariant}/>
            <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.md,
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.onSurfaceVariant,
    },
});
