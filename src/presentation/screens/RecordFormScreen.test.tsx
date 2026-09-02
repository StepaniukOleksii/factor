import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Switch} from 'react-native';
import {RecordFormScreen} from './RecordFormScreen';
import {Observation} from '../../domain/Observation';
import {Metric} from '../../domain/Metric';
import {Record as DomainRecord} from '../../domain/Record';
import {RECORD_NOTE_MAX_LENGTH} from '../../domain/validationLimits';
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
    RN.Modal = ({children, visible}: any) =>
        visible ? <RN.View testID="modal">{children}</RN.View> : null;
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
 * pops back onto the Observation; those two navigation spies are how both are
 * asserted.
 *
 * `addListener` records the screen's `beforeRemove` listener so a test can
 * invoke it with a fake event, which is how every exit reaches the screen once
 * one is registered.
 */
async function renderScreen(props: Partial<{ observationId: string, recordId: string, onBack: () => void, onCreated: () => void }> = {}) {
    const onBack = props.onBack ?? vi.fn();
    const onCreated = props.onCreated ?? vi.fn();
    const dispatch = vi.fn();
    const observationId = props.observationId ?? 'obs-1';
    const route = props.recordId
        ? {name: 'EditRecord', params: {observationId, recordId: props.recordId}}
        : {name: 'CreateRecord', params: {observationId}};
    const listeners: Record<string, (event: any) => void> = {};
    const addListener = vi.fn((event: string, listener: (event: any) => void) => {
        listeners[event] = listener;
        return () => {
            delete listeners[event];
        };
    });
    let root: any;
    await act(async () => {
        root = renderer.create(
            <RecordFormScreen
                route={route as any}
                navigation={{goBack: onBack, popTo: onCreated, dispatch, addListener} as any}
            />,
        );
    });
    return {root: root!, onBack, onCreated, dispatch, listeners};
}

/** The removal an exit dispatches, as `beforeRemove` carries it. */
const POP_ACTION = {type: 'POP', payload: {count: 1}};

/**
 * Leaves the screen the way every route off it does: through the `beforeRemove`
 * listener. Returns whether the removal was prevented.
 */
async function leaveScreen(listeners: Record<string, (event: any) => void>, action: any = POP_ACTION) {
    const event = {
        data: {action},
        preventDefault: vi.fn(),
    };
    await act(async () => {
        listeners['beforeRemove'](event);
    });
    return event.preventDefault.mock.calls.length > 0;
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
                note: '',
            });
            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
            expect(onCreated).toHaveBeenCalledTimes(1);
        });

        // One press records `false`. A two-state control would rest at "off" while
        // the Metric held no value, making `false` cost two taps and never differ
        // visibly from an untouched field.
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
                note: '',
            });
        });

        it('saves the Metric that was filled in, omitting the unanswered Boolean', async () => {
            const {root} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            const saveButton = findTouchableWithText(root.root, 'Add Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockCreateRecordExecute).toHaveBeenCalledWith({
                observationId: 'obs-1',
                values: [{metricId: 'metric-1', value: 8}],
                note: '',
            });
        });

        it('omits a Boolean that was picked and then cleared again', async () => {
            const {root} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            await pressBooleanSegment(root.root, 'metric-2', true);
            // Pressing the selected segment returns the field to no value.
            await pressBooleanSegment(root.root, 'metric-2', true);
            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([false, false]);

            const saveButton = findTouchableWithText(root.root, 'Add Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            // Were the key left in place holding `undefined`, it would reach
            // `Metric.validateValue` as an *invalid* value - hence the checks below.
            expect(mockCreateRecordExecute).toHaveBeenCalledWith({
                observationId: 'obs-1',
                values: [{metricId: 'metric-1', value: 8}],
                note: '',
            });
            expect(findAllByText(root.root, 'Invalid value').length).toBe(0);
            expect(globalThis.alert).not.toHaveBeenCalled();
        });

        it('creates a Record carrying no values when nothing at all is entered', async () => {
            const {root} = await renderScreen();

            const saveButton = findTouchableWithText(root.root, 'Add Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockCreateRecordExecute).toHaveBeenCalledWith({
                observationId: 'obs-1',
                values: [],
                note: '',
            });
        });

        it('omits a Numeric Metric whose text was typed and then erased', async () => {
            const {root} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });
            await act(async () => {
                durationInput.props.onChangeText('');
            });

            const saveButton = findTouchableWithText(root.root, 'Add Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockCreateRecordExecute).toHaveBeenCalledWith({
                observationId: 'obs-1',
                values: [],
                note: '',
            });
            expect(findAllByText(root.root, 'Invalid value').length).toBe(0);
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
                note: '',
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
                note: '',
            });
        });

        it('submits without the Metric once the stored Boolean is cleared', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            // The stored value is `true`, so pressing "Yes" deselects it.
            await pressBooleanSegment(root.root, 'metric-2', true);
            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([false, false]);

            const saveButton = findTouchableWithText(root.root, 'Save Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockUpdateRecordExecute).toHaveBeenCalledWith({
                recordId: 'record-1',
                observationId: 'obs-1',
                timestamp,
                values: [{metricId: 'metric-1', value: 7.2}],
                note: '',
            });
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

    // Every route off the form - the header arrow, the cross button, Android's
    // back button and the system back gesture - is one route removal, so the
    // `beforeRemove` listener stands in for all four.
    describe('unsaved changes confirmation', () => {
        const timestamp = new Date('2024-01-15T08:15:00');
        const existingRecord = new DomainRecord(
            'record-1',
            'obs-1',
            timestamp,
            new Map<string, any>([['metric-1', 7.2], ['metric-2', true]]),
        );

        const dialogVisible = (root: any) => findAllByText(root.root, 'Discard changes?').length > 0;

        beforeEach(() => {
            mockGetRecordByIdExecute.mockResolvedValue(existingRecord);
        });

        it('lets an untouched edit form leave with no dialog', async () => {
            const {root, listeners} = await renderScreen({recordId: 'record-1'});

            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });

        it('lets an untouched create form leave with no dialog', async () => {
            const {root, listeners} = await renderScreen();

            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });

        it('lets a form still loading its data leave with no dialog', async () => {
            mockGetObservationByIdExecute.mockReturnValue(new Promise(() => {
            }));

            const {root, listeners} = await renderScreen({recordId: 'record-1'});
            expect(findAllByText(root.root, 'Loading...').length).toBeGreaterThan(0);

            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });

        it('opens the dialog instead of leaving when a value was changed', async () => {
            const {root, listeners} = await renderScreen({recordId: 'record-1'});

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });

        it('opens the dialog instead of leaving when a stored value was cleared', async () => {
            const {root, listeners} = await renderScreen({recordId: 'record-1'});

            // The stored value is `true`, so pressing "Yes" deselects it.
            await pressBooleanSegment(root.root, 'metric-2', true);

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });

        it('opens the dialog instead of leaving when only the timestamp was changed', async () => {
            const {root, listeners} = await renderScreen({recordId: 'record-1'});

            const picker = await openDatePicker(root.root);
            await act(async () => {
                picker.props.onChange({type: 'set'}, new Date(2024, 1, 20));
            });

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });

        it('opens the dialog instead of leaving when anything was entered on the create form', async () => {
            const {root, listeners} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });

        it('leaves with no dialog once a change is undone', async () => {
            const {root, listeners} = await renderScreen({recordId: 'record-1'});

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });
            await act(async () => {
                durationInput.props.onChangeText('7.2');
            });

            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });

        it('closes the dialog, dispatches nothing and keeps the entered value on "Keep editing"', async () => {
            const {root, listeners, dispatch} = await renderScreen({recordId: 'record-1'});

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });
            await leaveScreen(listeners);

            const keepButton = findTouchableWithText(root.root, 'Keep editing');
            await act(async () => {
                keepButton!.props.onPress();
            });

            expect(dialogVisible(root)).toBe(false);
            expect(dispatch).not.toHaveBeenCalled();
            expect(root.root.findByProps({keyboardType: 'numeric'}).props.value).toBe('8');
        });

        it('dispatches exactly the action the event carried on "Discard"', async () => {
            const {root, listeners, dispatch} = await renderScreen({recordId: 'record-1'});
            // Not a plain pop: the user is sent wherever the intercepted route
            // was headed, not to a hardcoded destination.
            const action = {type: 'NAVIGATE', payload: {name: 'ObservationList'}};

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });
            await leaveScreen(listeners, action);

            const discardButton = findTouchableWithText(root.root, 'Discard');
            await act(async () => {
                discardButton!.props.onPress();
            });

            expect(dispatch).toHaveBeenCalledTimes(1);
            expect(dispatch).toHaveBeenCalledWith(action);
            expect(dialogVisible(root)).toBe(false);
            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
        });

        it('leaves after a successful save without opening the dialog', async () => {
            const {root, listeners, onCreated} = await renderScreen({recordId: 'record-1'});

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            const saveButton = findTouchableWithText(root.root, 'Save Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });
            expect(onCreated).toHaveBeenCalledTimes(1);

            // The save's own removal: still dirty against the loaded Record, and
            // it has to pass all the same.
            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });

        it('leaves the next exit intercepted when the save fails', async () => {
            mockUpdateRecordExecute.mockRejectedValue(new Error('Failed to update record'));
            const {root, listeners, onCreated} = await renderScreen({recordId: 'record-1'});

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            const saveButton = findTouchableWithText(root.root, 'Save Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });
            expect(onCreated).not.toHaveBeenCalled();

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });
    });

    describe('record note', () => {
        const timestamp = new Date('2024-01-15T08:15:00');

        const noteField = (root: any) => root.root.findByProps({testID: 'record-note'});

        async function typeNote(root: any, text: string) {
            await act(async () => {
                noteField(root).props.onChangeText(text);
            });
        }

        /** A Record whose values match the form's, so only its note can make it dirty. */
        function storedRecord(note: string | null) {
            return new DomainRecord(
                'record-1',
                'obs-1',
                timestamp,
                new Map<string, any>([['metric-1', 7.2]]),
                note,
            );
        }

        const dialogVisible = (root: any) => findAllByText(root.root, 'Discard changes?').length > 0;

        it('renders after every Metric field', async () => {
            const {root} = await renderScreen();

            expect(root.root.findAllByType('TextInput').map((input: any) => input.props.testID))
                .toEqual(['record-metric-metric-1', 'record-note']);
        });

        it('caps the field at the note length limit and counts towards it', async () => {
            const {root} = await renderScreen();

            expect(noteField(root).props.maxLength).toBe(RECORD_NOTE_MAX_LENGTH);
            expect(noteField(root).props.showCounter).toBe(true);
        });

        it('starts empty on the create route', async () => {
            const {root} = await renderScreen();

            expect(noteField(root).props.value).toBe('');
        });

        it('pre-populates from the loaded Record on the edit route', async () => {
            mockGetRecordByIdExecute.mockResolvedValue(storedRecord('the hotel bed'));

            const {root} = await renderScreen({recordId: 'record-1'});

            expect(noteField(root).props.value).toBe('the hotel bed');
        });

        it('submits the note to the create use case', async () => {
            const {root} = await renderScreen();

            await typeNote(root, 'the hotel bed');
            const saveButton = findTouchableWithText(root.root, 'Add Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockCreateRecordExecute).toHaveBeenCalledWith(
                expect.objectContaining({note: 'the hotel bed'}),
            );
        });

        it('submits a cleared note to the update use case', async () => {
            mockGetRecordByIdExecute.mockResolvedValue(storedRecord('the hotel bed'));
            const {root} = await renderScreen({recordId: 'record-1'});

            await typeNote(root, '');
            const saveButton = findTouchableWithText(root.root, 'Save Record');
            await act(async () => {
                await saveButton!.props.onPress();
            });

            expect(mockUpdateRecordExecute).toHaveBeenCalledWith(
                expect.objectContaining({recordId: 'record-1', note: ''}),
            );
        });

        it('opens the dialog instead of leaving when only the note was changed', async () => {
            mockGetRecordByIdExecute.mockResolvedValue(storedRecord(null));
            const {root, listeners} = await renderScreen({recordId: 'record-1'});

            await typeNote(root, 'the hotel bed');

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });

        it.each([
            ['whose note is empty', null],
            ['carrying a note', 'the hotel bed'],
        ])('lets an untouched Record %s leave with no dialog', async (_kind, note) => {
            mockGetRecordByIdExecute.mockResolvedValue(storedRecord(note));
            const {root, listeners} = await renderScreen({recordId: 'record-1'});

            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });
    });

    // A Metric's description belongs on the form, where a value is chosen - and
    // nowhere else. Both field components carry it, so both types are covered.
    describe('metric descriptions', () => {
        const describedText = new Metric('metric-3', 'Sleep Debt', 'Numeric', null, 'Hours short of your target.');
        const describedBoolean = new Metric('metric-4', 'Napped', 'Boolean', null, 'Any daytime sleep at all.');
        const described = new Observation('obs-1', 'Sleep Quality', [
            describedText,
            describedBoolean,
            durationMetric,
            restedMetric,
        ]);

        // The touchable itself - the testID is also on the component it was passed to.
        const helpButtons = (root: any, metricId: string) =>
            root.root.findAllByProps({
                testID: `record-metric-${metricId}-help`,
                accessibilityRole: 'button',
            });

        beforeEach(() => {
            mockGetObservationByIdExecute.mockResolvedValue(described);
            mockGetRecordByIdExecute.mockResolvedValue(new DomainRecord(
                'record-1',
                'obs-1',
                new Date('2024-01-15T08:15:00'),
                new Map<string, any>([['metric-1', 7.2], ['metric-2', true]]),
            ));
        });

        it.each([
            ['create', undefined],
            ['edit', 'record-1'],
        ])('shows a button only for described Metrics on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            expect(helpButtons(root, 'metric-3').length).toBeGreaterThan(0);
            expect(helpButtons(root, 'metric-4').length).toBeGreaterThan(0);
            expect(helpButtons(root, 'metric-1')).toHaveLength(0);
            expect(helpButtons(root, 'metric-2')).toHaveLength(0);
        });

        it.each([
            ['a text field', 'metric-3', describedText],
            ['a Boolean', 'metric-4', describedBoolean],
        ])('opens %s Metric\'s description in a dialog headed by its name', async (_kind, metricId, metric) => {
            const {root} = await renderScreen();

            await act(async () => {
                helpButtons(root, metricId)[0].props.onPress();
            });

            expect(root.root.findAllByProps({testID: `record-metric-${metricId}-help-dialog`}).length)
                .toBeGreaterThan(0);
            expect(findAllByText(root.root, metric.description!).length).toBeGreaterThan(0);
            expect(findAllByText(root.root, metric.name).length).toBeGreaterThan(1);
        });
    });

    describe('metric units', () => {
        const withUnit = new Metric('metric-11', 'hourly', 'Numeric', {min: 0, max: 100}, null, 'min');
        const withoutUnit = new Metric('metric-12', 'dense', 'Numeric');
        const enumWithout = new Metric('metric-13', 'mood', 'Enum', {allowedValues: ['low', 'high']});
        const united = new Observation('obs-1', 'mixed metrics', [withUnit, withoutUnit, enumWithout]);

        const field = (root: any, metricId: string) =>
            root.root.findByProps({testID: `record-metric-${metricId}`});

        beforeEach(() => {
            mockGetObservationByIdExecute.mockResolvedValue(united);
        });

        it('labels a field with the unit its Metric declares', async () => {
            const {root} = await renderScreen();

            expect(field(root, 'metric-11').props.label).toBe('hourly (min)');
        });

        it('labels a field with the name alone where the Metric declares none', async () => {
            const {root} = await renderScreen();

            expect(field(root, 'metric-12').props.label).toBe('dense');
            expect(field(root, 'metric-13').props.label).toBe('mood');
        });

        it('announces the unit as part of the field a screen reader reaches', async () => {
            const {root} = await renderScreen();

            expect(field(root, 'metric-11').props.accessibilityLabel).toBe('hourly (min) value');
            expect(field(root, 'metric-12').props.accessibilityLabel).toBe('dense value');
        });
    });

    // All four bound shapes on one Observation, so a single form covers each
    // placeholder and each refusal message - and the unbounded Metric proves
    // nothing is enforced where nothing was declared.
    describe('metric bounds', () => {
        const closed = new Metric('metric-5', 'dense', 'Numeric', {min: 0, max: 100});
        const floor = new Metric('metric-6', 'yearly', 'Numeric', {min: 0});
        const ceiling = new Metric('metric-7', 'insufficient', 'Numeric', {max: 100});
        const unbounded = new Metric('metric-8', 'sparse', 'Numeric');
        const bounded = new Observation('obs-1', 'mixed metrics', [closed, floor, ceiling, unbounded]);

        /** Both routes reach the same form - every rule here holds on each. */
        const ROUTES: [string, string | undefined][] = [
            ['create', undefined],
            ['edit', 'record-1'],
        ];

        const field = (root: any, metricId: string) =>
            root.root.findByProps({testID: `record-metric-${metricId}`});

        async function type(root: any, metricId: string, text: string) {
            await act(async () => {
                field(root, metricId).props.onChangeText(text);
            });
        }

        async function save(root: any, recordId?: string) {
            const button = findTouchableWithText(root.root, recordId ? 'Save Record' : 'Add Record');
            await act(async () => {
                await button!.props.onPress();
            });
        }

        beforeEach(() => {
            mockGetObservationByIdExecute.mockResolvedValue(bounded);
            // No stored values, so each route starts from the same empty form.
            mockGetRecordByIdExecute.mockResolvedValue(new DomainRecord(
                'record-1',
                'obs-1',
                new Date('2024-01-15T08:15:00'),
                new Map<string, any>(),
            ));
        });

        it.each(ROUTES)('states each Metric\'s range before anything is typed on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            expect(field(root, 'metric-5').props.placeholder).toBe('0-100');
            expect(field(root, 'metric-6').props.placeholder).toBe('Min 0');
            expect(field(root, 'metric-7').props.placeholder).toBe('Max 100');
            expect(field(root, 'metric-8').props.placeholder).toBeUndefined();
        });

        it.each(ROUTES)('refuses out-of-range values, naming the bound each broke, on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            await type(root, 'metric-5', '150');
            await type(root, 'metric-6', '-1');
            await type(root, 'metric-7', '101');
            await type(root, 'metric-8', '9999');
            await save(root, recordId);

            expect(findAllByText(root.root, 'Must be between 0 and 100').length).toBe(1);
            expect(findAllByText(root.root, 'Must be at least 0').length).toBe(1);
            expect(findAllByText(root.root, 'Must be at most 100').length).toBe(1);
            expect(field(root, 'metric-8').props.error).toBeUndefined();
            expect(mockCreateRecordExecute).not.toHaveBeenCalled();
            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
        });

        it.each(ROUTES)('accepts a value sitting exactly on a bound on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            await type(root, 'metric-5', '100');
            await type(root, 'metric-6', '0');
            await save(root, recordId);

            const execute = recordId ? mockUpdateRecordExecute : mockCreateRecordExecute;
            expect(execute).toHaveBeenCalledWith(expect.objectContaining({
                values: [
                    {metricId: 'metric-5', value: 100},
                    {metricId: 'metric-6', value: 0},
                ],
            }));
        });

        it.each(ROUTES)('reports text that never parsed to a number as an invalid value on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            await type(root, 'metric-5', 'lots');
            await save(root, recordId);

            expect(findAllByText(root.root, 'Invalid value').length).toBe(1);
            expect(findAllByText(root.root, 'Must be between 0 and 100').length).toBe(0);
            expect(mockCreateRecordExecute).not.toHaveBeenCalled();
            expect(mockUpdateRecordExecute).not.toHaveBeenCalled();
        });

        it('leaves an unbounded Metric taking any number, and an empty form raising nothing', async () => {
            const {root} = await renderScreen();

            await type(root, 'metric-8', '9999');
            await save(root);

            expect(mockCreateRecordExecute).toHaveBeenCalledWith(expect.objectContaining({
                values: [{metricId: 'metric-8', value: 9999}],
            }));
        });

        it('creates a Record from an untouched form, where no bound applies', async () => {
            const {root} = await renderScreen();

            await save(root);

            expect(mockCreateRecordExecute).toHaveBeenCalledWith(expect.objectContaining({values: []}));
        });
    });

    // A Text field is the only one whose value can be whitespace and nothing else.
    describe('text metrics', () => {
        const noteMetric = new Metric('metric-10', 'note', 'Text');
        const texts = new Observation('obs-1', 'text only', [noteMetric]);
        const timestamp = new Date('2024-01-15T08:15:00');

        /** Both routes reach the same form - every rule here holds on each. */
        const ROUTES: [string, string | undefined][] = [
            ['create', undefined],
            ['edit', 'record-1'],
        ];

        const field = (root: any) => root.root.findByProps({testID: 'record-metric-metric-10'});

        async function type(root: any, text: string) {
            await act(async () => {
                field(root).props.onChangeText(text);
            });
        }

        async function save(root: any, recordId?: string) {
            const button = findTouchableWithText(root.root, recordId ? 'Save Record' : 'Add Record');
            await act(async () => {
                await button!.props.onPress();
            });
        }

        beforeEach(() => {
            mockGetObservationByIdExecute.mockResolvedValue(texts);
            // No stored values, so each route starts from the same empty form.
            mockGetRecordByIdExecute.mockResolvedValue(new DomainRecord(
                'record-1',
                'obs-1',
                timestamp,
                new Map<string, any>(),
            ));
        });

        it.each(ROUTES)('saves what was written, less the whitespace around it, on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            await type(root, '  slept badly  ');
            await save(root, recordId);

            const execute = recordId ? mockUpdateRecordExecute : mockCreateRecordExecute;
            expect(execute).toHaveBeenCalledWith(expect.objectContaining({
                values: [{metricId: 'metric-10', value: 'slept badly'}],
            }));
        });

        it.each(ROUTES)('saves a field holding whitespace alone as no value at all, on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            await type(root, '   ');
            await save(root, recordId);

            const execute = recordId ? mockUpdateRecordExecute : mockCreateRecordExecute;
            expect(execute).toHaveBeenCalledWith(expect.objectContaining({values: []}));
            expect(findAllByText(root.root, 'Invalid value').length).toBe(0);
        });

        it('leaves without asking when the only thing typed is whitespace', async () => {
            const {root, listeners} = await renderScreen();

            await type(root, '   ');

            expect(await leaveScreen(listeners)).toBe(false);
        });
    });

    // A Choice Metric is picked from a list rather than a row of segments: four
    // values divided across one row leave too little width to read. What is
    // tested here is the rows it offers and the values they report back.
    describe('choice metrics', () => {
        const MOOD_VALUES = ['low', 'ok', 'high'];
        const moodMetric = new Metric('metric-9', 'mood', 'Enum', {allowedValues: MOOD_VALUES});
        const choices = new Observation('obs-1', 'no numeric', [moodMetric, restedMetric]);
        const timestamp = new Date('2024-01-15T08:15:00');

        /** Both routes reach the same form - every rule here holds on each. */
        const ROUTES: [string, string | undefined][] = [
            ['create', undefined],
            ['edit', 'record-1'],
        ];

        /** The touchable itself - the testID is also on the component it was passed to. */
        const field = (root: any) =>
            root.root.findAllByProps({testID: 'record-metric-metric-9', accessibilityRole: 'button'})[0];

        const row = (root: any, key: string) =>
            root.root.findAllByProps({testID: `record-metric-metric-9-${key}`})[0];

        async function openPicker(root: any) {
            await act(async () => {
                field(root).props.onPress();
            });
        }

        /** Opens the picker and taps a row, as choosing a value takes two taps. */
        async function choose(root: any, key: string) {
            await openPicker(root);
            await act(async () => {
                row(root, key).props.onPress();
            });
        }

        /** What the closed field reads - the list is unmounted, so this is the only copy on screen. */
        const shows = (root: any, text: string) => findAllByText(root.root, text).length === 1;

        async function save(root: any, recordId?: string) {
            const button = findTouchableWithText(root.root, recordId ? 'Save Record' : 'Add Record');
            await act(async () => {
                await button!.props.onPress();
            });
        }

        beforeEach(() => {
            mockGetObservationByIdExecute.mockResolvedValue(choices);
            // No stored values, so each route starts from the same empty form.
            mockGetRecordByIdExecute.mockResolvedValue(new DomainRecord(
                'record-1',
                'obs-1',
                timestamp,
                new Map<string, any>(),
            ));
        });

        it.each(ROUTES)('reads as unanswered, over a closed list and no text field, on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            expect(shows(root, 'None')).toBe(true);
            expect(root.root.findAllByProps({testID: 'record-metric-metric-9-low'})).toHaveLength(0);
            expect(root.root.findAllByType('TextInput').map((input: any) => input.props.testID))
                .toEqual(['record-note']);
        });

        it.each(ROUTES)('lists every declared value in order, under the row that means no answer, on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            await openPicker(root);

            const list = root.root.findAllByProps({testID: 'record-metric-metric-9-options'})[0];
            const labels = list
                .findAll((node: any) => node.children?.length === 1 && typeof node.children[0] === 'string')
                .map((node: any) => node.children[0]);
            expect(labels).toEqual(['None', ...MOOD_VALUES]);
        });

        it.each(ROUTES)('reads back the value that was chosen, and saves it, on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            await choose(root, 'high');
            expect(shows(root, 'high')).toBe(true);

            await save(root, recordId);

            const execute = recordId ? mockUpdateRecordExecute : mockCreateRecordExecute;
            expect(execute).toHaveBeenCalledWith(expect.objectContaining({
                values: [{metricId: 'metric-9', value: 'high'}],
            }));
        });

        // "Not answered yet" stays reachable, which is what the clearing row is for.
        it.each(ROUTES)('returns the Metric to unanswered through that row, on the %s route', async (_route, recordId) => {
            const {root} = await renderScreen({recordId});

            await choose(root, 'high');
            await choose(root, 'clear');

            expect(shows(root, 'None')).toBe(true);
            await save(root, recordId);

            const execute = recordId ? mockUpdateRecordExecute : mockCreateRecordExecute;
            expect(execute).toHaveBeenCalledWith(expect.objectContaining({values: []}));
        });

        it('marks the row holding the current value, and the clearing row while there is none', async () => {
            const {root} = await renderScreen();

            await openPicker(root);
            expect(row(root, 'clear').props.accessibilityState.selected).toBe(true);
            expect(row(root, 'high').props.accessibilityState.selected).toBe(false);

            await choose(root, 'high');
            await openPicker(root);
            expect(row(root, 'high').props.accessibilityState.selected).toBe(true);
            expect(row(root, 'clear').props.accessibilityState.selected).toBe(false);
        });

        it('pre-fills from the stored value on the edit route, and saves the one it is changed to', async () => {
            mockGetRecordByIdExecute.mockResolvedValue(new DomainRecord(
                'record-1',
                'obs-1',
                timestamp,
                new Map<string, any>([['metric-9', 'high']]),
            ));

            const {root} = await renderScreen({recordId: 'record-1'});
            expect(shows(root, 'high')).toBe(true);

            await choose(root, 'low');
            await save(root, 'record-1');

            expect(mockUpdateRecordExecute).toHaveBeenCalledWith(expect.objectContaining({
                values: [{metricId: 'metric-9', value: 'low'}],
            }));
        });

        // Two options fit the row, so a Boolean keeps its single-tap segments.
        it('leaves the Boolean Metric beside it on segments', async () => {
            const {root} = await renderScreen();

            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([false, false]);

            await pressBooleanSegment(root.root, 'metric-2', false);

            expect(booleanSelectedStates(root.root, 'metric-2')).toEqual([false, true]);
            expect(shows(root, 'None')).toBe(true);
        });
    });

    // Text delivered in one shot - as every other test here and the Maestro
    // flows deliver it - never reaches the states no number can represent.
    describe('numeric text entry', () => {
        const timestamp = new Date('2024-01-15T08:15:00');
        const storedFraction = new DomainRecord(
            'record-1',
            'obs-1',
            timestamp,
            new Map<string, any>([['metric-1', 0.5]]),
        );

        const field = (root: any) => root.root.findByProps({testID: 'record-metric-metric-1'});

        /** Types `text` one keystroke at a time, returning what the field read back after each. */
        async function typeKeystrokes(root: any, text: string): Promise<string[]> {
            const readBack: string[] = [];
            for (let end = 1; end <= text.length; end++) {
                await act(async () => {
                    field(root).props.onChangeText(text.slice(0, end));
                });
                readBack.push(field(root).props.value);
            }
            return readBack;
        }

        /** What a field holding the text that was typed reads back, keystroke by keystroke. */
        function keystrokes(text: string): string[] {
            return [...text].map((_character, index) => text.slice(0, index + 1));
        }

        async function save(root: any, recordId?: string) {
            const button = findTouchableWithText(root.root, recordId ? 'Save Record' : 'Add Record');
            await act(async () => {
                await button!.props.onPress();
            });
        }

        it.each(['0.5', '.5', '1.50', '12.75'])('reads back every keystroke of %s as it is typed', async text => {
            const {root} = await renderScreen();

            expect(await typeKeystrokes(root, text)).toEqual(keystrokes(text));
        });

        it('saves the number a typed fraction spells', async () => {
            const {root} = await renderScreen();

            await typeKeystrokes(root, '0.5');
            await save(root);

            expect(mockCreateRecordExecute).toHaveBeenCalledWith(expect.objectContaining({
                values: [{metricId: 'metric-1', value: 0.5}],
            }));
        });

        it('saves a value typed with a trailing zero as the number without it', async () => {
            const {root} = await renderScreen();

            await typeKeystrokes(root, '1.50');
            await save(root);

            expect(mockCreateRecordExecute).toHaveBeenCalledWith(expect.objectContaining({
                values: [{metricId: 'metric-1', value: 1.5}],
            }));
        });

        it('refuses a comma-separated fraction rather than saving the number it starts with', async () => {
            const {root} = await renderScreen();

            await typeKeystrokes(root, '0,5');
            await save(root);

            expect(findAllByText(root.root, 'Invalid value').length).toBe(1);
            expect(mockCreateRecordExecute).not.toHaveBeenCalled();
        });

        it('renders a stored fraction as text, leaving an untouched form undirty', async () => {
            mockGetRecordByIdExecute.mockResolvedValue(storedFraction);
            const {root, listeners} = await renderScreen({recordId: 'record-1'});

            expect(field(root).props.value).toBe('0.5');
            expect(await leaveScreen(listeners)).toBe(false);
            expect(findAllByText(root.root, 'Discard changes?').length).toBe(0);
        });

        it('saves a stored fraction back unchanged', async () => {
            mockGetRecordByIdExecute.mockResolvedValue(storedFraction);
            const {root} = await renderScreen({recordId: 'record-1'});

            await save(root, 'record-1');

            expect(mockUpdateRecordExecute).toHaveBeenCalledWith(expect.objectContaining({
                values: [{metricId: 'metric-1', value: 0.5}],
            }));
        });
    });
});
