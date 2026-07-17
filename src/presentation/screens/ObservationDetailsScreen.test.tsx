import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {ObservationDetailsScreen} from './ObservationDetailsScreen';
import {Observation} from '../../domain/Observation';
import {Record as DomainRecord} from '../../domain/Record';
import {NUMERIC_TREND_INSUFFICIENT_MESSAGE} from '../charts/chartDefaults';

const DAY_MS = 24 * 60 * 60 * 1000;

const defaultObservation = {
    id: 'obs-1',
    name: 'Test Observation',
    metrics: [{id: 'm1', name: 'Metric 1', type: 'numeric'}],
} as unknown as Observation;

const {
    mockGetObservationByIdExecute,
    mockGetRecentRecordsExecute,
    mockGetRecordsByTimeRangeExecute,
    mockDeleteRecordExecute,
} = vi.hoisted(() => {
    return {
        mockGetObservationByIdExecute: vi.fn(),
        mockGetRecentRecordsExecute: vi.fn(),
        mockGetRecordsByTimeRangeExecute: vi.fn(),
        mockDeleteRecordExecute: vi.fn(),
    };
});

vi.mock('react-native', () => {
    const RN = require('react-native-web');
    RN.Modal = ({children, visible}: any) =>
        visible ? <RN.View testID="modal">{children}</RN.View> : null;
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

vi.mock('../../application/GetRecentRecordsUseCase', () => ({
    GetRecentRecordsUseCase: vi.fn().mockImplementation(() => ({
        execute: mockGetRecentRecordsExecute,
    })),
}));

vi.mock('../../application/GetRecordsByTimeRangeUseCase', () => ({
    GetRecordsByTimeRangeUseCase: vi.fn().mockImplementation(() => ({
        execute: mockGetRecordsByTimeRangeExecute,
    })),
}));

vi.mock('../../application/DeleteObservationUseCase', () => ({
    DeleteObservationUseCase: vi.fn().mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('../../application/DeleteRecordUseCase', () => ({
    DeleteRecordUseCase: vi.fn().mockImplementation(() => ({
        execute: mockDeleteRecordExecute,
    })),
}));

const initialRecord = {
    id: 'rec-1',
    observationId: 'obs-1',
    timestamp: new Date('2026-07-04T12:00:00Z'),
    values: new Map([['m1', 10]]),
} as unknown as DomainRecord;

// --- Helpers ---

function findAllByText(root: any, text: string) {
    return root.findAll(
        (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
    );
}

function findRecordHeader(root: any) {
    const touchables = root.findAllByProps({activeOpacity: 0.7});
    return touchables.find((t: any) => t.props.onLongPress);
}

function countRecordCards(root: any) {
    return root.findAllByProps({name: 'schedule'}).length;
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

async function renderScreen(onEditRecord: (recordId: string) => void = vi.fn()) {
    let root: any;
    await act(async () => {
        root = renderer.create(
            <ObservationDetailsScreen
                observationId="obs-1"
                onBack={vi.fn()}
                onCreateRecord={vi.fn()}
                onEditRecord={onEditRecord}
                onDeleted={vi.fn()}
            />,
        );
    });
    return root!;
}

async function openRecordMenu(root: any) {
    const recordHeader = findRecordHeader(root.root);
    expect(recordHeader).toBeTruthy();
    await act(async () => {
        recordHeader.props.onLongPress();
    });
    return recordHeader;
}

async function openDeleteRecordConfirmation(root: any) {
    const deleteRecordButton = findTouchableWithText(root.root, 'Delete Record');
    await act(async () => {
        deleteRecordButton!.props.onPress();
    });
}

// --- Tests ---

describe('ObservationDetailsScreen Record Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(defaultObservation);
        mockGetRecentRecordsExecute.mockResolvedValue([initialRecord]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
        mockDeleteRecordExecute.mockResolvedValue(undefined);
        vi.stubGlobal('alert', vi.fn());
    });

    it('opens the contextual menu on long press', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);

        // The contextual menu should now be visible with the title and timestamp
        const titles = findAllByText(root.root, 'Record actions');
        expect(titles.length).toBeGreaterThan(0);

        const editButtons = findAllByText(root.root, 'Edit Record');
        expect(editButtons.length).toBeGreaterThan(0);

        const deleteButtons = findAllByText(root.root, 'Delete Record');
        expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('dismisses the contextual menu when Cancel is pressed', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);

        // Find and press the Cancel button inside the contextual menu
        const cancelButton = findTouchableWithText(root.root, 'Cancel');
        expect(cancelButton).toBeTruthy();

        await act(async () => {
            cancelButton!.props.onPress();
        });

        // "Record actions" title should no longer be visible
        const titles = findAllByText(root.root, 'Record actions');
        expect(titles.length).toBe(0);
    });

    it('navigates to edit and closes the contextual menu when Edit Record is pressed', async () => {
        const onEditRecord = vi.fn();
        const root = await renderScreen(onEditRecord);
        await openRecordMenu(root);

        const editButton = findTouchableWithText(root.root, 'Edit Record');
        expect(editButton).toBeTruthy();

        await act(async () => {
            editButton!.props.onPress();
        });

        expect(onEditRecord).toHaveBeenCalledWith('rec-1');

        // Menu should be dismissed
        const titles = findAllByText(root.root, 'Record actions');
        expect(titles.length).toBe(0);
    });

    it('opens delete confirmation modal when Delete Record is pressed', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);

        const deleteRecordButton = findTouchableWithText(root.root, 'Delete Record');
        expect(deleteRecordButton).toBeTruthy();

        await act(async () => {
            deleteRecordButton!.props.onPress();
        });

        // Contextual menu should be closed
        const menuTitles = findAllByText(root.root, 'Record actions');
        expect(menuTitles.length).toBe(0);

        // Confirmation modal should be open
        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBeGreaterThan(0);

        const confirmBody = findAllByText(root.root, 'This specific entry will be permanently removed.');
        expect(confirmBody.length).toBeGreaterThan(0);
    });

    it('dismisses the delete confirmation modal when Cancel is pressed', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);

        // Press Cancel in the confirmation modal
        const cancelButton = findTouchableWithText(root.root, 'Cancel');
        expect(cancelButton).toBeTruthy();

        await act(async () => {
            cancelButton!.props.onPress();
        });

        // Confirmation modal should be dismissed
        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBe(0);

        // Nothing should have been deleted
        expect(mockDeleteRecordExecute).not.toHaveBeenCalled();
    });

    it('deletes the record, closes the confirmation modal, and refreshes the record list', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);

        // Queued after the initial load so it is only returned by the post-delete refresh
        const olderRecord = {
            id: 'rec-2',
            observationId: 'obs-1',
            timestamp: new Date('2026-07-01T09:00:00Z'),
            values: new Map([['m1', 5]]),
        } as unknown as DomainRecord;
        mockGetRecentRecordsExecute.mockResolvedValueOnce([olderRecord]);

        const deleteConfirmButton = findTouchableWithText(root.root, 'Delete');
        expect(deleteConfirmButton).toBeTruthy();

        await act(async () => {
            await deleteConfirmButton!.props.onPress();
        });

        // The correct record was deleted
        expect(mockDeleteRecordExecute).toHaveBeenCalledWith('rec-1');

        // Confirmation modal should be dismissed
        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBe(0);

        // The record list was refreshed from the data source
        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(2);

        // The replacement record loaded during refresh is now displayed
        expect(countRecordCards(root.root)).toBe(1);
    });

    it('displays the empty state after deleting the final record', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);

        // Queued after the initial load so the refresh reports no remaining records
        mockGetRecentRecordsExecute.mockResolvedValueOnce([]);

        const deleteConfirmButton = findTouchableWithText(root.root, 'Delete');
        await act(async () => {
            await deleteConfirmButton!.props.onPress();
        });

        expect(countRecordCards(root.root)).toBe(0);
        const emptyState = findAllByText(root.root, 'No records yet.');
        expect(emptyState.length).toBeGreaterThan(0);
    });

    it('keeps the record and shows an error message when deletion fails', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);
        await openDeleteRecordConfirmation(root);

        mockDeleteRecordExecute.mockRejectedValueOnce(new Error('Deletion failed'));

        const deleteConfirmButton = findTouchableWithText(root.root, 'Delete');
        await act(async () => {
            await deleteConfirmButton!.props.onPress();
        });

        // The confirmation modal remains open since deletion failed
        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBeGreaterThan(0);

        // The record was not removed from the displayed list
        expect(countRecordCards(root.root)).toBe(1);

        // The list was not refreshed since deletion did not succeed
        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(1);

        // A meaningful error message was surfaced to the user
        expect(globalThis.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to delete record'));
    });
});

describe('ObservationDetailsScreen Trends', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetObservationByIdExecute.mockResolvedValue(defaultObservation);
        mockGetRecentRecordsExecute.mockResolvedValue([]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([]);
        vi.stubGlobal('alert', vi.fn());
    });

    function numericObservation(...metrics: {id: string; name: string}[]): Observation {
        return {
            id: 'obs-1',
            name: 'Sleep Quality',
            metrics: metrics.map(m => ({...m, type: 'Numeric'})),
        } as unknown as Observation;
    }

    function chartRecord(id: string, daysAgo: number, values: [string, number][]): DomainRecord {
        return new DomainRecord(id, 'obs-1', new Date(Date.now() - daysAgo * DAY_MS), new Map(values));
    }

    it('renders one chart per Numeric Metric', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(
            numericObservation({id: 'm1', name: 'Duration'}, {id: 'm2', name: 'Quality'}),
        );
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['m1', 5], ['m2', 50]]),
            chartRecord('b', 1, [['m1', 7], ['m2', 55]]),
        ]);

        const root = await renderScreen();

        expect(findAllByText(root.root, 'TRENDS').length).toBeGreaterThan(0);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(2);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(0);
    });

    it('omits the TRENDS section when there are no Numeric Metrics', async () => {
        mockGetObservationByIdExecute.mockResolvedValue({
            id: 'obs-1',
            name: 'Journal',
            metrics: [
                {id: 't1', name: 'Notes', type: 'Text'},
                {id: 'b1', name: 'Done', type: 'Boolean'},
            ],
        } as unknown as Observation);

        const root = await renderScreen();

        expect(findAllByText(root.root, 'TRENDS').length).toBe(0);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(0);
    });

    it('shows the insufficient-data message for a Metric with fewer than two points', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 1, [['m1', 5]]),
        ]);

        const root = await renderScreen();

        expect(findAllByText(root.root, NUMERIC_TREND_INSUFFICIENT_MESSAGE).length).toBeGreaterThan(0);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(0);
        expect(root.root.findAllByProps({testID: 'trend-empty'}).length).toBe(1);
    });

    it('opens the record behind a tapped chart point via onEditRecord', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        // Same value in both records so the series is flat (points sit at the
        // canvas mid-line), keeping the tap's vertical hit-test independent of the
        // chart's unmeasured width in the test renderer.
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('earliest', 3, [['m1', 5]]),
            chartRecord('latest', 1, [['m1', 5]]),
        ]);
        const onEditRecord = vi.fn();

        const root = await renderScreen(onEditRecord);

        const pressable = root.root.findByProps({testID: 'numeric-trend-chart-pressable'});
        await act(async () => {
            // 45 is the mid-line of the 90px trend chart, where a flat series sits.
            pressable.props.onPress({nativeEvent: {locationX: 0, locationY: 45}});
        });

        expect(onEditRecord).toHaveBeenCalledWith('earliest');
    });

    it('renders the RECENT RECORDS section independently of the trends data fetch', async () => {
        mockGetObservationByIdExecute.mockResolvedValue(numericObservation({id: 'm1', name: 'Duration'}));
        mockGetRecentRecordsExecute.mockResolvedValue([initialRecord]);
        mockGetRecordsByTimeRangeExecute.mockResolvedValue([
            chartRecord('a', 3, [['m1', 5]]),
            chartRecord('b', 1, [['m1', 7]]),
        ]);

        const root = await renderScreen();

        // Recent records renders its own record card from its own fetch...
        expect(countRecordCards(root.root)).toBe(1);
        expect(mockGetRecentRecordsExecute).toHaveBeenCalledTimes(1);
        // ...while the trend chart is populated from a separate range-scoped fetch.
        expect(mockGetRecordsByTimeRangeExecute).toHaveBeenCalledTimes(1);
        expect(root.root.findAllByProps({testID: 'trend-chart'}).length).toBe(1);
    });
});
