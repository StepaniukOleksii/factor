import React, {useEffect, useRef, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,} from 'react-native';
import DateTimePicker, {type DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {MaterialIcons} from '@expo/vector-icons';
import type {NavigationAction} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {SQLiteRecordRepository} from '../../infrastructure/SQLiteRecordRepository';
import {GetObservationByIdUseCase} from '../../application/GetObservationByIdUseCase';
import {CreateRecordUseCase} from '../../application/CreateRecordUseCase';
import {GetRecordByIdUseCase} from '../../application/GetRecordByIdUseCase';
import {UpdateRecordUseCase} from '../../application/UpdateRecordUseCase';
import {Observation} from '../../domain/Observation';
import {EnumConstraint, Metric, NumericConstraint} from '../../domain/Metric';
import {Record as DomainRecord} from '../../domain/Record';
import {RECORD_NOTE_MAX_LENGTH} from '../../domain/validationLimits';
import {
    CenteredState,
    Dialog,
    FooterBar,
    LabeledTextField,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader,
    SegmentedField,
    SelectField,
    useFooterClearance,
} from "@presentation/components";
import {
    BOOLEAN_METRIC_OPTIONS,
    formatMetricRange,
    formatRangeError,
    NO_METRIC_VALUE,
    toEnumOptions,
} from "@presentation/metricDisplay";
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

/** The baseline a Record form with no Record behind it compares against. */
const NO_STORED_VALUES: ReadonlyMap<string, any> = new Map<string, any>();

/**
 * The number `text` spells, or `text` unchanged when it spells none - which
 * `Metric.validateValue` reports rather than it being dropped as `NaN`.
 *
 * Not `parseFloat`, which reads `'0,5'` as `0`: a comma decimal separator has to
 * be refused, never saved as the digits before it.
 */
function parseNumericValue(text: string): number | string {
    const value = Number(text);
    return text.trim() === '' || !Number.isFinite(value) ? text : value;
}

/**
 * What the form's fields would put on the Record.
 *
 * A Numeric Metric's field holds the text that was typed and is parsed only
 * here: no number can represent `0.` or `1.50`, so a field rendering one back
 * loses the keystroke that made it.
 *
 * The write path normalizes what it stores in any case; it is the dirty check
 * that needs it done here too, so that a form whose only content is whitespace
 * has nothing to offer to discard.
 */
function enteredValues(metrics: ReadonlyArray<Metric>, values: Record<string, any>): Map<string, any> {
    const entered = new Map<string, any>();
    for (const metric of metrics) {
        const value = values[metric.id];
        if (value === undefined || value === null) {
            continue;
        }
        const stored = metric.type === 'Numeric' ? parseNumericValue(value) : metric.normalizeValue(value);
        if (stored === '') {
            continue;
        }
        entered.set(metric.id, stored);
    }
    return entered;
}

/**
 * Whether what the form would save differs from what the Record holds.
 *
 * Neither side carries a key for a Metric with no value, so equal sizes and a
 * match on every entered key is equality - an absent key reads back as
 * `undefined`, which no entered value equals. `!==` suffices for the values
 * themselves: every one is a number, a string or a boolean.
 */
function valuesDiffer(entered: ReadonlyMap<string, any>, stored: ReadonlyMap<string, any>): boolean {
    if (entered.size !== stored.size) {
        return true;
    }
    for (const [metricId, value] of entered) {
        if (stored.get(metricId) !== value) {
            return true;
        }
    }
    return false;
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
    const [note, setNote] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [timestamp, setTimestamp] = useState<Date | null>(null);
    const [openPicker, setOpenPicker] = useState<'date' | 'time' | null>(null);
    /** The removal an exit was intercepted on, held while the user decides. */
    const [pendingExit, setPendingExit] = useState<NavigationAction | null>(null);
    const footerClearance = useFooterClearance();
    /**
     * Saving removes this route too, and the form is still dirty against the
     * Record it loaded at that moment, so that one removal has to pass. A ref
     * rather than state: the listener has to see it within the same tick.
     */
    const leavingAfterSave = useRef(false);

    useEffect(() => {
        loadData();
    }, [observationId, recordId]);

    // The loaded Record is never mutated, so it *is* the baseline - there is no
    // snapshot to take or keep in sync. Create mode has no Record and renders no
    // Date/Time fields, so its baseline is the empty value set and its timestamp
    // never counts.
    //
    // A Record with no note holds `null` where the form holds `''`, so comparing
    // the two raw would call an untouched form dirty the moment it loaded.
    const isDirty =
        valuesDiffer(enteredValues(observation?.metrics ?? [], values), record ? record.values : NO_STORED_VALUES)
        || note.trim() !== (record?.note ?? '')
        || (!!record && !!timestamp && timestamp.getTime() !== record.timestamp.getTime());

    // One listener covers every route off this screen - the header arrow, the
    // cross button, Android's back button and the system back gesture are all
    // route removals, so nothing is wired per control. Taken from the
    // `navigation` prop rather than the `usePreventRemove` or `useNavigation`
    // hooks, both of which need a navigator above them: the screen's tests
    // render it bare, with a fake navigation object.
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
                    for (const metric of data?.metrics ?? []) {
                        const stored = rec.values.get(metric.id);
                        if (stored === undefined) {
                            continue;
                        }
                        initialValues[metric.id] = metric.type === 'Numeric' ? String(stored) : stored;
                    }
                    setValues(initialValues);
                    setNote(rec.note ?? '');
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
        setValues(prev => {
            // A cleared value is the Metric's key being *absent*, never one
            // holding `undefined` or `''` - whatever is found here is submitted.
            if (value === undefined || value === '') {
                const newValues = {...prev};
                delete newValues[metricId];
                return newValues;
            }
            return {...prev, [metricId]: value};
        });
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

        // Values are optional (ADR-3) - only what was entered is validated.
        const entered = enteredValues(observation.metrics, values);
        const newErrors: Record<string, string> = {};
        for (const metric of observation.metrics) {
            if (!entered.has(metric.id)) {
                continue;
            }
            const val = entered.get(metric.id);
            if (!metric.validateValue(val)) {
                // Text that never parsed to a number is not a range problem.
                const rangeMessage = typeof val === 'number'
                    ? formatRangeError(metric.constraint as NumericConstraint | null)
                    : undefined;
                newErrors[metric.id] = rangeMessage ?? 'Invalid value';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            setSaving(true);
            // The Record's whole value set, not a delta - what is left out is cleared.
            const commandValues = [...entered].map(([metricId, value]) => ({metricId, value}));

            if (isEditMode && record && timestamp) {
                await updateRecordUseCase.execute({
                    recordId: record.id,
                    observationId: observation.id,
                    timestamp,
                    values: commandValues,
                    note
                });
            } else {
                await createRecordUseCase.execute({
                    observationId: observation.id,
                    values: commandValues,
                    note
                });
            }
            // Only the success path stands the listener down, so a save that
            // throws leaves the next exit still intercepted.
            leavingAfterSave.current = true;
            onSaved();
        } catch (error: any) {
            console.error(isEditMode ? 'Failed to update record' : 'Failed to create record', error);
            alert(error.message || 'Failed to save record.');
        } finally {
            setSaving(false);
        }
    };

    const renderMetricInput = (metric: Metric) => {
        const error = errors[metric.id];

        // Two answers fit the row inline, so a Boolean is answered in one tap and
        // never opens anything. Both segments start unselected, so "not answered
        // yet" reads differently from "No".
        if (metric.type === 'Boolean') {
            return (
                <View key={metric.id} style={styles.inputContainer}>
                    <SegmentedField<boolean>
                        label={metric.name}
                        testID={`record-metric-${metric.id}`}
                        options={BOOLEAN_METRIC_OPTIONS}
                        selected={values[metric.id]}
                        onSelect={(val) => handleValueChange(metric.id, val)}
                        error={error}
                        helpText={metric.description ?? undefined}
                    />
                </View>
            );
        }

        // Up to four values, each its own words: segments would divide the row
        // between them and wrap anything past a few characters, so these get a
        // line apiece in a picker instead. `NO_METRIC_VALUE` is a row there like
        // any other, keeping "not answered yet" reachable and named.
        if (metric.type === 'Enum') {
            return (
                <View key={metric.id} style={styles.inputContainer}>
                    <SelectField<string>
                        label={metric.name}
                        testID={`record-metric-${metric.id}`}
                        options={toEnumOptions(metric.constraint as EnumConstraint | null)}
                        selected={values[metric.id]}
                        onSelect={(val) => handleValueChange(metric.id, val)}
                        clearLabel={NO_METRIC_VALUE}
                        error={error}
                        helpText={metric.description ?? undefined}
                    />
                </View>
            );
        }

        const isNumeric = metric.type === 'Numeric';

        return (
            <View key={metric.id} style={styles.inputContainer}>
                <LabeledTextField
                    label={metric.name}
                    testID={`record-metric-${metric.id}`}
                    accessibilityLabel={`${metric.name} value`}
                    error={error}
                    helpText={metric.description ?? undefined}
                    keyboardType={isNumeric ? 'numeric' : undefined}
                    placeholder={isNumeric
                        ? formatMetricRange(metric.constraint as NumericConstraint | null)
                        : undefined}
                    value={values[metric.id] !== undefined ? String(values[metric.id]) : ''}
                    onChangeText={(text) => handleValueChange(metric.id, text)}
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
                <ScrollView contentContainerStyle={[styles.scrollContent, {paddingBottom: footerClearance}]}>
                    <View style={styles.metricsList}>
                        {observation.metrics.map(renderMetricInput)}
                    </View>

                    {/* An Observation may define a Metric named "note", so what
                        separates the two here is position rather than any wording
                        on screen. */}
                    <View style={styles.noteSection}>
                        <View style={styles.noteRule}/>
                        <LabeledTextField
                            label="NOTE"
                            testID="record-note"
                            accessibilityLabel="Note"
                            value={note}
                            onChangeText={setNote}
                            multiline
                            numberOfLines={3}
                            maxLength={RECORD_NOTE_MAX_LENGTH}
                            showCounter
                            placeholder="Optional — about this record, not a metric"
                        />
                    </View>
                </ScrollView>

                <FooterBar>
                    <PrimaryActionButton
                        label={isEditMode ? "Save Record" : "Add Record"}
                        onPress={handleSave}
                        loading={saving}/>
                </FooterBar>
            </KeyboardAvoidingView>

            {/* The form keeps its state throughout, so keeping the edit
                restores nothing. */}
            <Dialog
                visible={pendingExit !== null}
                title="Discard changes?"
                message="The changes you made to this record will be lost."
                onRequestClose={handleKeepEditing}
                actions={[
                    {
                        label: "Keep editing",
                        onPress: handleKeepEditing,
                        accessibilityLabel: "Keep editing this record",
                    },
                    {
                        label: "Discard",
                        onPress: handleDiscard,
                        variant: "destructive",
                        accessibilityLabel: "Discard unsaved changes",
                    },
                ]}
            />
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
    noteSection: {
        marginTop: 28,
    },
    noteRule: {
        height: 1,
        backgroundColor: COLORS.outlineVariant,
        marginBottom: 28,
    },
});
