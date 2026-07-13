import React from "react";
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {COLORS, RADIUS} from "@presentation/theme";

export interface PrimaryActinButtonProps {
    label: string;
    onPress: () => void;
    iconName?: keyof typeof MaterialIcons.glyphMap;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
}

export function PrimaryActionButton(
    {
        label,
        onPress,
        iconName = 'check',
        loading = false,
        disabled = false,
        style,
    }: PrimaryActinButtonProps) {
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            style={[styles.button, isDisabled && styles.buttonDisabled, style]}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.8}>
            {loading ? (
                <ActivityIndicator color={COLORS.onPrimaryFixedVariant}/>
            ) : (
                <>
                    <Text style={styles.buttonText}>{label}</Text>
                    <MaterialIcons name={iconName} size={20} color={COLORS.onPrimaryFixedVariant}/>
                </>
            )}
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: COLORS.primaryContainer,
        borderRadius: RADIUS.md,
        paddingVertical: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: COLORS.onPrimary,
        fontSize: 16,
        fontWeight: '500',
    }
})