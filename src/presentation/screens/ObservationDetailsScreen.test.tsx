import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {ObservationDetailsScreen} from './ObservationDetailsScreen';
import {Observation} from '../../domain/Observation';
import {Record as DomainRecord} from '../../domain/Record';

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
        execute: vi.fn().mockResolvedValue({
            id: 'obs-1',
            name: 'Test Observation',
            metrics: [{id: 'm1', name: 'Metric 1', type: 'numeric'}],
        } as unknown as Observation),
    })),
}));

vi.mock('../../application/GetRecentRecordsUseCase', () => ({
    GetRecentRecordsUseCase: vi.fn().mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue([
            {
                id: 'rec-1',
                observationId: 'obs-1',
                timestamp: new Date('2026-07-04T12:00:00Z'),
                values: new Map([['m1', 10]]),
            } as unknown as DomainRecord,
        ]),
    })),
}));

vi.mock('../../application/DeleteObservationUseCase', () => ({
    DeleteObservationUseCase: vi.fn().mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue(undefined),
    })),
}));

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

async function renderScreen() {
    let root: any;
    await act(async () => {
        root = renderer.create(
            <ObservationDetailsScreen
                observationId="obs-1"
                onBack={vi.fn()}
                onCreateRecord={vi.fn()}
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

// --- Tests ---

describe('ObservationDetailsScreen Record Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it('closes the contextual menu when Edit Record is pressed', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);

        const editButton = findTouchableWithText(root.root, 'Edit Record');
        expect(editButton).toBeTruthy();

        await act(async () => {
            editButton!.props.onPress();
        });

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

        const deleteRecordButton = findTouchableWithText(root.root, 'Delete Record');
        await act(async () => {
            deleteRecordButton!.props.onPress();
        });

        // Press Cancel in the confirmation modal
        const cancelButton = findTouchableWithText(root.root, 'Cancel');
        expect(cancelButton).toBeTruthy();

        await act(async () => {
            cancelButton!.props.onPress();
        });

        // Confirmation modal should be dismissed
        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBe(0);
    });

    it('dismisses the delete confirmation modal when Delete is pressed', async () => {
        const root = await renderScreen();
        await openRecordMenu(root);

        const deleteRecordButton = findTouchableWithText(root.root, 'Delete Record');
        await act(async () => {
            deleteRecordButton!.props.onPress();
        });

        // Press Delete in the confirmation modal
        const deleteConfirmButton = findTouchableWithText(root.root, 'Delete');
        expect(deleteConfirmButton).toBeTruthy();

        await act(async () => {
            deleteConfirmButton!.props.onPress();
        });

        // Confirmation modal should be dismissed
        const confirmTitle = findAllByText(root.root, 'Delete this record?');
        expect(confirmTitle.length).toBe(0);
    });
});
