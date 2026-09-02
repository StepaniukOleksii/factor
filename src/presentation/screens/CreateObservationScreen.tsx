import React, {useEffect, useState} from 'react';
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
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CreateObservationInput, CreateObservationUseCase} from '../../application/CreateObservationUseCase';
import {
    CreateObservationErrors,
    hasErrors,
    MetricErrors,
    validateCreateObservation,
} from '../../application/validateCreateObservation';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {
    OBSERVATION_DESCRIPTION_MAX_LENGTH,
    OBSERVATION_NAME_MAX_LENGTH,
} from '../../domain/validationLimits';
import {MaterialIcons} from '@expo/vector-icons';
import {
    DashedButton,
    emptyMetricDraft,
    FooterBar,
    LabeledTextField,
    type MetricDraft,
    MetricEditorCard,
    moveMetricDraft,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader,
    useFooterClearance,
} from "@presentation/components";
import {COLORS, TYPOGRAPHY} from "@presentation/theme";
import type {RootStackParamList} from '../navigation/routes';

const repository = new SQLiteObservationRepository();
const useCase = new CreateObservationUseCase(repository);

export type CreateObservationScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateObservation'>;

const NOTHING_MARKED: CreateObservationErrors = {perMetric: []};
const NO_METRIC_ERRORS: MetricErrors = {};

export function CreateObservationScreen({navigation}: CreateObservationScreenProps) {
    const [observationName, setObservationName] = useState('');
    const [description, setDescription] = useState('');
    const [metrics, setMetrics] = useState<MetricDraft[]>(() => [emptyMetricDraft()]);
    const [takenNames, setTakenNames] = useState<string[]>([]);
    const [attemptedSave, setAttemptedSave] = useState(false);
    const footerClearance = useFooterClearance();

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
        })),
    };

    const errors = validateCreateObservation(input, takenNames);
    // Judged every render but withheld until the user has tried to save: a form
    // that opens marked has faulted them for nothing they did yet. Afterwards
    // the marks answer to what is on screen, so a field clears as it is fixed.
    const marked = attemptedSave ? errors : NOTHING_MARKED;

    const handleAddMetric = () => {
        setMetrics([...metrics, emptyMetricDraft()]);
    };

    const handleMetricChange = (index: number, metric: MetricDraft) => {
        setMetrics(metrics.map((existing, i) => i === index ? metric : existing));
    };

    const handleRemoveMetric = (index: number) => {
        setMetrics(metrics.filter((_, i) => i !== index));
    };

    const handleMoveMetric = (from: number, to: number) => {
        setMetrics(moveMetricDraft(metrics, from, to));
    };

    const handleSave = async () => {
        setAttemptedSave(true);
        if (hasErrors(errors)) {
            return;
        }
        try {
            await useCase.execute(input);
            navigation.goBack();
        } catch (error: any) {
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
                <View style={styles.stickySection}>
                    <View style={styles.section}>
                        <LabeledTextField
                            label="OBSERVATION NAME"
                            value={observationName}
                            onChangeText={setObservationName}
                            placeholder="e.g., Sleep Quality, Mood"
                            maxLength={OBSERVATION_NAME_MAX_LENGTH}
                            showCounter
                            error={marked.name}
                        />
                    </View>
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
                                key={metric.key}
                                metric={metric}
                                index={index}
                                errors={marked.perMetric[index] ?? NO_METRIC_ERRORS}
                                onChange={(next) => handleMetricChange(index, next)}
                                onRemove={metrics.length > 1 ? () => handleRemoveMetric(index) : undefined}
                                onMoveUp={index > 0 ? () => handleMoveMetric(index, index - 1) : undefined}
                                onMoveDown={index < metrics.length - 1 ? () => handleMoveMetric(index, index + 1) : undefined}
                            />
                        ))}

                        <DashedButton label="Add Metric" onPress={handleAddMetric}/>
                    </View>
                </ScrollView>

                <FooterBar>
                    <PrimaryActionButton label="Create Observation" onPress={handleSave}/>
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
    stickySection: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
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
    section: {
        marginBottom: 0,
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
