import React, {useState} from "react";
import {Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {COLORS, ELEVATION, RADIUS, TYPOGRAPHY} from "@presentation/theme";
import {FieldHelpButton} from "./FieldHelpButton";

export interface SelectFieldOption<T> {
    /** The value this row stands for. */
    value: T;
    /** The row's visible text, and what the field reads once it is chosen. */
    label: string;
}

export interface SelectFieldProps<T> {
    /** Caption shown above the field. */
    label: string;
    /** The rows the picker lists, in render order. */
    options: ReadonlyArray<SelectFieldOption<T>>;
    /** The selected option's value; `undefined` selects nothing. Matched by identity. */
    selected: T | undefined;
    /** Called with the chosen option's value, or with `undefined` when the clearing row was chosen. */
    onSelect: (value: T | undefined) => void;
    /**
     * The word for "no value": what the field reads while nothing is selected,
     * and the first row of the picker, which returns it to that. One word for
     * both, so what the user reads is what they tap to get back to it. Omit on a
     * field that must always hold a value - it then offers no way back to empty.
     */
    clearLabel?: string;
    /** Error message; when set, shows an error border and the message below the field. */
    error?: string;
    /**
     * Prose explaining what to choose. When set, an info button beside the label
     * opens it in a dialog, and it becomes the field's accessibility hint.
     */
    helpText?: string;
    /** The field's testID; each row derives its own by appending the option's value, and the clearing row `clear`. */
    testID?: string;
}

/**
 * A labelled field that opens a modal list and reads back the row that was
 * chosen. Owns whether the list is open - no caller needs to read it.
 *
 * For choices too many or too wordy for `SegmentedField`, whose segments split
 * the row evenly and wrap what will not fit. A picker spends a tap to open, and
 * buys back a full line of width per option and no ceiling on how many there
 * are.
 *
 * Presentational only - the caller owns the value and any validation.
 */
export function SelectField<T>(
    {
        label,
        options,
        selected,
        onSelect,
        clearLabel,
        error,
        helpText,
        testID,
    }: SelectFieldProps<T>) {
    const [open, setOpen] = useState(false);
    const help = helpText || undefined;
    const chosen = options.find(option => option.value === selected);
    const close = () => setOpen(false);

    const pick = (value: T | undefined) => {
        close();
        onSelect(value);
    };

    const renderRow = (rowLabel: string, value: T | undefined, key: string) => {
        const isSelected = value === selected;
        return (
            <TouchableOpacity
                key={key}
                testID={testID ? `${testID}-${key}` : undefined}
                style={styles.row}
                onPress={() => pick(value)}
                accessibilityRole="button"
                accessibilityLabel={rowLabel}
                accessibilityState={{selected: isSelected}}
            >
                <Text style={styles.rowLabel}>{rowLabel}</Text>
                {isSelected ? <MaterialIcons name="check" size={20} color={COLORS.primaryContainer}/> : null}
            </TouchableOpacity>
        );
    };

    return (
        <View>
            {/* The hint goes on the label and the field alike, as it does on a
                text field: one control, so nothing is read out twice. */}
            <View style={styles.labelRow}>
                <Text style={styles.label} accessibilityHint={help}>{label}</Text>
                {help ? (
                    <FieldHelpButton
                        title={label}
                        text={help}
                        testID={testID ? `${testID}-help` : undefined}
                    />
                ) : null}
            </View>

            <TouchableOpacity
                testID={testID}
                style={[styles.field, error ? styles.fieldError : null]}
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${chosen?.label ?? clearLabel ?? ""}. Change.`}
                accessibilityHint={help}
            >
                <Text style={[styles.value, chosen ? null : styles.valueEmpty]}>
                    {chosen?.label ?? clearLabel}
                </Text>
                <MaterialIcons name="expand-more" size={20} color={COLORS.outline}/>
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Modal
                visible={open}
                transparent
                animationType="fade"
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={close}
            >
                <Pressable style={styles.overlay} onPress={close}>
                    {/* Not itself accessible: it exists to swallow a press, and
                        left accessible a screen reader announces the whole card
                        as one button before reaching any row inside it. */}
                    <Pressable
                        testID={testID ? `${testID}-options` : undefined}
                        style={styles.card}
                        accessible={false}
                        onPress={event => event.stopPropagation()}
                    >
                        <ScrollView>
                            {clearLabel !== undefined ? renderRow(clearLabel, undefined, 'clear') : null}
                            {options.map(option => renderRow(option.label, option.value, String(option.value)))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
    },
    label: TYPOGRAPHY.fieldLabel,
    // Fill, border, radius and padding are LabeledTextField's input rather than
    // anything of this component's own, so a field that is chosen from carries
    // the same weight as the fields typed into beside it.
    field: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        backgroundColor: COLORS.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.md,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    fieldError: {
        borderColor: COLORS.error,
    },
    value: {
        flexShrink: 1,
        color: COLORS.onSurface,
        fontSize: 16,
    },
    // The placeholder colour a text field shows before anything is typed: an
    // unanswered field has to read as unanswered rather than as a value.
    valueEmpty: {
        color: COLORS.outline,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    card: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.md,
        maxWidth: 384,
        width: "100%",
        // Shrinks to what the overlay leaves it, so a long list scrolls instead
        // of running off the screen.
        flexShrink: 1,
        paddingVertical: 8,
        ...ELEVATION.dialog,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    rowLabel: {
        flexShrink: 1,
        color: COLORS.onSurface,
        fontSize: 16,
    },
    errorText: {...TYPOGRAPHY.error, marginTop: 4},
});
