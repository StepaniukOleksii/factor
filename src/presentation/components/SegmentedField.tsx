import React from "react";
import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {COLORS, RADIUS, TYPOGRAPHY} from "@presentation/theme";
import {FieldHelpButton} from "./FieldHelpButton";

export interface SegmentedFieldOption<T> {
    /** The value this segment stands for. */
    value: T;
    /** The segment's visible text. */
    label: string;
}

export interface SegmentedFieldProps<T> {
    /** Caption shown above the segments. */
    label: string;
    /** The segments, in render order. */
    options: ReadonlyArray<SegmentedFieldOption<T>>;
    /** The selected option's value; `undefined` selects nothing. Matched by identity. */
    selected: T | undefined;
    /** Called with the tapped option's value, or with `undefined` when that option was already selected. */
    onSelect: (value: T | undefined) => void;
    /** Error message; when set, shows an error border on every segment and the message below them. */
    error?: string;
    /**
     * Prose explaining what to choose. When set, an info button beside the label
     * opens it in a dialog, and it becomes the label's accessibility hint.
     */
    helpText?: string;
    /** Prefix each segment's own testID is derived from, by appending the option's value. */
    testID?: string;
}

/**
 * A labelled row of segments sharing the available width, at most one selected.
 *
 * Deselectable on purpose: tapping the selected segment reports `undefined`, so
 * "nothing chosen" stays a state the user can both see and reach, rather than
 * being indistinguishable from whichever option a two-state control would rest
 * on by default.
 *
 * Presentational only — it holds no selection of its own and knows nothing about
 * what its options mean. The caller owns the value and any validation.
 */
export function SegmentedField<T>(
    {
        label,
        options,
        selected,
        onSelect,
        error,
        helpText,
        testID,
    }: SegmentedFieldProps<T>) {
    const help = helpText || undefined;
    return (
        <View>
            {/* The hint goes on the label rather than the segments: one focusable
                element per option means hinting each would read the whole
                description out once per segment. */}
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
            <View style={styles.segments}>
                {options.map(option => {
                    const isSelected = option.value === selected;
                    return (
                        <TouchableOpacity
                            key={String(option.value)}
                            testID={testID ? `${testID}-${String(option.value)}` : undefined}
                            style={[
                                styles.segment,
                                isSelected && styles.segmentSelected,
                                error ? styles.segmentError : null,
                            ]}
                            onPress={() => onSelect(isSelected ? undefined : option.value)}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel={option.label}
                            accessibilityState={{selected: isSelected}}
                        >
                            <Text style={[styles.segmentLabel, isSelected && styles.segmentLabelSelected]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
    segments: {
        flexDirection: "row",
        gap: 8,
    },
    // Padding and radius mirror LabeledTextField's input rather than
    // TimeRangeSelector's compact toolbar segments, so a segmented field carries
    // the same height and weight as the text fields it sits beside. The
    // unselected fill is surfaceContainerLowest for the same reason: these sit on
    // surfaceContainerLow cards, where TimeRangeSelector's fill would leave an
    // unselected segment invisible but for its border.
    segment: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: COLORS.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.md,
    },
    segmentSelected: {
        backgroundColor: COLORS.primaryContainer,
        borderColor: COLORS.primaryContainer,
    },
    segmentError: {
        borderColor: COLORS.error,
    },
    segmentLabel: {
        color: COLORS.onSurfaceVariant,
        fontSize: 15,
        fontWeight: "600",
    },
    segmentLabelSelected: {
        color: COLORS.onPrimary,
    },
    errorText: {...TYPOGRAPHY.error, marginTop: 4},
});
