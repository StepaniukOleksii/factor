import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {SegmentedField, type SegmentedFieldOption} from './SegmentedField';
import {COLORS} from '@presentation/theme';

vi.mock('react-native', () => {
    const RN = require('react-native-web');
    RN.Modal = ({children, visible}: any) =>
        visible ? <RN.View testID="modal">{children}</RN.View> : null;
    return RN;
});
vi.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

const YES_NO: SegmentedFieldOption<boolean>[] = [
    {value: true, label: 'Yes'},
    {value: false, label: 'No'},
];

const HELP = 'Yes if you woke before the alarm and felt ready.';

interface RenderOptions {
    selected?: boolean;
    onSelect?: (value: boolean | undefined) => void;
    error?: string;
    helpText?: string;
}

function render({selected = undefined, onSelect = vi.fn(), error, helpText}: RenderOptions = {}) {
    let root: any;
    act(() => {
        root = renderer.create(
            <SegmentedField
                label="Well Rested"
                testID="field"
                options={YES_NO}
                selected={selected}
                onSelect={onSelect}
                error={error}
                helpText={helpText}
            />,
        );
    });
    return root!;
}

/** Every rendered string, in render order: the label, the segments, then any error. */
function renderedText(root: any): string[] {
    return root.root.findAllByType(Text).map((node: any) => node.props.children);
}

/** The outermost match is the touchable itself, carrying its press and a11y props. */
function segment(root: any, value: unknown) {
    return root.root.findAllByProps({testID: `field-${String(value)}`})[0];
}

function selectedStates(root: any): boolean[] {
    return YES_NO.map(option => segment(root, option.value).props.accessibilityState.selected);
}

function borderColorOf(node: any) {
    return StyleSheet.flatten(node.props.style).borderColor;
}

describe('SegmentedField', () => {
    it('renders the label and one segment per option, in the order given', () => {
        const root = render();

        expect(renderedText(root)).toEqual(['Well Rested', 'Yes', 'No']);
    });

    it('selects nothing when the selection is empty', () => {
        const root = render();

        expect(selectedStates(root)).toEqual([false, false]);
        for (const option of YES_NO) {
            expect(borderColorOf(segment(root, option.value))).toBe(COLORS.outlineVariant);
        }
    });

    it.each(YES_NO)('reports $label when its segment is pressed from the empty selection', option => {
        const onSelect = vi.fn();
        const root = render({onSelect});

        act(() => {
            segment(root, option.value).props.onPress();
        });

        expect(onSelect).toHaveBeenCalledWith(option.value);
    });

    it('reports the pressed option in one press when another segment is selected', () => {
        const onSelect = vi.fn();
        const root = render({selected: false, onSelect});

        act(() => {
            segment(root, true).props.onPress();
        });

        expect(onSelect).toHaveBeenCalledWith(true);
    });

    it.each(YES_NO)('clears the selection when the selected $label segment is pressed again', option => {
        const onSelect = vi.fn();
        const root = render({selected: option.value, onSelect});

        act(() => {
            segment(root, option.value).props.onPress();
        });

        expect(onSelect).toHaveBeenCalledWith(undefined);
    });

    it('marks only the selected segment as selected', () => {
        const root = render({selected: true});

        expect(selectedStates(root)).toEqual([true, false]);
    });

    it('holds no selection of its own - a press changes nothing until the caller says so', () => {
        const root = render();

        act(() => {
            segment(root, true).props.onPress();
        });

        expect(selectedStates(root)).toEqual([false, false]);
    });

    it('renders a supplied error below the segments, and borders every segment with it', () => {
        const root = render({error: 'This field is required'});

        expect(renderedText(root)).toEqual(['Well Rested', 'Yes', 'No', 'This field is required']);
        for (const option of YES_NO) {
            expect(borderColorOf(segment(root, option.value))).toBe(COLORS.error);
        }
    });

    it('renders nothing below the segments when no error is supplied', () => {
        const root = render();

        expect(renderedText(root)).toHaveLength(YES_NO.length + 1);
    });

    it('exposes each segment as a button labelled with its own text', () => {
        const root = render();

        for (const option of YES_NO) {
            const node = segment(root, option.value);
            expect(node.props.accessibilityRole).toBe('button');
            expect(node.props.accessibilityLabel).toBe(option.label);
        }
    });

    describe('helpText', () => {
        // The touchable itself - the testID is also on the component it was passed to.
        const helpButtons = (root: any) =>
            root.root.findAllByProps({testID: 'field-help', accessibilityRole: 'button'});
        const label = (root: any) => root.root.findAllByType(Text)[0];

        it('renders no help button without it, and leaves the label unhinted', () => {
            expect(helpButtons(render())).toHaveLength(0);
            expect(helpButtons(render({helpText: ''}))).toHaveLength(0);
            expect(label(render()).props.accessibilityHint).toBeUndefined();
        });

        it('renders one beside the label with it, titled by the label', () => {
            const root = render({helpText: HELP});

            expect(helpButtons(root).length).toBeGreaterThan(0);

            act(() => {
                helpButtons(root)[0].props.onPress();
            });
            expect(root.root.findAllByProps({testID: 'field-help-dialog'}).length).toBeGreaterThan(0);
            expect(renderedText(root)).toContain('Well Rested');
            expect(renderedText(root)).toContain(HELP);
        });

        // One focusable element per option, so hinting each would read the whole
        // description out once per segment.
        it('hints the label and not the segments', () => {
            const root = render({helpText: HELP});

            expect(label(root).props.accessibilityHint).toBe(HELP);
            for (const option of YES_NO) {
                expect(segment(root, option.value).props.accessibilityHint).toBeUndefined();
            }
        });

        it('leaves the selection and the error as they were', () => {
            const onSelect = vi.fn();
            const root = render({selected: true, onSelect, error: 'This field is required', helpText: HELP});

            expect(selectedStates(root)).toEqual([true, false]);
            expect(renderedText(root)).toContain('This field is required');
            expect(borderColorOf(segment(root, false))).toBe(COLORS.error);

            act(() => {
                segment(root, false).props.onPress();
            });
            expect(onSelect).toHaveBeenCalledWith(false);
        });
    });

    it('is agnostic about what its options mean', () => {
        const onSelect = vi.fn();
        let root: any;
        act(() => {
            root = renderer.create(
                <SegmentedField
                    label="Mood"
                    testID="field"
                    options={[
                        {value: 'low', label: 'Low'},
                        {value: 'ok', label: 'OK'},
                        {value: 'high', label: 'High'},
                    ]}
                    selected="ok"
                    onSelect={onSelect}
                />,
            );
        });

        expect(renderedText(root)).toEqual(['Mood', 'Low', 'OK', 'High']);
        expect(segment(root, 'ok').props.accessibilityState.selected).toBe(true);

        act(() => {
            segment(root, 'high').props.onPress();
        });

        expect(onSelect).toHaveBeenCalledWith('high');
    });
});
