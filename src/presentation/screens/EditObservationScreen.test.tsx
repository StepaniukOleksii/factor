import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import {EditObservationScreen} from './EditObservationScreen';
import {Observation} from '../../domain/Observation';
import {Metric} from '../../domain/Metric';
import {OBSERVATION_DESCRIPTION_MAX_LENGTH} from '../../domain/validationLimits';

const {mockUpdateObservationExecute, mockFindAll, mockCountMetricValues} = vi.hoisted(() => {
    return {mockUpdateObservationExecute: vi.fn(), mockFindAll: vi.fn(), mockCountMetricValues: vi.fn()};
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
vi.mock('../../infrastructure/SQLiteRecordRepository', () => ({
    SQLiteRecordRepository: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('../../application/UpdateObservationUseCase', () => ({
    UpdateObservationUseCase: vi.fn().mockImplementation(() => ({
        execute: mockUpdateObservationExecute,
    })),
}));
vi.mock('../../application/CountMetricValuesUseCase', () => ({
    CountMetricValuesUseCase: vi.fn().mockImplementation(() => ({
        execute: mockCountMetricValues,
    })),
}));

/**
 * The subject every case edits: a description, and a Metric of each shape a
 * stored card states rather than offers - a bounded Numeric, an unbounded one,
 * and a Choice.
 */
const SUBJECT = new Observation(
    'obs-1',
    'stale records',
    [
        new Metric('metric-1', 'value', 'Numeric', {min: 0, max: 10}, 'What was measured.'),
        new Metric('metric-2', 'span', 'Numeric'),
        new Metric('metric-3', 'mood', 'Enum', {allowedValues: ['low', 'ok', 'high']}),
    ],
    'Four records, all of them old.',
);

/** The card an added Metric renders in, the three stored ones coming before it. */
const ADDED = 3;

/** A second Observation, so there is a name to collide against. */
const OTHER = new Observation('obs-2', 'no records', [new Metric('metric-9', 'value', 'Numeric')]);

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

/** The form fields captioned `label`, in screen order. */
function fieldsByLabel(root: any, label: string) {
    return root.root.findAllByProps({label});
}

function fieldByLabel(root: any, label: string) {
    return fieldsByLabel(root, label)[0];
}

async function typeInto(root: any, label: string, text: string) {
    await act(async () => {
        fieldByLabel(root, label).props.onChangeText(text);
    });
}

function hasTestID(root: any, testID: string) {
    return root.root.findAllByProps({testID}).length > 0;
}

async function nameMetric(root: any, name: string, index: number) {
    await act(async () => {
        fieldsByLabel(root, 'METRIC NAME')[index].props.onChangeText(name);
    });
}

async function addMetric(root: any) {
    await act(async () => {
        findTouchableWithText(root.root, 'Add Metric')!.props.onPress();
    });
}

/** Taps the bin on the card the label names, as a user does. */
async function removeMetric(root: any, label: string) {
    await act(async () => {
        root.root.findAllByProps({accessibilityLabel: label})[0].props.onPress();
    });
}

/** Taps a move arrow on the card the label names, as a user does. */
async function moveMetric(root: any, label: string) {
    await act(async () => {
        root.root.findAllByProps({accessibilityLabel: label})[0].props.onPress();
    });
}

async function pressDialogAction(root: any, label: string) {
    await act(async () => {
        await findTouchableWithText(root.root, label)!.props.onPress();
    });
}

function metricNames(root: any): string[] {
    return fieldsByLabel(root, 'METRIC NAME').map((field: any) => field.props.value);
}

async function saveObservation(root: any) {
    await act(async () => {
        await findTouchableWithText(root.root, 'Save Observation')!.props.onPress();
    });
}

function shows(root: any, message: string) {
    return findAllByText(root.root, message).length > 0;
}

describe('EditObservationScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdateObservationExecute.mockResolvedValue(undefined);
        mockCountMetricValues.mockResolvedValue(1);
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

    describe('metrics', () => {
        it('renders a card per stored Metric, in declaration order', async () => {
            const {root} = await renderScreen();

            expect(metricNames(root)).toEqual(['value', 'span', 'mood']);
        });

        it('pre-fills a stored Metric\'s description', async () => {
            const {root} = await renderScreen();

            expect(fieldsByLabel(root, 'DESCRIPTION')[1].props.value).toBe('What was measured.');
        });

        it('states a stored Metric\'s type rather than offering the picker', async () => {
            const {root} = await renderScreen();

            expect(hasTestID(root, 'metric-type-locked-0')).toBe(true);
            expect(hasTestID(root, 'metric-type-0')).toBe(false);
            expect(shows(root, 'Choice')).toBe(true);
        });

        it('states a bounded Metric\'s range, and nothing at all for an unbounded one', async () => {
            const {root} = await renderScreen();

            expect(shows(root, '0-10')).toBe(true);
            expect(hasTestID(root, 'metric-range-locked-1')).toBe(false);
            expect(hasTestID(root, 'metric-min-0')).toBe(false);
        });

        it('states a Choice Metric\'s values in declaration order, with no row to edit', async () => {
            const {root} = await renderScreen();

            expect(shows(root, 'low, ok, high')).toBe(true);
            expect(hasTestID(root, 'metric-value-2-0')).toBe(false);
        });

        it('offers a way to take a stored Metric off the form', async () => {
            const {root} = await renderScreen();

            expect(root.root.findAllByProps({accessibilityLabel: 'Remove metric value'}))
                .not.toHaveLength(0);
        });

        it('offers none while the form holds a single card', async () => {
            mockFindAll.mockResolvedValue([OTHER]);

            const {root} = await renderScreen('obs-2');

            expect(root.root.findAllByProps({accessibilityLabel: 'Remove metric value'}))
                .toHaveLength(0);
        });

        it('adds a card offering the whole editor, and a way to take it back off', async () => {
            const {root} = await renderScreen();

            await addMetric(root);

            expect(fieldsByLabel(root, 'METRIC NAME')).toHaveLength(4);
            expect(hasTestID(root, `metric-type-${ADDED}`)).toBe(true);
            expect(hasTestID(root, `metric-min-${ADDED}`)).toBe(true);
            expect(root.root.findAllByProps({accessibilityLabel: `Remove metric ${ADDED + 1}`}))
                .not.toHaveLength(0);
        });

        it('takes an added card back off again', async () => {
            const {root} = await renderScreen();

            await addMetric(root);
            await act(async () => {
                root.root.findAllByProps({accessibilityLabel: `Remove metric ${ADDED + 1}`})[0]
                    .props.onPress();
            });

            expect(fieldsByLabel(root, 'METRIC NAME')).toHaveLength(3);
        });

        it('marks a duplicate name on the added card rather than on the stored one', async () => {
            const {root} = await renderScreen();

            await addMetric(root);
            await nameMetric(root, 'value', ADDED);
            await saveObservation(root);

            expect(fieldsByLabel(root, 'METRIC NAME')[ADDED].props.error).toBe('Metric names must be unique');
            expect(fieldsByLabel(root, 'METRIC NAME')[0].props.error).toBeUndefined();
            expect(mockUpdateObservationExecute).not.toHaveBeenCalled();
        });

        it('submits every stored Metric under its own id, and an added one under none', async () => {
            const {root} = await renderScreen();

            await addMetric(root);
            await nameMetric(root, 'caffeine', ADDED);
            await saveObservation(root);

            const submitted = mockUpdateObservationExecute.mock.calls[0][0].metrics;
            expect(submitted.map((metric: any) => [metric.id, metric.name])).toEqual([
                ['metric-1', 'value'],
                ['metric-2', 'span'],
                ['metric-3', 'mood'],
                [undefined, 'caffeine'],
            ]);
        });

        it('submits a renamed Metric under the id it already had', async () => {
            const {root} = await renderScreen();

            await nameMetric(root, 'reading', 0);
            await saveObservation(root);

            expect(mockUpdateObservationExecute.mock.calls[0][0].metrics[0])
                .toMatchObject({id: 'metric-1', name: 'reading', type: 'Numeric'});
        });
    });

    describe('removing a stored Metric', () => {
        const REMOVE_VALUE = 'Remove metric value';
        const PROMPT = '“value” will be removed, along with 1 recorded value. '
            + 'This cannot be undone.';

        it('takes the card off the form and writes nothing', async () => {
            const {root} = await renderScreen();

            await removeMetric(root, REMOVE_VALUE);

            expect(metricNames(root)).toEqual(['span', 'mood']);
            expect(mockUpdateObservationExecute).not.toHaveBeenCalled();
        });

        it('asks before writing, naming the Metric and what goes with it', async () => {
            const {root} = await renderScreen();

            await removeMetric(root, REMOVE_VALUE);
            await saveObservation(root);

            expect(mockCountMetricValues).toHaveBeenCalledWith(['metric-1']);
            expect(shows(root, 'Delete metric?')).toBe(true);
            expect(shows(root, PROMPT)).toBe(true);
            expect(mockUpdateObservationExecute).not.toHaveBeenCalled();
        });

        it('writes nothing and keeps the form as it was on Cancel', async () => {
            const {root} = await renderScreen();

            await removeMetric(root, REMOVE_VALUE);
            await nameMetric(root, 'duration', 0);
            await saveObservation(root);
            await pressDialogAction(root, 'Cancel');

            expect(shows(root, 'Delete metric?')).toBe(false);
            expect(metricNames(root)).toEqual(['duration', 'mood']);
            expect(mockUpdateObservationExecute).not.toHaveBeenCalled();
        });

        it('writes the Metrics the form still holds, once, on Delete', async () => {
            const {root, goBack} = await renderScreen();

            await removeMetric(root, REMOVE_VALUE);
            await saveObservation(root);
            await pressDialogAction(root, 'Delete');

            expect(mockUpdateObservationExecute).toHaveBeenCalledTimes(1);
            expect(mockUpdateObservationExecute.mock.calls[0][0].metrics
                .map((metric: any) => metric.id)).toEqual(['metric-2', 'metric-3']);
            expect(goBack).toHaveBeenCalled();
        });

        it('asks nothing of a save that dropped no stored Metric', async () => {
            const {root} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', 'renamed');
            await saveObservation(root);

            expect(mockCountMetricValues).not.toHaveBeenCalled();
            expect(shows(root, 'Delete metric?')).toBe(false);
            expect(mockUpdateObservationExecute).toHaveBeenCalledTimes(1);
        });

        it('raises a dialog and asks nothing when the count fails', async () => {
            mockCountMetricValues.mockRejectedValue(new Error('Database is locked'));
            const {root} = await renderScreen();

            await removeMetric(root, REMOVE_VALUE);
            await saveObservation(root);

            expect(Alert.alert).toHaveBeenCalledWith('Error', 'Database is locked');
            expect(shows(root, 'Delete metric?')).toBe(false);
            expect(mockUpdateObservationExecute).not.toHaveBeenCalled();
        });
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

            expect(mockUpdateObservationExecute).toHaveBeenCalledWith(expect.objectContaining({
                observationId: 'obs-1',
                name: 'renamed',
                description: 'A new purpose.',
            }));
            expect(goBack).toHaveBeenCalled();
        });

        it('accepts the Observation\'s own name cased differently', async () => {
            const {root, goBack} = await renderScreen();

            await typeInto(root, 'OBSERVATION NAME', 'Stale Records');
            await saveObservation(root);

            expect(mockUpdateObservationExecute).toHaveBeenCalledTimes(1);
            expect(goBack).toHaveBeenCalled();
        });

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

        it('opens the dialog instead of leaving when a Metric was renamed', async () => {
            const {root, listeners} = await renderScreen();

            await nameMetric(root, 'reading', 0);

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });

        it('opens the dialog instead of leaving when a Metric was removed', async () => {
            const {root, listeners} = await renderScreen();

            await removeMetric(root, 'Remove metric value');

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });

        it('opens the dialog instead of leaving when a Metric was moved', async () => {
            const {root, listeners} = await renderScreen();

            await moveMetric(root, 'Move metric span up');

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });

        it('opens the dialog instead of leaving when a Metric was added', async () => {
            const {root, listeners} = await renderScreen();

            await addMetric(root);

            expect(await leaveScreen(listeners)).toBe(true);
            expect(dialogVisible(root)).toBe(true);
        });

        it('lets a Metric name padded with whitespace leave with no dialog', async () => {
            const {root, listeners} = await renderScreen();

            await nameMetric(root, '  value  ', 0);

            expect(await leaveScreen(listeners)).toBe(false);
            expect(dialogVisible(root)).toBe(false);
        });

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

    describe('reordering', () => {
        it('submits the Metrics in the order the form last showed', async () => {
            const {root} = await renderScreen();

            await moveMetric(root, 'Move metric span up');
            await saveObservation(root);

            expect(mockUpdateObservationExecute.mock.calls[0][0].metrics.map((metric: any) => metric.id))
                .toEqual(['metric-2', 'metric-1', 'metric-3']);
        });

        // A move destroys nothing, so the confirmation a removal earns has no
        // business standing in front of one.
        it('writes a save that only reorders without confirming anything', async () => {
            const {root} = await renderScreen();

            await moveMetric(root, 'Move metric span up');
            await saveObservation(root);

            expect(shows(root, 'Delete metric?')).toBe(false);
            expect(mockCountMetricValues).not.toHaveBeenCalled();
            expect(mockUpdateObservationExecute).toHaveBeenCalledTimes(1);
        });

        it('carries the stated type and values of a card with it', async () => {
            const {root} = await renderScreen();

            await moveMetric(root, 'Move metric mood up');

            expect(metricNames(root)).toEqual(['value', 'mood', 'span']);
            expect(hasTestID(root, 'metric-values-locked-1')).toBe(true);
        });
    });
});
