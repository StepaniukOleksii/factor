import React, {useEffect, useState} from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {SQLiteRecordRepository} from '../../infrastructure/SQLiteRecordRepository';
import {GetObservationByIdUseCase} from '../../application/GetObservationByIdUseCase';
import {CreateRecordUseCase} from '../../application/CreateRecordUseCase';
import {GetRecordByIdUseCase} from '../../application/GetRecordByIdUseCase';
import {UpdateRecordUseCase} from '../../application/UpdateRecordUseCase';
import {Observation} from '../../domain/Observation';
import {Metric} from '../../domain/Metric';
import {Record as DomainRecord} from '../../domain/Record';
import {
    CenteredState,
    FooterBar,
    LabeledTextField,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader
} from "@presentation/components";
import {COLORS} from "@presentation/theme";
import {formatRelativeTime} from '@shared/formatRelativeTime';

const observationRepository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();
const getObservationByIdUseCase = new GetObservationByIdUseCase(observationRepository);
const createRecordUseCase = new CreateRecordUseCase(recordRepository, observationRepository);
const getRecordByIdUseCase = new GetRecordByIdUseCase(recordRepository);
const updateRecordUseCase = new UpdateRecordUseCase(recordRepository, observationRepository);

export interface RecordFormScreenProps {
    observationId: string;
    recordId?: string;
    onBack: () => void;
    onCreated: () => void;
}

export function RecordFormScreen({observationId, recordId, onBack, onCreated}: RecordFormScreenProps) {
    const isEditMode = !!recordId;
    const [observation, setObservation] = useState<Observation | null>(null);
    const [record, setRecord] = useState<DomainRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [values, setValues] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadData();
    }, [observationId, recordId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await getObservationByIdUseCase.execute(observationId);
            setObservation(data);

            if (recordId) {
                const rec = await getRecordByIdUseCase.execute(recordId);
                setRecord(rec);
                if (rec) {
                    const initialValues: Record<string, any> = {};
                    for (const [metricId, value] of rec.values.entries()) {
                        initialValues[metricId] = value;
                    }
                    setValues(initialValues);
                }
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleValueChange = (metricId: string, value: any) => {
        setValues(prev => ({...prev, [metricId]: value}));
        if (errors[metricId]) {
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[metricId];
                return newErrors;
            });
        }
    };

    const handleSave = async () => {
        if (!observation) return;
        if (isEditMode && !record) return;

        // Validate all metrics
        const newErrors: Record<string, string> = {};
        for (const metric of observation.metrics) {
            const val = values[metric.id];
            // Basic check for missing required
            if (val === undefined || val === null || val === '') {
                newErrors[metric.id] = 'This field is required';
            } else if (!metric.validateValue(val)) {
                newErrors[metric.id] = 'Invalid value';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            setSaving(true);
            const commandValues = Object.keys(values).map(key => ({
                metricId: key,
                value: values[key]
            }));

            if (isEditMode && record) {
                await updateRecordUseCase.execute({
                    recordId: record.id,
                    observationId: observation.id,
                    values: commandValues
                });
            } else {
                await createRecordUseCase.execute({
                    observationId: observation.id,
                    values: commandValues
                });
            }
            onCreated();
        } catch (error: any) {
            console.error(isEditMode ? 'Failed to update record' : 'Failed to create record', error);
            // fallback generic error handling
            alert(error.message || 'Failed to save record.');
        } finally {
            setSaving(false);
        }
    };

    const renderMetricInput = (metric: Metric) => {
        const error = errors[metric.id];

        // Boolean uses a Switch, which is not a text field.
        if (metric.type === 'Boolean') {
            return (
                <View key={metric.id} style={styles.inputContainer}>
                    <Text style={styles.label}>{metric.name}</Text>
                    <View style={styles.inputWrapper}>
                        <Switch
                            value={!!values[metric.id]}
                            onValueChange={(val) => handleValueChange(metric.id, val)}
                            trackColor={{false: COLORS.surfaceContainerLowest, true: COLORS.primaryContainer}}
                            thumbColor={values[metric.id] ? COLORS.onPrimaryFixedVariant : COLORS.outline}
                        />
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
            );
        }

        // Numeric, Text and Enum all render as a text field.
        // (Enum would ideally use a picker; per spec a standard input is fine for now.)
        const isNumeric = metric.type === 'Numeric';

        return (
            <View key={metric.id} style={styles.inputContainer}>
                <LabeledTextField
                    label={metric.name}
                    error={error}
                    keyboardType={isNumeric ? 'numeric' : undefined}
                    value={values[metric.id] !== undefined ? String(values[metric.id]) : ''}
                    onChangeText={(text) => {
                        if (isNumeric) {
                            const num = parseFloat(text);
                            // pass text if invalid so it triggers validation error, else number
                            handleValueChange(metric.id, isNaN(num) ? text : num);
                        } else {
                            handleValueChange(metric.id, text);
                        }
                    }}
                />
            </View>
        );
    };

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

    if (isEditMode && !record) {
        return (
            <ScreenContainer>
                <ScreenHeader title="Not found" onBack={onBack}/>
                <CenteredState message="Record not found."/>
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer>
            <ScreenHeader
                title={observation.name}
                onBack={onBack}
                rightAction={
                    isEditMode ? (
                        <TouchableOpacity onPress={onBack} accessibilityLabel="Cancel editing">
                            <MaterialIcons name="close" size={24} color={COLORS.primary}/>
                        </TouchableOpacity>
                    ) : undefined
                }
            />

            {isEditMode && record && (
                <View style={styles.timestampContainer}>
                    <Text style={styles.timestampText}>{formatRelativeTime(record.timestamp)}</Text>
                </View>
            )}

            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.metricsList}>
                        {observation.metrics.map(renderMetricInput)}
                    </View>
                </ScrollView>

                <FooterBar>
                    <PrimaryActionButton
                        label={isEditMode ? "Save Record" : "Add Record"}
                        onPress={handleSave}
                        loading={saving}/>
                </FooterBar>
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    timestampContainer: {
        paddingVertical: 8,
        alignItems: 'center',
    },
    timestampText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 13,
        fontWeight: '500',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 120,
    },
    metricsList: {
        gap: 12,
    },
    inputContainer: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        padding: 16,
    },
    // Label for the Boolean (Switch) field; kept visually in sync with LabeledTextField's label.
    label: {
        color: COLORS.onSurfaceVariant,
        fontWeight: '600',
        fontSize: 14,
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorText: {
        color: COLORS.error,
        fontSize: 12,
        marginTop: 4,
    },
});
