import React, {ReactNode} from "react";
import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";

const COLORS = {
    surface: '#131313',
    primary: '#f9fff0',
    outlineVariant: '#42493d',
};

export interface ScreenHeaderProps {
    title: string;
    onBack?: () => void;
    rightAction?: ReactNode;
}

export function ScreenHeader(
    {
        title,
        onBack,
        rightAction,
    }: ScreenHeaderProps) {
    return (
        <View style={styles.header}>
            {onBack ? (
                <TouchableOpacity onPress={onBack} style={styles.actionButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.primary}/>
                </TouchableOpacity>
            ) : (
                <View style={styles.actionButtonPlaceholder}/>
            )}

            <Text style={styles.title} numberOfLines={1}>
                {title}
            </Text>

            {rightAction ? (
                <View style={styles.rightActionContainer}>{rightAction}</View>
            ) : (
                <View style={styles.actionButtonPlaceholder}/>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    header: {
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.outlineVariant,
        backgroundColor: COLORS.surface,
        zIndex: 40,
    },
    actionButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: 48,
    },
    actionButtonPlaceholder: {
        width: 48,
    },
    title: {
        fontSize: 24,
        fontWeight: '500',
        flex: 1,
        textAlign: 'center',
        color: COLORS.primary,
    },
    rightActionContainer: {
        width: 48,
        alignItems: 'flex-end',
    }
})