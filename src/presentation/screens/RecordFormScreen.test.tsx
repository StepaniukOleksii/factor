import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Switch} from 'react-native';
import {RecordFormScreen} from './RecordFormScreen';
import {Observation} from '../../domain/Observation';
import {Metric} from '../../domain/Metric';
import {Record as DomainRecord} from '../../domain/Record';
import {formatShortDate, formatShortTime} from '@shared/formatTimeRange';

const {
    mockGetObservationByIdExecute,
    mockGetRecordByIdExecute,
    mockCreateRecordExecute,
    mockUpdateRecordExecute,
} = vi.hoisted(() => {
    return {
        mockGetObservationByIdExecute: vi.fn(),
        mockGetRecordByIdExecute: vi.fn(),
        mockCreateRecordExecute: vi.fn(),
        mockUpdateRecordExecute: vi.fn(),
    };
});

vi.mock('react-native', () => {
    const RN = require('react-native-web');
    // react-native-web's real TextInput touches `document` on mount, which isn't
    // available under the node test environment; stub it as a plain host node so
    // its props (value, onChangeText, ...) remain inspectable.
    RN.TextInput = 'TextInput';
    return RN;
});
vi.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));
vi.mock('@react-native-community/datetimepicker', () => ({
    default: 'DateTimePicker',
}));

vi.mock('../../infrastructure/SQLiteObservationRepository', () => ({
    SQLiteObservationRepository: vi.fn(),
}));
vi.mock('../../infrastructure/SQLiteRecordRepository', () => ({
    SQLiteRecordRepository: vi.fn(),
}));

vi.mock('../../application/GetObservationByIdUseCase', () => ({
    GetObservationByIdUseCase: vi.fn().mockImplementation(() => ({
        execute: mockGetObservationByIdExecute,
    })),
}));
vi.mock('../../application/GetRecordByIdUseCase', () => ({
    GetRecordByIdUseCase: vi.fn().mockImplementation(() => ({
        execute: mockGetRecordByIdExecute,
    })),
}));
vi.mock('../../application/CreateRecordUseCase', () => ({
    CreateRecordUseCase: vi.fn().mockImplementation(() => ({
        execute: mockCreateRecordExecute,
    })),
}));
vi.mock('../../application/UpdateRecordUseCase', () => ({
    UpdateRecordUseCase: vi.fn().mockImplementation(() => ({
        execute: mockUpdateRecordExecute,
    })),
}));

// --- Helpers ---

function findAllByText(root: any, text: string) {
    return root.findAll(
        (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
    );
}

function findTouchableWithText(root: any, text: string) {
    const textNodes = findAllByText(root, text);
    for (const textNode of textNodes) {
        let current = textNode.parent;
        while (current) {
            if (current.props && typeof current.props.onPress === 'function') {
                return current;
            }
            current = current.parent;
        }
    }
    return null;
}

function findTextContaining(root: any, substring: string) {
    return root.findAll(
        (node: any) => node.children && node.children.length === 1
            && typeof node.children[0] === 'string' && node.children[0].includes(substring),
    );
}

function findTouchableWithIconName(root: any, iconName: string) {
    const icons = root.findAllByProps({name: iconName});
    for (const icon of icons) {
        let current = icon.parent;
        while (current) {
            if (current.props && typeof current.props.onPress === 'function') {
                return current;
            }
            current = current.parent;
        }
    }
    return null;
}

/** A Boolean Metric's "Yes"/"No" segment - the outermost match is the touchable itself. */
function booleanSegment(root: any, metricId: string, value: boolean) {
    return root.findAllByProps({testID: `record-metric-${metricId}-${value}`})[0];
}

async function pressBooleanSegment(root: any, metricId: string, value: boolean) {
    await act(async () => {
        booleanSegment(root, metricId, value).props.onPress();
    });
}

/** Each segment's selected state, "Yes" first. */
function booleanSelectedStates(root: any, metricId: string): boolean[] {
    return [true, false].map(
        value => booleanSegment(root, metricId, value).props.accessibilityState.selected,
    );
}

function dateField(root: any) {
    return root.findAllByProps({testID: 'record-date-field'})[0];
}

function timeField(root: any) {
    return root.findAllByProps({testID: 'record-time-field'})[0];
}

async function openDatePicker(root: any) {
    await act(async () => {
        dateField(root).props.onPress();
    });
    return root.findAllByProps({testID: 'record-date-picker'})[0];
}

async function openTimePicker(root: any) {
    await act(async () => {
        timeField(root).props.onPress();
    });
    return root.findAllByProps({testID: 'record-time-picker'})[0];
}

const durationMetric = new Metric('metric-1', 'Duration', 'Numeric');
const restedMetric = new Metric('metric-2', 'Well Rested', 'Boolean');
const observation = new Observation('obs-1', 'Sleep Quality', [durationMetric, restedMetric]);

/**
 * The screen takes its ids from the route and leaves through the stack, so both
 * are faked here rather than passed as callbacks. Backing out pops, and saving
 * pops back onto the Observation - spying on those two navigation calls asserts
 * exactly what the `onBack`/`onCreated` props used to.
 */
async function renderScreen(props: Partial<{ observationId: string, recordId: string, onBack: () => void, onCreated: () => void }> = {}) {
    const onBack = props.onBack ?? vi.fn();
    const onCreated = props.onCreated ?? vi.fn();
    const observationId = props.observationId ?? 'obs-1';
    const route = props.recordId
        ? {name: 'EditRecord', params: {observationId, recordId: props.recordId}}
        : {name: 'CreateRecord', params: {observationId}};
    let root: any;
    await act(async () => {
        root = renderer.create(
            <RecordFormScreen
                route={route as any}
                navigation={{goBack: onBack, popTo: onCreated} as any}
            />,
        );
    });
    return {root: root!, onBack, onCreated};
}

describe('RecordFormScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(observation);
        mockCreateRecordExecute.mockResolvedValue(undefined);
        mockUpdateRecordExecute.mockResolvedValue(undefined);
        vi.stubGlobal('alert', vi.fn());
    });

    describe('create mode', () => {
        it('renders with empty inputs and the "Add Record" label, with no timestamp, Date/Time fields, or cross button', async () => {
            const {root} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            expect(durationInput.props.value).toBe('');

            expect(findAllByText(root.root, 'Add Record').length).toBeGreaterThan(0);
            expect(findAllByText(root.root, 'Save Record').length).toBe(0);
            expect(root.root.findAllByProps({name: 'close'}).length).toBe(0);
            expect(root.root.findAllByProps({testID: 'record-date-field'}).length).toBe(0);
            expect(root.root.findAllByProps({testID: 'record-time-field'}).length).toBe(0);

            expect(mockGetRecordByIdExecute).not.toHaveBeenCalled();
        });

        it('renders the Boolean metric as an unselected Yes/No segmented field, not a Switch', async () => {
            const {root} = await renderScreen();

            expect(findAllByText(root.root, 'Yes').length).toBe(1);
            expect(findAllByText(root.root, 'No').length).toBe(1);
            // Neither segment selected, so "not answered yet" is visibly its own
            // state rather than looking like an answer of "No".
            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([false, false]);
            expect(root.root.findAllByType(Switch).length).toBe(0);
        });

        it('creates a record and calls onCreated without touching UpdateRecordUseCase', async () => {
            const {root, onCreated} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            await pressBooleanSegment(root.root, 'metric-2', true);

            const saveButton = findTouchableWithText(root.root, 'Add Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockCreateRecordExecute).toHaveBeenCalledWith({
                observationId: 'obs-1',
                values: [
                    {metricId: 'metric-1', value: 8},
                    {metricId: 'metric-2', value: true},
                ],
            });
            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
            expect(onCreated).toHaveBeenCalledTimes(1);
        });

        // The Switch this replaced sat at "off" while the Metric held no value, so
        // recording `false` meant turning it on and back off again - two taps, and
        // a value that never differed from an untouched field.
        it('submits false after a single press on "No"', async () => {
            const {root} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            await pressBooleanSegment(root.root, 'metric-2', false);
            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([false, true]);

            const saveButton = findTouchableWithText(root.root, 'Add Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockCreateRecordExecute).toHaveBeenCalledWith({
                observationId: 'obs-1',
                values: [
                    {metricId: 'metric-1', value: 8},
                    {metricId: 'metric-2', value: false},
                ],
            });
        });

        it('blocks saving while the Boolean is unanswered, with the required message', async () => {
            const {root} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            const saveButton = findTouchableWithText(root.root, 'Add Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockCreateRecordExecute).not.toHaveBeenCalled();
            expect(findAllByText(root.root, 'This field is required').length).toBe(1);
        });

        it('clears the message once a segment is picked, and blocks the save again once it is cleared', async () => {
            const {root} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            const saveButton = findTouchableWithText(root.root, 'Add Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });
            expect(findAllByText(root.root, 'This field is required').length).toBe(1);

            await pressBooleanSegment(root.root, 'metric-2', true);
            expect(findAllByText(root.root, 'This field is required').length).toBe(0);

            // Pressing the selected segment returns the field to no value, which
            // the required rule blocks exactly as an untouched one.
            await pressBooleanSegment(root.root, 'metric-2', true);
            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([false, false]);

            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockCreateRecordExecute).not.toHaveBeenCalled();
            // A cleared Metric contributes no value at all. Were its key left in
            // place holding `undefined`, it would reach `Metric.validateValue` as
            // an *invalid* value instead - "Invalid value", or a save alert.
            expect(findAllByText(root.root, 'This field is required').length).toBe(1);
            expect(findAllByText(root.root, 'Invalid value').length).toBe(0);
            expect(globalThis.alert).not.toHaveBeenCalled();
        });

        it('calls onBack when the back button is pressed, without persisting anything', async () => {
            const {root, onBack} = await renderScreen();

            const backButton = findTouchableWithIconName(root.root, 'arrow-back');
            await act(async () => {
                backButton!.props.onPress();
            });

            expect(onBack).toHaveBeenCalledTimes(1);
            expect(mockCreateRecordExecute).not.toHaveBeenCalled();
        });
    });

    describe('edit mode', () => {
        const timestamp = new Date('2024-01-15T08:15:00');
        const existingRecord = new DomainRecord(
            'record-1',
            'obs-1',
            timestamp,
            new Map<string, any>([['metric-1', 7.2], ['metric-2', true]]),
        );

        beforeEach(() => {
            mockGetRecordByIdExecute.mockResolvedValue(existingRecord);
        });

        it('loads the observation and the record, pre-populating metric inputs', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            expect(mockGetObservationByIdExecute).toHaveBeenCalledWith('obs-1');
            expect(mockGetRecordByIdExecute).toHaveBeenCalledWith('record-1');

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            expect(durationInput.props.value).toBe('7.2');
        });

        it.each([true, false])('pre-selects the segment matching the stored value %s', async stored => {
            mockGetRecordByIdExecute.mockResolvedValue(new DomainRecord(
                'record-1',
                'obs-1',
                timestamp,
                new Map<string, any>([['metric-1', 7.2], ['metric-2', stored]]),
            ));

            const {root} = await renderScreen({recordId: 'record-1'});

            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([stored, !stored]);
        });

        it('displays the observation title, metrics, and Date/Time fields pre-filled from the record', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            expect(findAllByText(root.root, 'Sleep Quality').length).toBeGreaterThan(0);
            expect(findAllByText(root.root, 'Duration').length).toBeGreaterThan(0);
            expect(findAllByText(root.root, 'Well Rested').length).toBeGreaterThan(0);

            expect(findAllByText(root.root, 'Date').length).toBeGreaterThan(0);
            expect(findAllByText(root.root, formatShortDate(timestamp)).length).toBeGreaterThan(0);
            expect(findAllByText(root.root, 'Time').length).toBeGreaterThan(0);
            expect(findAllByText(root.root, formatShortTime(timestamp)).length).toBeGreaterThan(0);

            expect(findAllByText(root.root, 'Save Record').length).toBeGreaterThan(0);
        });

        it('opens a date picker pre-filled with the record\'s date, capped at today, and a time picker pre-filled with its time', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            const datePicker = await openDatePicker(root.root);
            expect(datePicker.props.mode).toBe('date');
            expect(datePicker.props.value).toEqual(timestamp);
            const today = new Date();
            expect(datePicker.props.maximumDate).toEqual(
                new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            );

            const timePicker = await openTimePicker(root.root);
            expect(timePicker.props.mode).toBe('time');
            expect(timePicker.props.value).toEqual(timestamp);
        });

        it('only shows one picker open at a time', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            await openDatePicker(root.root);
            expect(root.root.findAllByProps({testID: 'record-date-picker'}).length).toBe(1);

            await openTimePicker(root.root);
            expect(root.root.findAllByProps({testID: 'record-date-picker'}).length).toBe(0);
            expect(root.root.findAllByProps({testID: 'record-time-picker'}).length).toBe(1);
        });

        it('picking a new date updates only the date portion, leaving the time-of-day unchanged', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});
            const pickedDate = new Date(2024, 1, 20, 13, 45);

            const picker = await openDatePicker(root.root);
            await act(async () => {
                picker.props.onChange({type: 'set'}, pickedDate);
            });

            expect(findAllByText(root.root, formatShortDate(new Date(2024, 1, 20))).length).toBeGreaterThan(0);
            expect(findAllByText(root.root, formatShortTime(timestamp)).length).toBeGreaterThan(0);
        });

        it('picking a new time updates only the time-of-day, leaving the date unchanged', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});
            const pickedTime = new Date(2000, 0, 1, 23, 50);

            const picker = await openTimePicker(root.root);
            await act(async () => {
                picker.props.onChange({type: 'set'}, pickedTime);
            });

            expect(findAllByText(root.root, formatShortDate(timestamp)).length).toBeGreaterThan(0);
            expect(findAllByText(root.root, formatShortTime(pickedTime)).length).toBeGreaterThan(0);
        });

        it('leaves the timestamp unchanged when a picker is dismissed', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            const picker = await openDatePicker(root.root);
            await act(async () => {
                picker.props.onChange({type: 'dismissed'}, undefined);
            });

            expect(findAllByText(root.root, formatShortDate(timestamp)).length).toBeGreaterThan(0);
        });

        it('enforces validation and does not call UpdateRecordUseCase on invalid input', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('not-a-number');
            });

            const saveButton = findTouchableWithText(root.root, 'Save Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
            expect(findAllByText(root.root, 'Invalid value').length).toBeGreaterThan(0);
        });

        it('saves changes via UpdateRecordUseCase, preserving the record id and unedited timestamp, then calls onCreated', async () => {
            const {root, onCreated} = await renderScreen({recordId: 'record-1'});

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            const saveButton = findTouchableWithText(root.root, 'Save Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockUpdateRecordExecute).toHaveBeenCalledWith({
                recordId: 'record-1',
                observationId: 'obs-1',
                timestamp,
                values: [
                    {metricId: 'metric-1', value: 8},
                    {metricId: 'metric-2', value: true},
                ],
            });
            expect(mockCreateRecordExecute).not.toHaveBeenCalled();
            expect(onCreated).toHaveBeenCalledTimes(1);
        });

        it('submits the new value when the Boolean selection is changed', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            await pressBooleanSegment(root.root, 'metric-2', false);
            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([false, true]);

            const saveButton = findTouchableWithText(root.root, 'Save Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockUpdateRecordExecute).toHaveBeenCalledWith({
                recordId: 'record-1',
                observationId: 'obs-1',
                timestamp,
                values: [
                    {metricId: 'metric-1', value: 7.2},
                    {metricId: 'metric-2', value: false},
                ],
            });
        });

        it('blocks saving once the stored Boolean is cleared', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            // The stored value is `true`, so pressing "Yes" deselects it.
            await pressBooleanSegment(root.root, 'metric-2', true);
            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([false, false]);

            const saveButton = findTouchableWithText(root.root, 'Save Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
            expect(findAllByText(root.root, 'This field is required').length).toBe(1);
        });

        it('saves the edited timestamp alongside edited values', async () => {
            const {root, onCreated} = await renderScreen({recordId: 'record-1'});
            const pickedDate = new Date(2024, 1, 20);

            const picker = await openDatePicker(root.root);
            await act(async () => {
                picker.props.onChange({type: 'set'}, pickedDate);
            });

            const saveButton = findTouchableWithText(root.root, 'Save Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            const [command] = mockUpdateRecordExecute.mock.calls[0];
            expect(command.timestamp.getFullYear()).toBe(2024);
            expect(command.timestamp.getMonth()).toBe(1);
            expect(command.timestamp.getDate()).toBe(20);
            // Time-of-day carried over from the loaded record, untouched by the date edit.
            expect(command.timestamp.getHours()).toBe(timestamp.getHours());
            expect(command.timestamp.getMinutes()).toBe(timestamp.getMinutes());
            expect(onCreated).toHaveBeenCalledTimes(1);
        });

        it('discards an edited timestamp when leaving without saving', async () => {
            const {root, onBack} = await renderScreen({recordId: 'record-1'});

            const picker = await openDatePicker(root.root);
            await act(async () => {
                picker.props.onChange({type: 'set'}, new Date(2024, 1, 20));
            });

            const closeButton = findTouchableWithIconName(root.root, 'close');
            await act(async () => {
                closeButton!.props.onPress();
            });

            expect(onBack).toHaveBeenCalledTimes(1);
            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
        });

        it('calls onBack when the back arrow is pressed, without persisting anything', async () => {
            const {root, onBack} = await renderScreen({recordId: 'record-1'});

            const backButton = findTouchableWithIconName(root.root, 'arrow-back');
            await act(async () => {
                backButton!.props.onPress();
            });

            expect(onBack).toHaveBeenCalledTimes(1);
            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
        });

        it('calls onBack when the cross/close button is pressed, without persisting anything', async () => {
            const {root, onBack} = await renderScreen({recordId: 'record-1'});

            const closeButton = findTouchableWithIconName(root.root, 'close');
            expect(closeButton).toBeTruthy();

            await act(async () => {
                closeButton!.props.onPress();
            });

            expect(onBack).toHaveBeenCalledTimes(1);
            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
        });

        it('shows a not-found message when the record does not exist', async () => {
            mockGetRecordByIdExecute.mockResolvedValue(null);

            const {root} = await renderScreen({recordId: 'record-missing'});

            expect(findAllByText(root.root, 'Record not found.').length).toBeGreaterThan(0);
        });
    });
});
