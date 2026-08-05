import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {CreateObservationScreen} from './CreateObservationScreen';
import {METRIC_ENUM_VALUE_MAX_LENGTH} from '../../domain/validationLimits';

const {mockCreateObservationExecute} = vi.hoisted(() => {
    return {mockCreateObservationExecute: vi.fn()};
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
    SQLiteObservationRepository: vi.fn(),
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

/**
 * The metric name field carries no testID, and is the only unlabelled input
 * before the bounds - found through the placeholder its label row shows.
 */
async function nameMetric(root: any, name: string) {
    await act(async () => {
        root.root.findByProps({placeholder: 'e.g., Duration'}).props.onChangeText(name);
    });
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
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateObservationExecute.mockResolvedValue(undefined);
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
