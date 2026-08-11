import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import {CreateObservationScreen} from './CreateObservationScreen';
import {Observation} from '../../domain/Observation';
import {METRIC_ENUM_VALUE_MAX_LENGTH} from '../../domain/validationLimits';

const {mockCreateObservationExecute, mockFindAll} = vi.hoisted(() => {
    return {mockCreateObservationExecute: vi.fn(), mockFindAll: vi.fn()};
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
vi.mock('../../application/CreateObservationUseCase', () => ({
    CreateObservationUseCase: vi.fn().mockImplementation(() => ({
        execute: mockCreateObservationExecute,
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

async function renderScreen() {
    const goBack = vi.fn();
    let root: any;
    await act(async () => {
        root = renderer.create(
            <CreateObservationScreen route={{} as any} navigation={{goBack} as any}/>,
        );
    });
    return {root: root!, goBack};
}

/** A metric card's field, by the testID the screen gives it. */
function field(root: any, testID: string) {
    return root.root.findAllByProps({testID})[0];
}

async function typeInto(root: any, testID: string, text: string) {
    await act(async () => {
        field(root, testID).props.onChangeText(text);
    });
}

/** Names the Metric of the card at `index`. */
async function nameMetric(root: any, name: string, index = 0) {
    await act(async () => {
        fieldsByLabel(root, 'METRIC NAME')[index].props.onChangeText(name);
    });
}

async function nameObservation(root: any, name: string) {
    await act(async () => {
        fieldByLabel(root, 'OBSERVATION NAME').props.onChangeText(name);
    });
}

/** The form fields captioned `label`, which only `LabeledTextField` carries, in screen order. */
function fieldsByLabel(root: any, label: string) {
    return root.root.findAllByProps({label});
}

function fieldByLabel(root: any, label: string) {
    return fieldsByLabel(root, label)[0];
}

async function addMetric(root: any) {
    await act(async () => {
        findTouchableWithText(root.root, 'Add Metric')!.props.onPress();
    });
}

/** Whether the screen has `message` on it anywhere, as the user would read it. */
function shows(root: any, message: string) {
    return findAllByText(root.root, message).length > 0;
}

/**
 * Picks a type the way the screen offers it: the selector opens a dropdown, and
 * the chosen option is pressed inside it. The label is the one the user reads,
 * so a Boolean Metric is chosen as "Yes/No".
 */
async function chooseType(root: any, label: string) {
    await act(async () => {
        findTouchableWithIconName(root.root, 'expand-more')!.props.onPress();
    });
    await act(async () => {
        findTouchableWithText(root.root, label)!.props.onPress();
    });
}

async function saveObservation(root: any) {
    const button = findTouchableWithText(root.root, 'Create Observation');
    await act(async () => {
        await button!.props.onPress();
    });
}

/** The metrics of the single call the screen made to the use case. */
function submittedMetrics() {
    return mockCreateObservationExecute.mock.calls[0][0].metrics;
}

describe('CreateObservationScreen', () => {
    let alerted: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateObservationExecute.mockResolvedValue(undefined);
        mockFindAll.mockResolvedValue([]);
        alerted = vi.spyOn(Alert, 'alert').mockImplementation(() => {
        });
    });

    describe('mandatory fields', () => {
        it('marks nothing until a save has been attempted', async () => {
            const {root} = await renderScreen();

            expect(shows(root, 'Observation name cannot be empty')).toBe(false);
            expect(shows(root, 'Metric name cannot be empty')).toBe(false);
        });

        // The bug this covers: an unmet field was reported by the platform's own
        // error dialog, which names no field and interrupts to say so.
        it('marks the fields instead of raising a dialog, and does not save', async () => {
            const {root, goBack} = await renderScreen();

            await saveObservation(root);

            expect(alerted).not.toHaveBeenCalled();
            expect(mockCreateObservationExecute).not.toHaveBeenCalled();
            expect(goBack).not.toHaveBeenCalled();
        });

        it('puts each message on the field that caused it', async () => {
            const {root} = await renderScreen();

            await saveObservation(root);

            expect(fieldByLabel(root, 'OBSERVATION NAME').props.error)
                .toBe('Observation name cannot be empty');
            expect(fieldByLabel(root, 'METRIC NAME').props.error)
                .toBe('Metric name cannot be empty');
        });

        // One attempt per unmet field is what the dialog cost the user.
        it('reports every unmet field at once', async () => {
            const {root} = await renderScreen();

            await saveObservation(root);

            expect(shows(root, 'Observation name cannot be empty')).toBe(true);
            expect(shows(root, 'Metric name cannot be empty')).toBe(true);
        });

        it('clears a mark as its field is filled in, leaving the rest marked', async () => {
            const {root} = await renderScreen();

            await saveObservation(root);
            await nameObservation(root, 'Sleep');

            expect(shows(root, 'Observation name cannot be empty')).toBe(false);
            expect(shows(root, 'Metric name cannot be empty')).toBe(true);
        });

        // The two rows a Choice Metric starts on are blank, so it is unmet on
        // arrival the way an empty name field is.
        it('marks a Choice Metric left on its empty rows', async () => {
            const {root} = await renderScreen();

            await nameObservation(root, 'Mood');
            await nameMetric(root, 'level');
            await chooseType(root, 'Choice');
            await saveObservation(root);

            expect(shows(root, 'A choice metric needs at least 2 values')).toBe(true);
            expect(mockCreateObservationExecute).not.toHaveBeenCalled();
        });

        it('saves once every field is met', async () => {
            const {root, goBack} = await renderScreen();

            await nameObservation(root, 'Sleep');
            await nameMetric(root, 'Hours');
            await saveObservation(root);

            expect(mockCreateObservationExecute).toHaveBeenCalledTimes(1);
            expect(goBack).toHaveBeenCalled();
            expect(alerted).not.toHaveBeenCalled();
        });

        // The dialog keeps the one job no field can do: the draft passed the
        // rules and the save failed anyway.
        it('still raises a dialog when the save itself fails', async () => {
            mockCreateObservationExecute.mockRejectedValue(new Error('Database is locked'));
            const {root, goBack} = await renderScreen();

            await nameObservation(root, 'Sleep');
            await nameMetric(root, 'Hours');
            await saveObservation(root);

            expect(alerted).toHaveBeenCalledWith('Error', 'Database is locked');
            expect(goBack).not.toHaveBeenCalled();
        });
    });

    describe('name uniqueness', () => {
        it('marks the Observation name against one already stored, and clears it as the name is changed', async () => {
            mockFindAll.mockResolvedValue([new Observation('o1', 'Sleep', [])]);
            const {root} = await renderScreen();

            await nameObservation(root, 'sleep');
            await nameMetric(root, 'Hours');
            await saveObservation(root);

            expect(fieldByLabel(root, 'OBSERVATION NAME').props.error)
                .toBe('An observation with this name already exists');
            expect(mockCreateObservationExecute).not.toHaveBeenCalled();

            await nameObservation(root, 'sleep 2');

            expect(fieldByLabel(root, 'OBSERVATION NAME').props.error).toBeUndefined();
        });

        it('marks the second of two identically-named Metrics and not the first', async () => {
            const {root} = await renderScreen();

            await nameObservation(root, 'Sleep');
            await nameMetric(root, 'Hours');
            await addMetric(root);
            await nameMetric(root, ' HOURS ', 1);
            await saveObservation(root);

            expect(fieldsByLabel(root, 'METRIC NAME')[0].props.error).toBeUndefined();
            expect(fieldsByLabel(root, 'METRIC NAME')[1].props.error).toBe('Metric names must be unique');
            expect(mockCreateObservationExecute).not.toHaveBeenCalled();
        });

        it('stays usable when the existing names cannot be loaded', async () => {
            const logged = vi.spyOn(console, 'error').mockImplementation(() => {
            });
            mockFindAll.mockRejectedValue(new Error('Database is locked'));
            const {root, goBack} = await renderScreen();

            await nameObservation(root, 'Sleep');
            await nameMetric(root, 'Hours');
            await saveObservation(root);

            expect(mockCreateObservationExecute).toHaveBeenCalledTimes(1);
            expect(goBack).toHaveBeenCalled();
            expect(logged).toHaveBeenCalled();
            logged.mockRestore();
        });
    });

    describe('metric bounds', () => {
        it('offers MIN and MAX on a Numeric Metric, which every new Metric starts as', async () => {
            const {root} = await renderScreen();

            expect(field(root, 'metric-min-0').props.value).toBe('');
            expect(field(root, 'metric-max-0').props.value).toBe('');
        });

        it.each(['Text', 'Yes/No'])('offers neither on a %s Metric', async label => {
            const {root} = await renderScreen();

            await chooseType(root, label);

            expect(root.root.findAllByProps({testID: 'metric-min-0'})).toHaveLength(0);
            expect(root.root.findAllByProps({testID: 'metric-max-0'})).toHaveLength(0);
        });

        it('discards what was typed when the Metric changes type, leaving the fields empty on return', async () => {
            const {root} = await renderScreen();

            await typeInto(root, 'metric-min-0', '1');
            await typeInto(root, 'metric-max-0', '5');
            await chooseType(root, 'Text');
            await chooseType(root, 'Numeric');

            expect(field(root, 'metric-min-0').props.value).toBe('');
            expect(field(root, 'metric-max-0').props.value).toBe('');
        });

        it('passes both bounds through as typed', async () => {
            const {root} = await renderScreen();

            await nameObservation(root, 'Mood');
            await nameMetric(root, 'level');
            await typeInto(root, 'metric-min-0', '1');
            await typeInto(root, 'metric-max-0', '5');
            await saveObservation(root);

            expect(submittedMetrics()).toEqual([
                expect.objectContaining({name: 'level', type: 'Numeric', min: '1', max: '5'}),
            ]);
        });

        it('passes a bound left blank as the empty text that means unset', async () => {
            const {root} = await renderScreen();

            await nameObservation(root, 'Mood');
            await nameMetric(root, 'level');
            await typeInto(root, 'metric-max-0', '5');
            await saveObservation(root);

            expect(submittedMetrics()).toEqual([
                expect.objectContaining({min: '', max: '5'}),
            ]);
        });

        // The use case rejects a bound on a non-Numeric Metric, so an abandoned
        // one reaching it would refuse an Observation the screen showed as valid.
        it('sends no bound for a Metric switched away from Numeric', async () => {
            const {root} = await renderScreen();

            await nameObservation(root, 'Diary');
            await nameMetric(root, 'journal');
            await typeInto(root, 'metric-min-0', '1');
            await chooseType(root, 'Text');
            await saveObservation(root);

            expect(submittedMetrics()).toEqual([
                expect.objectContaining({type: 'Text', min: '', max: ''}),
            ]);
        });

        it('gives a Metric added after the first its own empty bounds', async () => {
            const {root} = await renderScreen();

            await typeInto(root, 'metric-min-0', '1');
            await act(async () => {
                findTouchableWithText(root.root, 'Add Metric')!.props.onPress();
            });

            expect(field(root, 'metric-min-0').props.value).toBe('1');
            expect(field(root, 'metric-min-1').props.value).toBe('');
        });
    });

    describe('metric values', () => {
        /** With a single Metric the card's own delete button is hidden, so every one of these belongs to a value row. */
        const deleteButtons = (root: any) => root.root.findAllByProps({name: 'delete'});

        const addValueButton = (root: any) => findTouchableWithText(root.root, 'Add Value');

        async function addValue(root: any) {
            await act(async () => {
                addValueButton(root)!.props.onPress();
            });
        }

        /** Deletes the first row, the first `delete` icon on screen belonging to it. */
        async function deleteValue(root: any) {
            await act(async () => {
                findTouchableWithIconName(root.root, 'delete')!.props.onPress();
            });
        }

        function rowExists(root: any, valueIndex: number) {
            return root.root.findAllByProps({testID: `metric-value-0-${valueIndex}`}).length > 0;
        }

        it('offers every Metric type in the dropdown, the choice last', async () => {
            const {root} = await renderScreen();

            await act(async () => {
                findTouchableWithIconName(root.root, 'expand-more')!.props.onPress();
            });
            const dropdown = root.root.findAllByProps({testID: 'modal'})[0];

            const options = dropdown
                .findAll((node: any) => node.children?.length === 1 && typeof node.children[0] === 'string')
                .map((node: any) => node.children[0]);
            expect(options).toEqual(['Numeric', 'Text', 'Yes/No', 'Choice']);
        });

        it('starts a Choice Metric on two empty rows, with no MIN/MAX beside them', async () => {
            const {root} = await renderScreen();

            await chooseType(root, 'Choice');

            expect(field(root, 'metric-value-0-0').props.value).toBe('');
            expect(field(root, 'metric-value-0-1').props.value).toBe('');
            expect(rowExists(root, 2)).toBe(false);
            expect(root.root.findAllByProps({testID: 'metric-min-0'})).toHaveLength(0);
            expect(root.root.findAllByProps({testID: 'metric-max-0'})).toHaveLength(0);
        });

        // The cap belongs on the input rather than on save alone: a limit the
        // user only meets when an Observation is refused is one the control
        // should have shown them.
        it('caps every row at the value length limit and counts towards it', async () => {
            const {root} = await renderScreen();

            await chooseType(root, 'Choice');
            await addValue(root);

            for (const valueIndex of [0, 1, 2]) {
                expect(field(root, `metric-value-0-${valueIndex}`).props.maxLength)
                    .toBe(METRIC_ENUM_VALUE_MAX_LENGTH);
                expect(field(root, `metric-value-0-${valueIndex}`).props.showCounter).toBe(true);
            }
        });

        it.each(['Numeric', 'Text', 'Yes/No'])('offers no value editor on a %s Metric', async label => {
            const {root} = await renderScreen();

            await chooseType(root, 'Choice');
            await chooseType(root, label);

            expect(rowExists(root, 0)).toBe(false);
            expect(addValueButton(root)).toBeNull();
        });

        it('discards what was typed when the Metric changes type, leaving empty rows on return', async () => {
            const {root} = await renderScreen();

            await chooseType(root, 'Choice');
            await typeInto(root, 'metric-value-0-0', 'low');
            await addValue(root);
            await chooseType(root, 'Numeric');
            await chooseType(root, 'Choice');

            expect(field(root, 'metric-value-0-0').props.value).toBe('');
            expect(rowExists(root, 2)).toBe(false);
        });

        it('shows a delete button per row only while more than the minimum two exist', async () => {
            const {root} = await renderScreen();

            await chooseType(root, 'Choice');
            expect(deleteButtons(root)).toHaveLength(0);

            await addValue(root);
            expect(deleteButtons(root)).toHaveLength(3);
        });

        it('hides Add Value at the cap of four rows, and offers it again once one is deleted', async () => {
            const {root} = await renderScreen();

            await chooseType(root, 'Choice');
            await addValue(root);
            await addValue(root);

            expect(field(root, 'metric-value-0-3').props.value).toBe('');
            expect(addValueButton(root)).toBeNull();

            await deleteValue(root);

            expect(addValueButton(root)).toBeTruthy();
            expect(rowExists(root, 3)).toBe(false);
        });

        it('removes the row that was deleted, moving the rest up', async () => {
            const {root} = await renderScreen();

            await chooseType(root, 'Choice');
            await addValue(root);
            await typeInto(root, 'metric-value-0-0', 'low');
            await typeInto(root, 'metric-value-0-1', 'ok');
            await typeInto(root, 'metric-value-0-2', 'high');

            await deleteValue(root);

            expect(field(root, 'metric-value-0-0').props.value).toBe('ok');
            expect(field(root, 'metric-value-0-1').props.value).toBe('high');
        });

        it('passes the values through as typed, in the order they were declared', async () => {
            const {root} = await renderScreen();

            await nameObservation(root, 'Mood');
            await nameMetric(root, 'mood');
            await chooseType(root, 'Choice');
            await typeInto(root, 'metric-value-0-0', 'low');
            await typeInto(root, 'metric-value-0-1', 'high');
            await saveObservation(root);

            expect(submittedMetrics()).toEqual([
                expect.objectContaining({name: 'mood', type: 'Enum', values: ['low', 'high']}),
            ]);
        });

        // The use case rejects a value on a non-Enum Metric, so an abandoned one
        // reaching it would refuse an Observation the screen showed as valid.
        it('sends no value for a Metric switched away from Choice', async () => {
            const {root} = await renderScreen();

            await nameObservation(root, 'Mood');
            await nameMetric(root, 'mood');
            await chooseType(root, 'Choice');
            await typeInto(root, 'metric-value-0-0', 'low');
            await chooseType(root, 'Text');
            await saveObservation(root);

            expect(submittedMetrics()).toEqual([
                expect.objectContaining({type: 'Text', values: ['', '']}),
            ]);
        });
    });
});
