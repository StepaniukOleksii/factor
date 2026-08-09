import React, {useState} from 'react';
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
import {MetricValueType} from '../../domain/Metric';
import {
    METRIC_DESCRIPTION_MAX_LENGTH,
    METRIC_ENUM_MAX_VALUES,
    METRIC_ENUM_VALUE_MAX_LENGTH,
    METRIC_NAME_MAX_LENGTH,
    OBSERVATION_DESCRIPTION_MAX_LENGTH,
    OBSERVATION_NAME_MAX_LENGTH,
} from '../../domain/validationLimits';
import {MaterialIcons} from '@expo/vector-icons';
import {
    FOOTER_CLEARANCE,
    FooterBar,
    LabeledTextField,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader,
    SelectField,
    type SelectFieldOption,
} from "@presentation/components";
import {COLORS, RADIUS, TYPOGRAPHY} from "@presentation/theme";
import {formatMetricType} from "@presentation/metricDisplay";
import type {RootStackParamList} from '../navigation/routes';

// Create instances here for simplicity, typically would use DI.
const repository = new SQLiteObservationRepository();
const useCase = new CreateObservationUseCase(repository);

export type CreateObservationScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateObservation'>;

interface MetricDraft {
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

const EMPTY_METRIC: MetricDraft = {
    name: '',
    type: 'Numeric',
    description: '',
    min: '',
    max: '',
    values: EMPTY_METRIC_VALUES,
};

/** The Metric types this screen offers, in the order the picker lists them. */
const METRIC_TYPE_CHOICES: SelectFieldOption<MetricValueType>[] =
    (['Numeric', 'Text', 'Boolean', 'Enum'] as MetricValueType[])
        .map(type => ({value: type, label: formatMetricType(type)}));

const NOTHING_MARKED: CreateObservationErrors = {perMetric: []};
const NO_METRIC_ERRORS: MetricErrors = {};

export function CreateObservationScreen({navigation}: CreateObservationScreenProps) {
    const [observationName, setObservationName] = useState('');
    const [description, setDescription] = useState('');
    const [metrics, setMetrics] = useState<MetricDraft[]>([EMPTY_METRIC]);
    const [attemptedSave, setAttemptedSave] = useState(false);

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

    const errors = validateCreateObservation(input);
    // Judged every render but withheld until the user has tried to save: a form
    // that opens marked has faulted them for nothing they did yet. Afterwards
    // the marks answer to what is on screen, so a field clears as it is fixed.
    const marked = attemptedSave ? errors : NOTHING_MARKED;

    const handleAddMetric = () => {
        setMetrics([...metrics, EMPTY_METRIC]);
    };

    const handleMetricChange = <K extends keyof MetricDraft>(index: number, key: K, value: MetricDraft[K]) => {
        const newMetrics = [...metrics];
        newMetrics[index] = {...newMetrics[index], [key]: value};
        setMetrics(newMetrics);
    };

    const handleRemoveMetric = (index: number) => {
        const newMetrics = metrics.filter((_, i) => i !== index);
        setMetrics(newMetrics);
    };

    const handleValueChange = (index: number, valueIndex: number, value: string) => {
        handleMetricChange(index, 'values',
            metrics[index].values.map((existing, i) => i === valueIndex ? value : existing));
    };

    const handleAddValue = (index: number) => {
        handleMetricChange(index, 'values', [...metrics[index].values, '']);
    };

    const handleRemoveValue = (index: number, valueIndex: number) => {
        handleMetricChange(index, 'values', metrics[index].values.filter((_, i) => i !== valueIndex));
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
            // Nothing the fields could have shown - the input passed the same
            // rules the use case applies, so anything left is the save failing.
            Alert.alert('Error', error.message || 'An error occurred while saving.');
        }
    };

    const selectType = (index: number, type: MetricValueType) => {
        const newMetrics = [...metrics];
        const metric = newMetrics[index];
        // Each editor belongs to a single type, so anything typed into one goes
        // when the type does - never submitted unseen.
        newMetrics[index] = {
            ...metric,
            type,
            min: type === 'Numeric' ? metric.min : '',
            max: type === 'Numeric' ? metric.max : '',
            values: type === 'Enum' ? metric.values : EMPTY_METRIC_VALUES,
        };
        setMetrics(newMetrics);
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

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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

                        {metrics.map((metric, index) => {
                            const metricError = marked.perMetric[index] ?? NO_METRIC_ERRORS;

                            return (
                                <View key={index} style={styles.metricCard}>
                                    <View style={styles.metricGrid}>
                                        <View style={styles.metricField}>
                                            <LabeledTextField
                                                label="METRIC NAME"
                                                labelAccessory={metrics.length > 1 ? (
                                                    <TouchableOpacity onPress={() => handleRemoveMetric(index)}
                                                                      style={styles.deleteButton}>
                                                        <MaterialIcons name="delete" size={20}
                                                                       color={COLORS.outline}/>
                                                    </TouchableOpacity>
                                                ) : undefined}
                                                value={metric.name}
                                                onChangeText={(val) => handleMetricChange(index, 'name', val)}
                                                placeholder="e.g., Duration"
                                                maxLength={METRIC_NAME_MAX_LENGTH}
                                                showCounter
                                                error={metricError.name}
                                            />
                                        </View>

                                        <View style={styles.metricField}>
                                            <SelectField<MetricValueType>
                                                label="TYPE"
                                                testID={`metric-type-${index}`}
                                                options={METRIC_TYPE_CHOICES}
                                                selected={metric.type}
                                                // A Metric always has a type, so the
                                                // picker offers no way back to none.
                                                onSelect={(type) => selectType(index, type!)}
                                            />
                                        </View>

                                        {metric.type === 'Numeric' && (
                                            <View>
                                                <View style={styles.boundsRow}>
                                                    <View style={styles.boundField}>
                                                        <LabeledTextField
                                                            label="MIN"
                                                            testID={`metric-min-${index}`}
                                                            value={metric.min}
                                                            onChangeText={(val) => handleMetricChange(index, 'min', val)}
                                                            keyboardType="numeric"
                                                            error={metricError.min}
                                                        />
                                                    </View>
                                                    <View style={styles.boundField}>
                                                        <LabeledTextField
                                                            label="MAX"
                                                            testID={`metric-max-${index}`}
                                                            value={metric.max}
                                                            onChangeText={(val) => handleMetricChange(index, 'max', val)}
                                                            keyboardType="numeric"
                                                            error={metricError.max}
                                                        />
                                                    </View>
                                                </View>
                                                {/* Below the pair rather than in either field: neither
                                                    bound is wrong on its own. */}
                                                {metricError.range ? (
                                                    <Text style={styles.groupError}>{metricError.range}</Text>
                                                ) : null}
                                            </View>
                                        )}

                                        {metric.type === 'Enum' && (
                                            <View>
                                                <View style={styles.valueRows}>
                                                    {metric.values.map((value, valueIndex) => (
                                                        <LabeledTextField
                                                            key={valueIndex}
                                                            label={`VALUE ${valueIndex + 1}`}
                                                            testID={`metric-value-${index}-${valueIndex}`}
                                                            labelAccessory={metric.values.length > EMPTY_METRIC_VALUES.length ? (
                                                                <TouchableOpacity
                                                                    onPress={() => handleRemoveValue(index, valueIndex)}
                                                                    style={styles.deleteButton}>
                                                                    <MaterialIcons name="delete" size={20}
                                                                                   color={COLORS.outline}/>
                                                                </TouchableOpacity>
                                                            ) : undefined}
                                                            value={value}
                                                            onChangeText={(val) => handleValueChange(index, valueIndex, val)}
                                                            maxLength={METRIC_ENUM_VALUE_MAX_LENGTH}
                                                            showCounter
                                                        />
                                                    ))}
                                                </View>

                                                {/* Below the rows rather than in any one of them: which
                                                    row is short of a value is the user's choice. */}
                                                {metricError.values ? (
                                                    <Text style={styles.groupError}>{metricError.values}</Text>
                                                ) : null}

                                                {metric.values.length < METRIC_ENUM_MAX_VALUES && (
                                                    <TouchableOpacity
                                                        style={[styles.dashedButton, styles.addValueButton]}
                                                        onPress={() => handleAddValue(index)}
                                                    >
                                                        <MaterialIcons name="add" size={20}
                                                                       color={COLORS.onSurfaceVariant}/>
                                                        <Text style={styles.dashedButtonText}>Add Value</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        )}

                                        <View style={styles.metricField}>
                                            <LabeledTextField
                                                label="DESCRIPTION"
                                                value={metric.description}
                                                onChangeText={(val) => handleMetricChange(index, 'description', val)}
                                                placeholder="Optional — what does each value mean?"
                                                multiline
                                                numberOfLines={3}
                                                maxLength={METRIC_DESCRIPTION_MAX_LENGTH}
                                                showCounter
                                                error={metricError.description}
                                            />
                                        </View>
                                    </View>
                                </View>
                            );
                        })}

                        <TouchableOpacity style={styles.dashedButton} onPress={handleAddMetric}>
                            <MaterialIcons name="add" size={20} color={COLORS.onSurfaceVariant}/>
                            <Text style={styles.dashedButtonText}>Add Metric</Text>
                        </TouchableOpacity>
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
        paddingBottom: FOOTER_CLEARANCE,
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
    // Tighter than the card's own 16px field spacing: the rows are one list
    // inside a field rather than fields in their own right.
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
    dashedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.md,
        gap: 8,
    },
    dashedButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.onSurfaceVariant,
    },
    addValueButton: {
        marginTop: 12,
    },
});
