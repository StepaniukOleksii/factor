import React, {useEffect, useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CreateObservationInput, CreateObservationUseCase} from '../../application/CreateObservationUseCase';
import {
    CreateObservationErrors,
    hasErrors,
    validateCreateObservation,
} from '../../application/validateCreateObservation';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {MaterialIcons} from '@expo/vector-icons';
import {
    emptyMetricDraft,
    FooterBar,
    type MetricDraft,
    ObservationFormBody,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader,
} from "@presentation/components";
import {COLORS} from "@presentation/theme";
import type {RootStackParamList} from '../navigation/routes';

const repository = new SQLiteObservationRepository();
const useCase = new CreateObservationUseCase(repository);

export type CreateObservationScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateObservation'>;

const NOTHING_MARKED: CreateObservationErrors = {perMetric: []};

export function CreateObservationScreen({navigation}: CreateObservationScreenProps) {
    const [observationName, setObservationName] = useState('');
    const [description, setDescription] = useState('');
    const [metrics, setMetrics] = useState<MetricDraft[]>(() => [emptyMetricDraft()]);
    const [takenNames, setTakenNames] = useState<string[]>([]);
    const [attemptedSave, setAttemptedSave] = useState(false);
    const [saving, setSaving] = useState(false);

    // On mount rather than on focus: nothing that can create an Observation
    // opens above this screen, so the names cannot go stale underneath it
    // (ADR-2). A failed load leaves them empty; the use case still refuses.
    useEffect(() => {
        repository.findAll()
            .then(observations => setTakenNames(observations.map(o => o.name)))
            .catch(error => console.error('Failed to load observation names', error));
    }, []);

    const input: CreateObservationInput = {
        name: observationName,
        description: description.trim(),
        metrics: metrics.map(m => ({
            name: m.name,
            type: m.type,
            description: m.description,
            min: m.min,
            max: m.max,
            values: m.values,
            unit: m.unit,
        })),
    };

    const errors = validateCreateObservation(input, takenNames);
    // Judged every render but withheld until the user has tried to save: a form
    // that opens marked has faulted them for nothing they did yet. Afterwards
    // the marks answer to what is on screen, so a field clears as it is fixed.
    const marked = attemptedSave ? errors : NOTHING_MARKED;

    const handleSave = async () => {
        setAttemptedSave(true);
        if (hasErrors(errors)) {
            return;
        }
        try {
            setSaving(true);
            await useCase.execute(input);
            navigation.goBack();
        } catch (error: any) {
            // Handed back here rather than on the way out: the screen stays
            // tappable while it pops, and a live button there takes a second
            // save that no field can refuse.
            setSaving(false);
            // The last resort, for what no field is holding: the save failing,
            // or a name the use case refused before the existing names arrived.
            Alert.alert('Error', error.message || 'An error occurred while saving.');
        }
    };

    return (
        <ScreenContainer>
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

                <ScreenHeader
                    title="New Observation"
                    onBack={() => navigation.goBack()}
                    rightAction={
                        <TouchableOpacity style={styles.iconButton}>
                            <MaterialIcons name="more-vert" size={24} color={COLORS.onSurface}/>
                        </TouchableOpacity>
                    }
                />

                <ObservationFormBody
                    name={observationName}
                    onNameChange={setObservationName}
                    description={description}
                    onDescriptionChange={setDescription}
                    metrics={metrics}
                    onMetricsChange={setMetrics}
                    errors={marked}
                />

                <FooterBar>
                    <PrimaryActionButton label="Create Observation" onPress={handleSave} loading={saving}/>
                </FooterBar>

            </KeyboardAvoidingView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    iconButton: {
        padding: 8,
    },
});
