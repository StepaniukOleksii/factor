import React, {ReactNode} from "react";
import {StyleSheet, Text, TextInput, TextInputProps, View} from "react-native";
import {COLORS, RADIUS, TYPOGRAPHY} from "@presentation/theme";
import {FieldHelpButton} from "./FieldHelpButton";

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
    /**
     * Prose explaining what to enter. When set, an info button beside the label
     * opens it in a dialog, and it becomes the input's accessibility hint.
     */
    helpText?: string;
    /** The input's testID; the help button and its dialog derive theirs from it. */
    testID?: string;
}

/**
 * A labeled text input with optional character counter and inline error.
 *
 * Every field looks the same on purpose - styling is fixed here and is NOT
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
        helpText,
        testID,
        placeholderTextColor = COLORS.outline,
        multiline,
        maxLength,
        ...rest
    }: LabeledTextFieldProps) {
    const help = helpText || undefined;
    return (
        <View>
            {/* The label and its help button share a left-hand group, so the row's
                `space-between` keeps pinning the label and `labelAccessory` apart. */}
            <View style={styles.labelRow}>
                <View style={styles.labelGroup}>
                    <Text style={styles.label}>{label}</Text>
                    {help ? (
                        <FieldHelpButton
                            title={label}
                            text={help}
                            testID={testID ? `${testID}-help` : undefined}
                        />
                    ) : null}
                </View>
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
                testID={testID}
                // Before `rest`, so an explicit caller hint still wins.
                accessibilityHint={help}
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
    labelGroup: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    label: TYPOGRAPHY.fieldLabel,
    input: {
        backgroundColor: COLORS.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.md,
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
    errorText: {...TYPOGRAPHY.error, marginTop: 4},
});
