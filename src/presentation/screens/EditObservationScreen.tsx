import React, {useEffect, useRef, useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity} from 'react-native';
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
    validateUpdateObservation,
} from '../../application/validateCreateObservation';
import {Metric} from '../../domain/Metric';
import {Observation} from '../../domain/Observation';
import {
    CenteredState,
    Dialog,
    FooterBar,
    type MetricDraft,
    ObservationFormBody,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader,
    toMetricDraft,
} from "@presentation/components";
import {COLORS} from "@presentation/theme";
import {type MetricRemovalPrompt, metricRemovalPrompt} from '@shared/metricRemovalPrompt';
import type {RootStackParamList} from '../navigation/routes';

const repository = new SQLiteObservationRepository();
const useCase = new UpdateObservationUseCase(repository);
const countMetricValuesUseCase = new CountMetricValuesUseCase(new SQLiteRecordRepository());

export type EditObservationScreenProps = NativeStackScreenProps<RootStackParamList, 'EditObservation'>;

const NOTHING_MARKED: CreateObservationErrors = {perMetric: []};

/**
 * Only a Metric's name, description and unit can differ, its type and
 * constraint being stated rather than offered.
 */
function metricsDiffer(drafts: readonly MetricDraft[], stored: ReadonlyArray<Metric>): boolean {
    if (drafts.length !== stored.length) {
        return true;
    }
    return drafts.some((draft, index) => draft.id !== stored[index].id
        || draft.name.trim() !== stored[index].name
        || draft.description.trim() !== (stored[index].description ?? '')
        || draft.unit.trim() !== (stored[index].unit ?? ''));
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
            unit: metric.unit,
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
                <ObservationFormBody
                    name={name}
                    onNameChange={setName}
                    description={description}
                    onDescriptionChange={setDescription}
                    metrics={metrics}
                    onMetricsChange={setMetrics}
                    errors={marked}
                />

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
});
