import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {LabeledTextField, type LabeledTextFieldProps} from './LabeledTextField';
import {COLORS} from '@presentation/theme';

vi.mock('react-native', () => {
    const RN = require('react-native-web');
    // react-native-web's real TextInput touches `document` on mount, which isn't
    // available under the node test environment; stub it as a plain host node so
    // its props (value, accessibilityHint, ...) remain inspectable.
    RN.TextInput = 'TextInput';
    RN.Modal = ({children, visible}: any) =>
        visible ? <RN.View testID="modal">{children}</RN.View> : null;
    return RN;
});
vi.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

const HELP = 'Minutes of actual sleep, not time in bed.';

function render(props: Partial<LabeledTextFieldProps> = {}) {
    let root: any;
    act(() => {
        root = renderer.create(
            <LabeledTextField
                label="Duration"
                testID="field"
                value=""
                onChangeText={vi.fn()}
                {...props}
            />,
        );
    });
    return root!;
}

function input(root: any) {
    return root.root.findByType('TextInput');
}

/** The touchable itself - the testID is also on the component it was passed to. */
function helpButtons(root: any) {
    return root.root.findAllByProps({testID: 'field-help', accessibilityRole: 'button'});
}

/** Every rendered string, in render order: the label, then the counter and any error. */
function renderedText(root: any): string[] {
    return root.root.findAllByType(Text).map((node: any) => {
        const {children} = node.props;
        // The counter interpolates two values, so its children arrive as a list.
        return Array.isArray(children) ? children.join('') : String(children);
    });
}

describe('LabeledTextField', () => {
    it('renders its label above the input', () => {
        const root = render();

        expect(renderedText(root)).toEqual(['Duration']);
        expect(input(root).props.value).toBe('');
    });

    it('reports typed text to its caller', () => {
        const onChangeText = vi.fn();
        const root = render({onChangeText});

        act(() => {
            input(root).props.onChangeText('8');
        });

        expect(onChangeText).toHaveBeenCalledWith('8');
    });

    it('renders a counter only when asked, and an error below the input', () => {
        expect(renderedText(render({value: 'abc', maxLength: 15, showCounter: true})))
            .toEqual(['Duration', 'abc'.length + '/15']);
        expect(renderedText(render({value: 'abc', maxLength: 15}))).toEqual(['Duration']);

        const errored = render({error: 'This field is required'});
        expect(renderedText(errored)).toEqual(['Duration', 'This field is required']);
        expect(StyleSheet.flatten(input(errored).props.style).borderColor).toBe(COLORS.error);
    });

    describe('helpText', () => {
        it('renders no help button without it', () => {
            expect(helpButtons(render())).toHaveLength(0);
            expect(helpButtons(render({helpText: ''}))).toHaveLength(0);
        });

        it('renders one beside the label with it, titled by the label', () => {
            const root = render({helpText: HELP});

            expect(helpButtons(root).length).toBeGreaterThan(0);

            act(() => {
                helpButtons(root)[0].props.onPress();
            });
            expect(root.root.findAllByProps({testID: 'field-help-dialog'}).length).toBeGreaterThan(0);
            expect(renderedText(root)).toContain('Duration');
            expect(renderedText(root)).toContain(HELP);
        });

        it('hints the input with it, so a screen reader announces it unopened', () => {
            expect(input(render({helpText: HELP})).props.accessibilityHint).toBe(HELP);
            expect(input(render()).props.accessibilityHint).toBeUndefined();
        });

        it('lets an explicit caller hint win', () => {
            const root = render({helpText: HELP, accessibilityHint: 'Whole hours only'});

            expect(input(root).props.accessibilityHint).toBe('Whole hours only');
            // Still explained in the dialog - only the hint was overridden.
            expect(helpButtons(root).length).toBeGreaterThan(0);
        });

        it('leaves the counter, the error and the label accessory as they were', () => {
            const root = render({
                helpText: HELP,
                value: 'abc',
                maxLength: 15,
                showCounter: true,
                error: 'This field is required',
                labelAccessory: <Text>Delete</Text>,
            });

            expect(renderedText(root)).toEqual([
                'Duration', 'Delete', 'abc'.length + '/15', 'This field is required',
            ]);
            expect(StyleSheet.flatten(input(root).props.style).borderColor).toBe(COLORS.error);
        });
    });

    describe('required', () => {
        it('marks its caption, and leaves it bare without it', () => {
            expect(renderedText(render({required: true}))).toEqual(['Duration *']);
            expect(renderedText(render({required: false}))).toEqual(['Duration']);
            expect(renderedText(render())).toEqual(['Duration']);
        });

        it.each([true, false, undefined])('leaves the input alone, marked or not (%s)', required => {
            const field = input(render({
                required,
                placeholder: 'e.g., Duration',
                accessibilityLabel: 'Duration value',
            })).props;

            expect(field.placeholder).toBe('e.g., Duration');
            expect(field.accessibilityLabel).toBe('Duration value');
            expect(field.testID).toBe('field');
            expect(field.required).toBeUndefined();
        });

        it('titles its help dialog with the unmarked label', () => {
            const root = render({required: true, helpText: HELP});

            act(() => {
                helpButtons(root)[0].props.onPress();
            });

            expect(renderedText(root)).toContain('Duration');
        });
    });
});
