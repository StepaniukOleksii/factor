import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import {EditObservationScreen} from './EditObservationScreen';
import {Observation} from '../../domain/Observation';
import {Metric} from '../../domain/Metric';
import {OBSERVATION_DESCRIPTION_MAX_LENGTH} from '../../domain/validationLimits';

const {mockUpdateObservationExecute, mockFindAll} = vi.hoisted(() => {
    return {mockUpdateObservationExecute: vi.fn(), mockFindAll: vi.fn()};
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

vi.mock('../../infrastructure/SQLiteObservationRepository', () => ({
    SQLiteObservationRepository: vi.fn().mockImplementation(() => ({
        findAll: mockFindAll,
    })),
}));
vi.mock('../../application/UpdateObservationUseCase', () => ({
    UpdateObservationUseCase: vi.fn().mockImplementation(() => ({
        execute: mockUpdateObservationExecute,
    })),
}));

/** The subject every case edits, with a description and Metrics that must stay off the form. */
const SUBJECT = new Observation(
    'obs-1',
    'stale records',
    [new Metric('metric-1', 'value', 'Numeric'), new Metric('metric-2', 'mood', 'Text')],
    'Four records, all of them old.',
);

/** A second Observation, so there is a name to collide against. */
const OTHER = new Observation('obs-2', 'no records', [new Metric('metric-3', 'value', 'Numeric')]);

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

/**
 * The screen takes its Observation from the route and leaves through the stack,
 * so both are faked here. `addListener` records the screen's `beforeRemove`
 * listener, which is how every exit reaches it once one is registered.
 */
async function renderScreen(observationId = 'obs-1') {
    const goBack = vi.fn();
    const dispatch = vi.fn();
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
            <EditObservationScreen
                route={{name: 'EditObservation', params: {observationId}} as any}
                navigation={{goBack, dispatch, addListener} as any}
            />,
        );
    });
    return {root: root!, goBack, dispatch, listeners};
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

/** The form fields captioned `label`, which only `LabeledTextField` carries. */
function fieldByLabel(root: any, label: string) {
    return root.root.findAllByProps({label})[0];
}

async function typeInto(root: any, label: string, text: string) {
    await act(async () => {
        fieldByLabel(root, label).props.onChangeText(text);
    });
}

async function saveObservation(root: any) {
    await act(async () => {
        await findTouchableWithText(root.root, 'Save Observation')!.props.onPress();
    });
}

/** Whether the screen has `message` on it anywhere, as the user would read it. */
function shows(root: any, message: string) {
    return findAllByText(root.root, message).length > 0;
}

describe('EditObservationScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdateObservationExecute.mockResolvedValue(undefined);
        mockFindAll.mockResolvedValue([SUBJECT, OTHER]);
        vi.spyOn(Alert, 'alert').mockImplementation(() => {
        });
    });

    it('pre-fills both fields from the stored Observation', async () => {
        const {root} = await renderScreen();

        expect(fieldByLabel(root, 'OBSERVATION NAME').props.value).toBe('stale records');
        expect(fieldByLabel(root, 'DESCRIPTION').props.value).toBe('Four records, all of them old.');
    });

    it('leaves the description empty for an Observation stored without one', async () => {
        mockFindAll.mockResolvedValue([OTHER]);

        const {root} = await renderScreen('obs-2');

        expect(fieldByLabel(root, 'DESCRIPTION').props.value).toBe('');
    });

    // Metric editing stays out of reach: the Observation carries two, and
    // neither the name nor the type of either is on the form.
    it('renders no Metric editor', async () => {
        const {root} = await renderScreen();

        expect(root.root.findAllByProps({label: 'METRIC NAME'})).toHaveLength(0);
        expect(shows(root, 'value')).toBe(false);
        expect(shows(root, 'mood')).toBe(false);
    });

    describe('marks', () => {
        it('marks nothing until a save has been attempted', async () => {
            const {root} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', '');

            expect(shows(root, 'Observation name cannot be empty')).toBe(false);
        });

        it('marks the name after a save attempt, and does not save', async () => {
            const {root, goBack} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', '   ');
            await saveObservation(root);

            expect(fieldByLabel(root, 'OBSERVATION NAME').props.error)
                .toBe('Observation name cannot be empty');
            expect(mockUpdateObservationExecute).not.toHaveBeenCalled();
            expect(goBack).not.toHaveBeenCalled();
        });

        it('clears the mark as the field is corrected', async () => {
            const {root} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', '');
            await saveObservation(root);
            await typeInto(root, 'OBSERVATION NAME', 'renamed');

            expect(shows(root, 'Observation name cannot be empty')).toBe(false);
        });

        it('marks a name another Observation already holds', async () => {
            const {root} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', 'NO RECORDS');
            await saveObservation(root);

            expect(fieldByLabel(root, 'OBSERVATION NAME').props.error)
                .toBe('An observation with this name already exists');
            expect(mockUpdateObservationExecute).not.toHaveBeenCalled();
        });

        // Only a writer bypassing the app can store one, and the form judges what
        // it holds rather than what was typed - so the save waits for it to be
        // shortened rather than writing back a value it has called too long.
        it('marks a stored description longer than the limit', async () => {
            const overLong = 'a'.repeat(OBSERVATION_DESCRIPTION_MAX_LENGTH + 1);
            mockFindAll.mockResolvedValue([
                new Observation('obs-1', 'mixed metrics', [], overLong),
            ]);
            const {root} = await renderScreen();

            await saveObservation(root);

            expect(fieldByLabel(root, 'DESCRIPTION').props.error)
                .toBe('Observation description cannot exceed 150 characters');
            expect(mockUpdateObservationExecute).not.toHaveBeenCalled();
        });
    });

    describe('saving', () => {
        it('writes the edited name and description through the use case, then pops', async () => {
            const {root, goBack} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', 'renamed');
            await typeInto(root, 'DESCRIPTION', 'A new purpose.');
            await saveObservation(root);

            expect(mockUpdateObservationExecute).toHaveBeenCalledWith({
                observationId: 'obs-1',
                name: 'renamed',
                description: 'A new purpose.',
            });
            expect(goBack).toHaveBeenCalled();
        });

        it('accepts the Observation\'s own name cased differently', async () => {
            const {root, goBack} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', 'Stale Records');
            await saveObservation(root);

            expect(mockUpdateObservationExecute).toHaveBeenCalledTimes(1);
            expect(goBack).toHaveBeenCalled();
        });

        // The dialog keeps the one job no field can do: the form passed the rules
        // and the write failed anyway.
        it('raises a dialog and stays open when the write fails', async () => {
            mockUpdateObservationExecute.mockRejectedValue(new Error('Observation not found'));
            const {root, goBack} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', 'renamed');
            await saveObservation(root);

            expect(Alert.alert).toHaveBeenCalledWith('Error', 'Observation not found');
            expect(goBack).not.toHaveBeenCalled();
        });
    });

    describe('states', () => {
        it('shows a spinner while the load is in flight', async () => {
            mockFindAll.mockReturnValue(new Promise(() => {
            }));

            const {root} = await renderScreen();

            expect(shows(root, 'Loading...')).toBe(true);
        });

        it('reports an Observation that is gone as Not found', async () => {
            mockFindAll.mockResolvedValue([OTHER]);

            const {root} = await renderScreen();

            expect(shows(root, 'Not found')).toBe(true);
            expect(shows(root, 'Observation not found.')).toBe(true);
        });
    });

    // Every route off the form - the header arrow, the cross button, Android's
    // back button and the system back gesture - is one route removal, so the
    // `beforeRemove` listener stands in for all four.
    describe('unsaved changes confirmation', () => {
        const dialogVisible = (root: any) => findAllByText(root.root, 'Discard changes?').length > 0;

        it('lets an untouched form leave with no dialog', async () => {
            const {root, listeners} = await renderScreen();

            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });

        it.each([['name', 'OBSERVATION NAME'], ['description', 'DESCRIPTION']])(
            'opens the dialog instead of leaving when the %s was changed',
            async (_field, label) => {
                const {root, listeners} = await renderScreen();

                await typeInto(root, label, 'something else');

                expect(await leaveScreen(listeners)).toBe(true);
                expect(dialogVisible(root)).toBe(true);
            },
        );

        // Trimmed on both sides: whitespace the save would drop is not a change.
        it('lets a name padded with whitespace leave with no dialog', async () => {
            const {root, listeners} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', '  stale records  ');

            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });

        it('closes the dialog, dispatches nothing and keeps the edit on "Keep editing"', async () => {
            const {root, listeners, dispatch} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', 'renamed');
            await leaveScreen(listeners);

            await act(async () => {
                findTouchableWithText(root.root, 'Keep editing')!.props.onPress();
            });

            expect(dialogVisible(root)).toBe(false);
            expect(dispatch).not.toHaveBeenCalled();
            expect(fieldByLabel(root, 'OBSERVATION NAME').props.value).toBe('renamed');
        });

        it('dispatches exactly the action the event carried on "Discard"', async () => {
            const {root, listeners, dispatch} = await renderScreen();
            // Not a plain pop: the user is sent wherever the intercepted route
            // was headed, not to a hardcoded destination.
            const action = {type: 'NAVIGATE', payload: {name: 'ObservationList'}};

            await typeInto(root, 'OBSERVATION NAME', 'renamed');
            await leaveScreen(listeners, action);

            await act(async () => {
                findTouchableWithText(root.root, 'Discard')!.props.onPress();
            });

            expect(dispatch).toHaveBeenCalledWith(action);
            expect(mockUpdateObservationExecute).not.toHaveBeenCalled();
        });

        it('leaves after a successful save without opening the dialog', async () => {
            const {root, listeners, goBack} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', 'renamed');
            await saveObservation(root);
            expect(goBack).toHaveBeenCalledTimes(1);

            // The save's own removal: still dirty against the loaded
            // Observation, and it has to pass all the same.
            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });

        it('leaves the next exit intercepted when the save fails', async () => {
            mockUpdateObservationExecute.mockRejectedValue(new Error('Database is locked'));
            const {root, listeners} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', 'renamed');
            await saveObservation(root);

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });
    });
});
