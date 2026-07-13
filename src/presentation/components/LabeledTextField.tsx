import React, {ReactNode} from "react";
import {StyleSheet, Text, TextInput, TextInputProps, View} from "react-native";
import {COLORS} from "@presentation/theme";

export interface LabeledTextFieldProps extends Omit<TextInputProps, "style"> {
    /** Caption shown above the input. */
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    /** Error message; when set, shows an error border and the message below the input. */
    error?: string;
    /** Shows a `current/max` character counter below the input. Requires `maxLength`. */
    showCounter?: boolean;
    /** Node rendered at the right edge of the label row, e.g. a delete button. */
    labelAccessory?: ReactNode;
}

/**
 * A labeled text input with optional character counter and inline error.
 *
 * Every field looks the same on purpose — styling is fixed here and is NOT
 * overridable, so all inputs across the app stay visually consistent. Any
 * TextInput prop (placeholder, keyboardType, multiline, maxLength, ...) is
 * forwarded to the underlying input.
 */
export function LabeledTextField(
    {
        label,
        value,
        onChangeText,
        error,
        showCounter = false,
        labelAccessory,
        placeholderTextColor = COLORS.outline,
        multiline,
        maxLength,
        ...rest
    }: LabeledTextFieldProps) {
    return (
        <View>
            <View style={styles.labelRow}>
                <Text style={styles.label}>{label}</Text>
                {labelAccessory}
            </View>
            <TextInput
                style={[
                    styles.input,
                    multiline && styles.inputMultiline,
                    error ? styles.inputError : null,
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholderTextColor={placeholderTextColor}
                multiline={multiline}
                maxLength={maxLength}
                {...rest}
            />
            {showCounter && maxLength !== undefined && (
                <Text style={styles.counter}>
                    {value.length}/{maxLength}
                </Text>
            )}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: COLORS.onSurfaceVariant,
    },
    input: {
        backgroundColor: COLORS.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: COLORS.onSurface,
        fontSize: 16,
    },
    inputMultiline: {
        minHeight: 72,
        textAlignVertical: "top",
    },
    inputError: {
        borderColor: COLORS.error,
    },
    counter: {
        fontSize: 12,
        color: COLORS.outline,
        alignSelf: "flex-end",
        marginTop: 4,
    },
    errorText: {
        color: COLORS.error,
        fontSize: 12,
        marginTop: 4,
    },
});
