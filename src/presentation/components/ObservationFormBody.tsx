import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {CreateObservationErrors, MetricErrors} from '../../application/validateCreateObservation';
import {
    OBSERVATION_DESCRIPTION_MAX_LENGTH,
    OBSERVATION_NAME_MAX_LENGTH,
} from '../../domain/validationLimits';
import {COLORS, TYPOGRAPHY} from "@presentation/theme";
import {DashedButton} from './DashedButton';
import {useFooterClearance} from './FooterBar';
import {LabeledTextField} from './LabeledTextField';
import {emptyMetricDraft, type MetricDraft, MetricEditorCard, moveMetricDraft} from './MetricEditorCard';

const NO_METRIC_ERRORS: MetricErrors = {};

export interface ObservationFormBodyProps {
    name: string;
    onNameChange: (name: string) => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    /**
     * Held by the screen rather than here: editing reads the drafts back to tell
     * a dirty form from a clean one and to find which stored Metrics a save
     * would remove.
     */
    metrics: readonly MetricDraft[];
    onMetricsChange: (metrics: MetricDraft[]) => void;
    /** What to mark, which is not the same as what the form is judged against. */
    errors: CreateObservationErrors;
}

/**
 * The part of the Observation form that declaring one and editing one hold in
 * common - the sticky name field above the scrolling description and Metric
 * cards. Rendered without a wrapper, each screen supplying the header, footer
 * and keyboard handling it sits in.
 */
export function ObservationFormBody(
    {
        name,
        onNameChange,
        description,
        onDescriptionChange,
        metrics,
        onMetricsChange,
        errors,
    }: ObservationFormBodyProps) {

    const footerClearance = useFooterClearance();

    const addMetric = () => onMetricsChange([...metrics, emptyMetricDraft()]);

    const changeMetric = (index: number, metric: MetricDraft) =>
        onMetricsChange(metrics.map((existing, i) => i === index ? metric : existing));

    const removeMetric = (index: number) =>
        onMetricsChange(metrics.filter((_, i) => i !== index));

    const moveMetric = (from: number, to: number) =>
        onMetricsChange(moveMetricDraft(metrics, from, to));

    return (
        <>
            <View style={styles.stickySection}>
                <LabeledTextField
                    label="OBSERVATION NAME"
                    value={name}
                    onChangeText={onNameChange}
                    placeholder="e.g., Sleep Quality, Mood"
                    maxLength={OBSERVATION_NAME_MAX_LENGTH}
                    showCounter
                    error={errors.name}
                />
            </View>

            <ScrollView style={styles.scrollView}
                        contentContainerStyle={[styles.scrollContent, {paddingBottom: footerClearance}]}>
                <View style={styles.descriptionSection}>
                    <LabeledTextField
                        label="DESCRIPTION"
                        value={description}
                        onChangeText={onDescriptionChange}
                        placeholder="Optional — what does this observation track?"
                        multiline
                        numberOfLines={3}
                        maxLength={OBSERVATION_DESCRIPTION_MAX_LENGTH}
                        showCounter
                        error={errors.description}
                    />
                </View>
                <View style={styles.divider}/>
                <View style={styles.metricsContainer}>
                    <Text style={styles.label}>METRICS</Text>

                    {metrics.map((metric, index) => (
                        <MetricEditorCard
                            key={metric.key}
                            metric={metric}
                            index={index}
                            errors={errors.perMetric[index] ?? NO_METRIC_ERRORS}
                            onChange={(next) => changeMetric(index, next)}
                            onRemove={metrics.length > 1 ? () => removeMetric(index) : undefined}
                            onMoveUp={index > 0 ? () => moveMetric(index, index - 1) : undefined}
                            onMoveDown={index < metrics.length - 1 ? () => moveMetric(index, index + 1) : undefined}
                            stored={metric.id !== undefined}
                        />
                    ))}

                    <DashedButton label="Add Metric" onPress={addMetric}/>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    stickySection: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.outlineVariant,
        backgroundColor: COLORS.background,
        zIndex: 10,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    label: {...TYPOGRAPHY.sectionCaption, marginBottom: 8},
    descriptionSection: {
        marginTop: 16,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.outlineVariant,
        marginVertical: 16,
    },
    metricsContainer: {
        gap: 16,
    },
});
