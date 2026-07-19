import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {RecordFormScreen} from './RecordFormScreen';
import {Observation} from '../../domain/Observation';
import {Metric} from '../../domain/Metric';
import {Record as DomainRecord} from '../../domain/Record';

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
    // react-native-web's real TextInput/Switch touch `document` on mount, which isn't
    // available under the node test environment; stub them as plain host nodes so
    // their props (value, onChangeText, onValueChange, ...) remain inspectable.
    RN.TextInput = 'TextInput';
    RN.Switch = 'Switch';
    return RN;
});
vi.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
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
        it('renders with empty inputs and the "Add Record" label, with no timestamp or cross button', async () => {
            const {root} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            expect(durationInput.props.value).toBe('');

            expect(findAllByText(root.root, 'Add Record').length).toBeGreaterThan(0);
            expect(findAllByText(root.root, 'Save Record').length).toBe(0);
            expect(root.root.findAllByProps({name: 'close'}).length).toBe(0);

            expect(mockGetRecordByIdExecute).not.toHaveBeenCalled();
        });

        it('creates a record and calls onCreated without touching UpdateRecordUseCase', async () => {
            const {root, onCreated} = await renderScreen();

            const durationInput = root.root.findByProps({keyboardType: 'numeric'});
            await act(async () => {
                durationInput.props.onChangeText('8');
            });

            const restedSwitch = root.root.findByType('Switch');
            await act(async () => {
                restedSwitch.props.onValueChange(true);
            });

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

        it('displays the observation title, metrics, and a read-only timestamp', async () => {
            const {root} = await renderScreen({recordId: 'record-1'});

            expect(findAllByText(root.root, 'Sleep Quality').length).toBeGreaterThan(0);
            expect(findAllByText(root.root, 'Duration').length).toBeGreaterThan(0);
            expect(findAllByText(root.root, 'Well Rested').length).toBeGreaterThan(0);

            expect(findTextContaining(root.root, 'Jan').length).toBeGreaterThan(0);

            expect(findAllByText(root.root, 'Save Record').length).toBeGreaterThan(0);
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

        it('saves changes via UpdateRecordUseCase, preserving the record id, then calls onCreated', async () => {
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
                values: [
                    {metricId: 'metric-1', value: 8},
                    {metricId: 'metric-2', value: true},
                ],
            });
            expect(mockCreateRecordExecute).not.toHaveBeenCalled();
            expect(onCreated).toHaveBeenCalledTimes(1);
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
