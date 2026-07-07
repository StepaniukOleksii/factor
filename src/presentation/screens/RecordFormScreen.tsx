import React, {useEffect, useState} from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar as RNStatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
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
import {PrimaryActionButton, ScreenHeader} from "@presentation/components";
import {formatRelativeTime} from '@shared/formatRelativeTime';

const observationRepository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();
const getObservationByIdUseCase = new GetObservationByIdUseCase(observationRepository);
const createRecordUseCase = new CreateRecordUseCase(recordRepository, observationRepository);
const getRecordByIdUseCase = new GetRecordByIdUseCase(recordRepository);
const updateRecordUseCase = new UpdateRecordUseCase(recordRepository, observationRepository);

const COLORS = {
    background: '#131313',
    surface: '#131313',
    onSurface: '#e5e2e1',
    onSurfaceVariant: '#c2c9b9',
    surfaceContainerLowest: '#0e0e0e',
    surfaceContainerLow: '#1c1b1b',
    outlineVariant: '#42493d',
    outline: '#8c9385',
    primaryContainer: '#b6f09c',
    onPrimaryFixedVariant: '#205110',
    primary: '#f9fff0',
    onPrimary: '#0b3900',
    error: '#ffb4ab',
};

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

        let inputControl = null;
        switch (metric.type) {
            case 'Numeric':
                inputControl = (
                    <TextInput
                        style={[styles.input, error && styles.inputError]}
                        placeholderTextColor={COLORS.outline}
                        keyboardType="numeric"
                        value={values[metric.id] !== undefined ? String(values[metric.id]) : ''}
                        onChangeText={(text) => {
                            const num = parseFloat(text);
                            handleValueChange(metric.id, isNaN(num) ? text : num); // pass text if invalid so it triggers validation error, else number
                        }}
                    />
                );
                break;
            case 'Boolean':
                inputControl = (
                    <Switch
                        value={!!values[metric.id]}
                        onValueChange={(val) => handleValueChange(metric.id, val)}
                        trackColor={{false: COLORS.surfaceContainerLowest, true: COLORS.primaryContainer}}
                        thumbColor={values[metric.id] ? COLORS.onPrimaryFixedVariant : COLORS.outline}
                    />
                );
                break;
            case 'Text':
            case 'Enum':
                // For enum, a picker would be ideal, but falling back to text input for simplicity if not using a specific picker library.
                // As per specs, standard inputs are fine for now.
                inputControl = (
                    <TextInput
                        style={[styles.input, error && styles.inputError]}
                        placeholderTextColor={COLORS.outline}
                        value={values[metric.id] || ''}
                        onChangeText={(text) => handleValueChange(metric.id, text)}
                    />
                );
                break;
            default:
                return null;
        }

        return (
            <View key={metric.id} style={styles.inputContainer}>
                <Text style={styles.label}>{metric.name}</Text>
                <View style={styles.inputWrapper}>
                    {inputControl}
                </View>
                {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <ScreenHeader title="Loading..." onBack={onBack}/>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primaryContainer}/>
                </View>
            </SafeAreaView>
        );
    }

    if (!observation) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <ScreenHeader title="Not found" onBack={onBack}/>
                <View style={styles.loadingContainer}>
                    <Text style={{color: COLORS.onSurface}}>Observation not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (isEditMode && !record) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <ScreenHeader title="Not found" onBack={onBack}/>
                <View style={styles.loadingContainer}>
                    <Text style={{color: COLORS.onSurface}}>Record not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
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

                <View style={styles.footer}>
                    <PrimaryActionButton
                        label={isEditMode ? "Save Record" : "Add Record"}
                        onPress={handleSave}
                        loading={saving}/>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
    },
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        gap: 8,
    },
    label: {
        color: COLORS.primary,
        fontWeight: '600',
        fontSize: 16,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.surfaceContainerLowest,
        borderColor: COLORS.outlineVariant,
        borderWidth: 1,
        color: COLORS.onSurface,
        fontSize: 18,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    inputError: {
        borderColor: COLORS.error,
    },
    errorText: {
        color: COLORS.error,
        fontSize: 12,
        marginTop: 4,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(19, 19, 19, 0.8)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(66, 73, 61, 0.2)',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'android' ? 40 : 16,
        zIndex: 50,
    },
});
