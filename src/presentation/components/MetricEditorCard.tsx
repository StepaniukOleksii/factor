import React from "react";
import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import type {MetricErrors} from "../../application/validateCreateObservation";
import type {EnumConstraint, Metric, MetricValueType, NumericConstraint} from "../../domain/Metric";
import {
    METRIC_DESCRIPTION_MAX_LENGTH,
    METRIC_ENUM_MAX_VALUES,
    METRIC_ENUM_VALUE_MAX_LENGTH,
    METRIC_NAME_MAX_LENGTH,
} from "../../domain/validationLimits";
import {COLORS, RADIUS, TYPOGRAPHY} from "@presentation/theme";
import {formatMetricType, formatTypedRange} from "@presentation/metricDisplay";
import {DashedButton} from "./DashedButton";
import {LabeledTextField} from "./LabeledTextField";
import {SelectField, type SelectFieldOption} from "./SelectField";

/** One Metric as a form holds it: every field as typed, judged only on save. */
export interface MetricDraft {
    /** The stored Metric this stands for, absent on one added to the form. */
    id?: string;
    name: string;
    type: MetricValueType;
    description: string;
    /** Lower bound, as typed; empty leaves it unset. Numeric Metrics only. */
    min: string;
    /** Upper bound, as typed; empty leaves it unset. Numeric Metrics only. */
    max: string;
    /** The values offered, as typed and in declaration order. Enum Metrics only. */
    values: string[];
}

/** Two rows, the fewest a Choice Metric may declare - so the minimum is visible rather than discovered on save. */
const EMPTY_METRIC_VALUES: string[] = ['', ''];

export const EMPTY_METRIC: MetricDraft = {
    name: '',
    type: 'Numeric',
    description: '',
    min: '',
    max: '',
    values: EMPTY_METRIC_VALUES,
};

const METRIC_TYPE_CHOICES: SelectFieldOption<MetricValueType>[] =
    (['Numeric', 'Text', 'Boolean', 'Enum'] as MetricValueType[])
        .map(type => ({value: type, label: formatMetricType(type)}));

export function toMetricDraft(metric: Metric): MetricDraft {
    const numeric = metric.type === 'Numeric' ? metric.constraint as NumericConstraint | null : null;
    const allowed = metric.type === 'Enum' ? (metric.constraint as EnumConstraint | null)?.allowedValues : undefined;

    return {
        id: metric.id,
        name: metric.name,
        type: metric.type,
        description: metric.description ?? '',
        min: numeric?.min !== undefined ? String(numeric.min) : '',
        max: numeric?.max !== undefined ? String(numeric.max) : '',
        values: allowed ?? EMPTY_METRIC_VALUES,
    };
}

export interface MetricEditorCardProps {
    metric: MetricDraft;
    /** Position on the form, which the card derives each of its testIDs from. */
    index: number;
    errors: MetricErrors;
    onChange: (metric: MetricDraft) => void;
    /** Omitted where this Metric may not leave the form; no delete affordance renders then. */
    onRemove?: () => void;
    /**
     * A Metric already stored: its type and constraint are stated rather than
     * offered, and its delete affordance is marked destructive.
     */
    stored?: boolean;
}

/**
 * `stored` replaces the type and constraint controls with what they hold rather
 * than disabling them: a disabled control still invites the tap it would refuse.
 *
 * Its other consequence is the delete affordance's colour. Both kinds of card
 * carry one, and nothing else on a card reliably says which of the two things
 * the icon means - discarding what was just typed, or destroying a year of
 * Records - a stored Text Metric differing from an added one only in stating a
 * type rather than offering it.
 */
export function MetricEditorCard(
    {
        metric,
        index,
        errors,
        onChange,
        onRemove,
        stored = false,
    }: MetricEditorCardProps) {

    const change = <K extends keyof MetricDraft>(key: K, value: MetricDraft[K]) =>
        onChange({...metric, [key]: value});

    const selectType = (type: MetricValueType) => onChange({
        ...metric,
        type,
        // Each editor belongs to a single type, so anything typed into one goes
        // when the type does - never submitted unseen.
        min: type === 'Numeric' ? metric.min : '',
        max: type === 'Numeric' ? metric.max : '',
        values: type === 'Enum' ? metric.values : EMPTY_METRIC_VALUES,
    });

    const changeValue = (valueIndex: number, value: string) =>
        change('values', metric.values.map((existing, i) => i === valueIndex ? value : existing));

    const addValue = () => change('values', [...metric.values, '']);

    const removeValue = (valueIndex: number) =>
        change('values', metric.values.filter((_, i) => i !== valueIndex));

    const renderStated = (label: string, text: string, testID?: string) => (
        <View style={styles.metricField}>
            <Text style={styles.statedLabel}>{label}</Text>
            <Text style={styles.statedValue} testID={testID}>{text}</Text>
        </View>
    );

    const range = formatTypedRange(metric.min, metric.max);

    return (
        <View style={styles.metricCard}>
            <View style={styles.metricGrid}>
                <View style={styles.metricField}>
                    <LabeledTextField
                        label="METRIC NAME"
                        testID={`metric-name-${index}`}
                        labelAccessory={onRemove ? (
                            <TouchableOpacity onPress={onRemove} style={styles.deleteButton}
                                              accessibilityRole="button"
                                              accessibilityLabel={`Remove metric ${metric.name.trim() || index + 1}`}>
                                <MaterialIcons name="delete" size={20}
                                               color={stored ? COLORS.error : COLORS.outline}/>
                            </TouchableOpacity>
                        ) : undefined}
                        value={metric.name}
                        onChangeText={(val) => change('name', val)}
                        placeholder="e.g., Duration"
                        maxLength={METRIC_NAME_MAX_LENGTH}
                        showCounter
                        error={errors.name}
                    />
                </View>

                {stored ? renderStated('TYPE', formatMetricType(metric.type), `metric-type-locked-${index}`) : (
                    <View style={styles.metricField}>
                        <SelectField<MetricValueType>
                            label="TYPE"
                            testID={`metric-type-${index}`}
                            options={METRIC_TYPE_CHOICES}
                            selected={metric.type}
                            // A Metric always has a type, so the picker offers
                            // no way back to none.
                            onSelect={(type) => selectType(type!)}
                        />
                    </View>
                )}

                {metric.type === 'Numeric' && (stored ? (
                    range !== undefined ? renderStated('RANGE', range, `metric-range-locked-${index}`) : null
                ) : (
                    <View>
                        <View style={styles.boundsRow}>
                            <View style={styles.boundField}>
                                <LabeledTextField
                                    label="MIN"
                                    testID={`metric-min-${index}`}
                                    value={metric.min}
                                    onChangeText={(val) => change('min', val)}
                                    keyboardType="numeric"
                                    error={errors.min}
                                />
                            </View>
                            <View style={styles.boundField}>
                                <LabeledTextField
                                    label="MAX"
                                    testID={`metric-max-${index}`}
                                    value={metric.max}
                                    onChangeText={(val) => change('max', val)}
                                    keyboardType="numeric"
                                    error={errors.max}
                                />
                            </View>
                        </View>
                        {errors.range ? (
                            <Text style={styles.groupError}>{errors.range}</Text>
                        ) : null}
                    </View>
                ))}

                {metric.type === 'Enum' && (stored ? (
                    renderStated('VALUES', metric.values.join(', '), `metric-values-locked-${index}`)
                ) : (
                    <View>
                        <View style={styles.valueRows}>
                            {metric.values.map((value, valueIndex) => (
                                <LabeledTextField
                                    key={valueIndex}
                                    label={`VALUE ${valueIndex + 1}`}
                                    testID={`metric-value-${index}-${valueIndex}`}
                                    labelAccessory={metric.values.length > EMPTY_METRIC_VALUES.length ? (
                                        <TouchableOpacity
                                            onPress={() => removeValue(valueIndex)}
                                            style={styles.deleteButton}>
                                            <MaterialIcons name="delete" size={20}
                                                           color={COLORS.outline}/>
                                        </TouchableOpacity>
                                    ) : undefined}
                                    value={value}
                                    onChangeText={(val) => changeValue(valueIndex, val)}
                                    maxLength={METRIC_ENUM_VALUE_MAX_LENGTH}
                                    showCounter
                                />
                            ))}
                        </View>

                        {/* Below the rows rather than in any one of them: which
                            row is short of a value is the user's choice. */}
                        {errors.values ? (
                            <Text style={styles.groupError}>{errors.values}</Text>
                        ) : null}

                        {metric.values.length < METRIC_ENUM_MAX_VALUES && (
                            <DashedButton label="Add Value" onPress={addValue} style={styles.addValueButton}/>
                        )}
                    </View>
                ))}

                <View style={styles.metricField}>
                    <LabeledTextField
                        label="DESCRIPTION"
                        value={metric.description}
                        onChangeText={(val) => change('description', val)}
                        placeholder="Optional — what does each value mean?"
                        multiline
                        numberOfLines={3}
                        maxLength={METRIC_DESCRIPTION_MAX_LENGTH}
                        showCounter
                        error={errors.description}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    metricCard: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.lg,
        padding: 16,
        marginBottom: 16,
    },
    metricGrid: {
        flexDirection: 'column',
        gap: 16,
    },
    metricField: {
        flex: 1,
    },
    boundsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    boundField: {
        flex: 1,
    },
    valueRows: {
        gap: 12,
    },
    deleteButton: {
        padding: 4,
        marginRight: -4,
    },
    // LabeledTextField's own error spacing, so a message about a group of fields
    // sits where a message about one of them would.
    groupError: {...TYPOGRAPHY.error, marginTop: 4},
    addValueButton: {
        marginTop: 12,
    },
    statedLabel: {...TYPOGRAPHY.fieldLabel, marginBottom: 6},
    /**
     * No box: a bordered one is what every field a user types into wears, so a
     * fact wearing it too is the one thing the card must not say. Left against
     * its own caption rather than inset to a field's text, and muted against the
     * `onSurface` an entered value reads in.
     */
    statedValue: {
        color: COLORS.onSurfaceVariant,
        fontSize: 16,
        lineHeight: 22,
    },
});
