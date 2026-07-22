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
import DateTimePicker, {type DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {MaterialIcons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
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
import {COLORS, RADIUS, TYPOGRAPHY} from "@presentation/theme";
import {formatShortDate, formatShortTime} from '@shared/formatTimeRange';
import type {RootStackParamList} from '../navigation/routes';

/** The calendar day `date` falls on, as local midnight. Used to cap the Date
 * field's picker at today with day (not millisecond) precision, so the cap
 * stays stable within a render instead of drifting by the clock. */
function floorToDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** `base` with `picked`'s year/month/day; `base`'s time-of-day is unchanged. */
function withDate(base: Date, picked: Date): Date {
    const next = new Date(base);
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    return next;
}

/** `base` with `picked`'s hours/minutes; `base`'s date is unchanged. */
function withTime(base: Date, picked: Date): Date {
    const next = new Date(base);
    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    return next;
}

const observationRepository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();
const getObservationByIdUseCase = new GetObservationByIdUseCase(observationRepository);
const createRecordUseCase = new CreateRecordUseCase(recordRepository, observationRepository);
const getRecordByIdUseCase = new GetRecordByIdUseCase(recordRepository);
const updateRecordUseCase = new UpdateRecordUseCase(recordRepository, observationRepository);

/** One screen behind two routes - see `AppNavigator`. */
export type RecordFormScreenProps = NativeStackScreenProps<RootStackParamList, 'CreateRecord' | 'EditRecord'>;

export function RecordFormScreen({route, navigation}: RecordFormScreenProps) {
    const {observationId} = route.params;
    // The `EditRecord` route is the one that carries a Record to load; without
    // one this is the `CreateRecord` route and the form starts empty.
    const recordId = 'recordId' in route.params ? route.params.recordId : undefined;
    const isEditMode = !!recordId;

    const onBack = () => navigation.goBack();

    /**
     * Opened from the Observation, its details screen is still mounted below -
     * pop back onto it, window and scroll position intact. Opened from the
     * Observation list there is none, so `popTo` puts one in this form's place
     * instead: the user lands on what they just recorded against, and pressing
     * back from there reaches the list rather than the form they submitted.
     */
    const onSaved = () => navigation.popTo('ObservationDetails', {observationId});

    const [observation, setObservation] = useState<Observation | null>(null);
    const [record, setRecord] = useState<DomainRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [values, setValues] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [timestamp, setTimestamp] = useState<Date | null>(null);
    const [openPicker, setOpenPicker] = useState<'date' | 'time' | null>(null);

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
                    setTimestamp(rec.timestamp);
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

    const handleDatePicked = (event: DateTimePickerEvent, picked?: Date) => {
        setOpenPicker(null);
        if (event.type === 'set' && picked && timestamp) {
            setTimestamp(withDate(timestamp, picked));
        }
    };

    const handleTimePicked = (event: DateTimePickerEvent, picked?: Date) => {
        setOpenPicker(null);
        if (event.type === 'set' && picked && timestamp) {
            setTimestamp(withTime(timestamp, picked));
        }
    };

    const handleSave = async () => {
        if (!observation) return;
        if (isEditMode && (!record || !timestamp)) return;

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

            if (isEditMode && record && timestamp) {
                await updateRecordUseCase.execute({
                    recordId: record.id,
                    observationId: observation.id,
                    timestamp,
                    values: commandValues
                });
            } else {
                await createRecordUseCase.execute({
                    observationId: observation.id,
                    values: commandValues
                });
            }
            onSaved();
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
                    accessibilityLabel={`${metric.name} value`}
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

            {isEditMode && record && timestamp && (
                <View style={styles.timestampRow}>
                    <TimestampField
                        testID="record-date-field"
                        label="Date"
                        value={formatShortDate(timestamp)}
                        iconName="calendar-month"
                        onPress={() => setOpenPicker('date')}
                    />
                    <TimestampField
                        testID="record-time-field"
                        label="Time"
                        value={formatShortTime(timestamp)}
                        iconName="schedule"
                        onPress={() => setOpenPicker('time')}
                    />
                </View>
            )}

            {openPicker === 'date' && timestamp && (
                <DateTimePicker
                    testID="record-date-picker"
                    value={timestamp}
                    mode="date"
                    maximumDate={floorToDay(new Date())}
                    onChange={handleDatePicked}
                />
            )}
            {openPicker === 'time' && timestamp && (
                <DateTimePicker
                    testID="record-time-picker"
                    value={timestamp}
                    mode="time"
                    onChange={handleTimePicked}
                />
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

interface TimestampFieldProps {
    testID: string;
    label: string;
    value: string;
    iconName: 'calendar-month' | 'schedule';
    onPress: () => void;
}

/**
 * A labeled timestamp component, opening its picker on tap. Styled after
 * `CustomTimeRangeModal`'s `DayField` - deliberately not a `LabeledTextField`,
 * since the value is picked, never typed.
 */
function TimestampField({testID, label, value, iconName, onPress}: TimestampFieldProps) {
    return (
        <View style={styles.timestampField}>
            <Text style={styles.timestampFieldLabel}>{label}</Text>
            <TouchableOpacity
                testID={testID}
                style={styles.timestampFieldValue}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${value}. Change.`}
            >
                <Text style={styles.timestampFieldValueText}>{value}</Text>
                <MaterialIcons name={iconName} size={18} color={COLORS.onSurfaceVariant}/>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    timestampRow: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
    },
    timestampField: {
        flex: 1,
        gap: 8,
    },
    timestampFieldLabel: {
        ...TYPOGRAPHY.fieldLabel,
    },
    timestampFieldValue: {
        height: 44,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surfaceContainerLowest,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.sm,
    },
    timestampFieldValueText: {
        color: COLORS.onSurface,
        fontSize: 14,
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
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        padding: 16,
    },
    // Label for the Boolean (Switch) field, which can't use LabeledTextField directly.
    label: {...TYPOGRAPHY.fieldLabel, marginBottom: 8},
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorText: {...TYPOGRAPHY.error, marginTop: 4},
});
