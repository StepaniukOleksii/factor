import React, {useEffect, useRef, useState} from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import type {NavigationAction} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {SQLiteRecordRepository} from '../../infrastructure/SQLiteRecordRepository';
import {CountMetricValuesUseCase} from '../../application/CountMetricValuesUseCase';
import {UpdateObservationInput, UpdateObservationUseCase} from '../../application/UpdateObservationUseCase';
import {
    CreateObservationErrors,
    hasErrors,
    MetricErrors,
    validateUpdateObservation,
} from '../../application/validateCreateObservation';
import {Metric} from '../../domain/Metric';
import {Observation} from '../../domain/Observation';
import {OBSERVATION_DESCRIPTION_MAX_LENGTH, OBSERVATION_NAME_MAX_LENGTH} from '../../domain/validationLimits';
import {
    CenteredState,
    DashedButton,
    Dialog,
    EMPTY_METRIC,
    FooterBar,
    LabeledTextField,
    type MetricDraft,
    MetricEditorCard,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader,
    toMetricDraft,
    useFooterClearance,
} from "@presentation/components";
import {COLORS, TYPOGRAPHY} from "@presentation/theme";
import {type MetricRemovalPrompt, metricRemovalPrompt} from '@shared/metricRemovalPrompt';
import type {RootStackParamList} from '../navigation/routes';

const repository = new SQLiteObservationRepository();
const useCase = new UpdateObservationUseCase(repository);
const countMetricValuesUseCase = new CountMetricValuesUseCase(new SQLiteRecordRepository());

export type EditObservationScreenProps = NativeStackScreenProps<RootStackParamList, 'EditObservation'>;

const NOTHING_MARKED: CreateObservationErrors = {perMetric: []};
const NO_METRIC_ERRORS: MetricErrors = {};

/**
 * Only a Metric's name and description can differ, its type and constraint
 * being stated rather than offered.
 */
function metricsDiffer(drafts: readonly MetricDraft[], stored: ReadonlyArray<Metric>): boolean {
    if (drafts.length !== stored.length) {
        return true;
    }
    return drafts.some((draft, index) => draft.id !== stored[index].id
        || draft.name.trim() !== stored[index].name
        || draft.description.trim() !== (stored[index].description ?? ''));
}

export function EditObservationScreen({route, navigation}: EditObservationScreenProps) {
    const {observationId} = route.params;

    const [observation, setObservation] = useState<Observation | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [metrics, setMetrics] = useState<MetricDraft[]>([]);
    const [takenNames, setTakenNames] = useState<string[]>([]);
    const [attemptedSave, setAttemptedSave] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [pendingExit, setPendingExit] = useState<NavigationAction | null>(null);
    const [removalPrompt, setRemovalPrompt] = useState<MetricRemovalPrompt | null>(null);
    const footerClearance = useFooterClearance();
    /**
     * Saving removes this route too, and the form is still dirty against the
     * Observation it loaded at that moment, so that one removal has to pass. A
     * ref rather than state: the listener has to see it within the same tick.
     */
    const leavingAfterSave = useRef(false);

    const onBack = () => navigation.goBack();

    // A failed load leaves the screen `Not found`; the use case refuses a bad
    // save regardless.
    useEffect(() => {
        setLoading(true);
        repository.findAll()
            .then(observations => {
                const subject = observations.find(candidate => candidate.id === observationId) ?? null;
                setObservation(subject);
                setName(subject?.name ?? '');
                setDescription(subject?.description ?? '');
                setMetrics(subject?.metrics.map(toMetricDraft) ?? []);
                setTakenNames(observations
                    .filter(candidate => candidate.id !== observationId)
                    .map(candidate => candidate.name));
            })
            .catch(error => console.error('Failed to load observation', error))
            .finally(() => setLoading(false));
    }, [observationId]);

    const input: UpdateObservationInput = {
        observationId,
        name,
        description,
        metrics: metrics.map(metric => ({
            id: metric.id,
            name: metric.name,
            type: metric.type,
            description: metric.description,
            min: metric.min,
            max: metric.max,
            values: metric.values,
        })),
    };

    const errors = validateUpdateObservation(input, takenNames);
    // A stored value past its limit is marked like anything else: the form
    // judges what it holds, not what was typed.
    const marked = attemptedSave ? errors : NOTHING_MARKED;

    // The loaded Observation is the baseline, trimmed on both sides so trailing
    // whitespace that would save nothing does not count as a change.
    const isDirty = !!observation
        && (name.trim() !== observation.name.trim()
            || description.trim() !== (observation.description ?? '').trim()
            || metricsDiffer(metrics, observation.metrics));

    // One listener covers every route off this screen - the header arrow, the
    // cross button, Android's back button and the system back gesture are all
    // route removals. Taken from the `navigation` prop rather than a hook, both
    // of which need a navigator above them: the screen's tests render it bare.
    useEffect(() => {
        return navigation.addListener('beforeRemove', event => {
            if (leavingAfterSave.current || !isDirty) {
                return;
            }
            event.preventDefault();
            // The event's own action, so discarding lands the user wherever they
            // were headed rather than at a hardcoded destination.
            setPendingExit(event.data.action);
        });
    }, [navigation, isDirty]);

    const handleKeepEditing = () => setPendingExit(null);

    const handleDiscard = () => {
        const action = pendingExit;
        setPendingExit(null);
        if (action) {
            navigation.dispatch(action);
        }
    };

    const handleAddMetric = () => setMetrics([...metrics, EMPTY_METRIC]);

    const handleMetricChange = (index: number, metric: MetricDraft) => {
        setMetrics(metrics.map((existing, i) => i === index ? metric : existing));
    };

    const handleRemoveMetric = (index: number) => {
        setMetrics(metrics.filter((_, i) => i !== index));
    };

    // The last resort, for what no field is holding: the write failing, the
    // count failing, or the Observation having been deleted meanwhile.
    const reportFailure = (error: any) =>
        Alert.alert('Error', error.message || 'An error occurred while saving.');

    const write = async () => {
        try {
            setSaving(true);
            await useCase.execute(input);
            // Only the success path stands the listener down, so a save that
            // throws leaves the next exit still intercepted.
            leavingAfterSave.current = true;
            setRemovalPrompt(null);
            navigation.goBack();
        } catch (error: any) {
            reportFailure(error);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        setAttemptedSave(true);
        if (hasErrors(errors)) {
            return;
        }

        const removed = observation
            ? observation.metrics.filter(metric => !metrics.some(draft => draft.id === metric.id))
            : [];
        if (removed.length === 0) {
            await write();
            return;
        }

        try {
            setSaving(true);
            const valueCount = await countMetricValuesUseCase.execute(removed.map(metric => metric.id));
            setRemovalPrompt(metricRemovalPrompt(removed.map(metric => metric.name), valueCount));
        } catch (error: any) {
            reportFailure(error);
        } finally {
            setSaving(false);
        }
    };

    const handleCancelRemoval = () => setRemovalPrompt(null);

    if (loading) {
        return (
            <ScreenContainer>
                <ScreenHeader title="Loading..." onBack={onBack}/>
                <CenteredState/>
            </ScreenContainer>
        );
    }

    if (!observation) {
        return (
            <ScreenContainer>
                <ScreenHeader title="Not found" onBack={onBack}/>
                <CenteredState message="Observation not found."/>
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer>
            <ScreenHeader
                title="Edit Observation"
                onBack={onBack}
                rightAction={
                    <TouchableOpacity onPress={onBack} accessibilityLabel="Cancel editing">
                        <MaterialIcons name="close" size={24} color={COLORS.primary}/>
                    </TouchableOpacity>
                }
            />

            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.stickySection}>
                    <LabeledTextField
                        label="OBSERVATION NAME"
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g., Sleep Quality, Mood"
                        maxLength={OBSERVATION_NAME_MAX_LENGTH}
                        showCounter
                        error={marked.name}
                    />
                </View>

                <ScrollView style={styles.scrollView}
                            contentContainerStyle={[styles.scrollContent, {paddingBottom: footerClearance}]}>
                    <View style={styles.descriptionSection}>
                        <LabeledTextField
                            label="DESCRIPTION"
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Optional — what does this observation track?"
                            multiline
                            numberOfLines={3}
                            maxLength={OBSERVATION_DESCRIPTION_MAX_LENGTH}
                            showCounter
                            error={marked.description}
                        />
                    </View>
                    <View style={styles.divider}/>
                    <View style={styles.metricsContainer}>
                        <Text style={styles.label}>METRICS</Text>

                        {metrics.map((metric, index) => (
                            <MetricEditorCard
                                key={metric.id ?? `added-${index}`}
                                metric={metric}
                                index={index}
                                errors={marked.perMetric[index] ?? NO_METRIC_ERRORS}
                                onChange={(next) => handleMetricChange(index, next)}
                                onRemove={metrics.length > 1 ? () => handleRemoveMetric(index) : undefined}
                                stored={metric.id !== undefined}
                            />
                        ))}

                        <DashedButton label="Add Metric" onPress={handleAddMetric}/>
                    </View>
                </ScrollView>

                <FooterBar>
                    <PrimaryActionButton label="Save Observation" onPress={handleSave} loading={saving}/>
                </FooterBar>
            </KeyboardAvoidingView>

            {/* The form keeps its state throughout, so keeping the edit
                restores nothing. */}
            <Dialog
                visible={pendingExit !== null}
                title="Discard changes?"
                message="The changes you made to this observation will be lost."
                onRequestClose={handleKeepEditing}
                actions={[
                    {
                        label: "Keep editing",
                        onPress: handleKeepEditing,
                        accessibilityLabel: "Keep editing this observation",
                    },
                    {
                        label: "Discard",
                        onPress: handleDiscard,
                        variant: "destructive",
                        accessibilityLabel: "Discard unsaved changes",
                    },
                ]}
            />

            <Dialog
                visible={removalPrompt !== null}
                title={removalPrompt?.title ?? ''}
                message={removalPrompt?.message}
                onRequestClose={handleCancelRemoval}
                actions={[
                    {
                        label: "Cancel",
                        onPress: handleCancelRemoval,
                        disabled: saving,
                        accessibilityLabel: "Cancel metric deletion",
                    },
                    {
                        label: saving ? "Deleting…" : "Delete",
                        onPress: write,
                        variant: "destructive",
                        disabled: saving,
                        accessibilityLabel: "Confirm metric deletion",
                    },
                ]}
            />
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
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
