import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {SelectField, type SelectFieldOption} from './SelectField';
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

const MOODS: SelectFieldOption<string>[] = [
    {value: 'low', label: 'low'},
    {value: 'ok', label: 'ok'},
    {value: 'high', label: 'high'},
];

const HELP = 'How the day felt overall, not any one moment of it.';

interface RenderOptions {
    selected?: string;
    onSelect?: (value: string | undefined) => void;
    clearLabel?: string;
    error?: string;
    helpText?: string;
}

/** Clearable by default: the field this component was built for holds an optional value. */
function render(options: RenderOptions = {}) {
    const {selected, onSelect = vi.fn(), error, helpText} = options;
    // `in` rather than a default parameter, which a test passing `undefined` to
    // turn the clearing row off would fall straight back through.
    const clearLabel = 'clearLabel' in options ? options.clearLabel : 'None';
    let root: any;
    act(() => {
        root = renderer.create(
            <SelectField
                label="mood"
                testID="field"
                options={MOODS}
                selected={selected}
                onSelect={onSelect}
                clearLabel={clearLabel}
                error={error}
                helpText={helpText}
            />,
        );
    });
    return root!;
}

/** Every rendered string, in render order. With the list closed: the label, the field, then any error. */
function renderedText(root: any): string[] {
    return root.root.findAllByType(Text).map((node: any) => node.props.children);
}

/** The touchable itself - the testID is also on the component it was passed to. */
const field = (root: any) =>
    root.root.findAllByProps({testID: 'field', accessibilityRole: 'button'})[0];

/** The text inside the closed field - the second rendered string, after the label. */
const fieldValue = (root: any) => root.root.findAllByType(Text)[1];

const row = (root: any, key: string) => root.root.findAllByProps({testID: `field-${key}`})[0];

function open(root: any) {
    act(() => {
        field(root).props.onPress();
    });
}

const isOpen = (root: any) => root.root.findAllByProps({testID: 'field-options'}).length > 0;

function colorOf(node: any) {
    return StyleSheet.flatten(node.props.style).color;
}

function borderColorOf(node: any) {
    return StyleSheet.flatten(node.props.style).borderColor;
}

describe('SelectField', () => {
    it('renders the label and a closed field, listing nothing until it is opened', () => {
        const root = render();

        expect(renderedText(root)).toEqual(['mood', 'None']);
        expect(isOpen(root)).toBe(false);
    });

    it('lists the clearing row first, then one row per option in the order given', () => {
        const root = render();

        open(root);

        expect(renderedText(root)).toEqual(['mood', 'None', 'None', 'low', 'ok', 'high']);
    });

    it('reads back the selected option rather than the clearing row', () => {
        const root = render({selected: 'ok'});

        expect(renderedText(root)).toEqual(['mood', 'ok']);
    });

    // An unanswered field has to read as unanswered rather than as a value, so
    // it takes the placeholder colour a text field shows before anything is typed.
    it('shows an empty field in the placeholder colour, and a chosen value in the text colour', () => {
        const empty = render();
        const chosen = render({selected: 'ok'});

        expect(colorOf(fieldValue(empty))).toBe(COLORS.outline);
        expect(colorOf(fieldValue(chosen))).toBe(COLORS.onSurface);
    });

    it.each(MOODS)('reports $value when its row is pressed, and closes the list', option => {
        const onSelect = vi.fn();
        const root = render({onSelect});

        open(root);
        act(() => {
            row(root, option.value).props.onPress();
        });

        expect(onSelect).toHaveBeenCalledWith(option.value);
        expect(isOpen(root)).toBe(false);
    });

    it('reports nothing selected when the clearing row is pressed', () => {
        const onSelect = vi.fn();
        const root = render({selected: 'ok', onSelect});

        open(root);
        act(() => {
            row(root, 'clear').props.onPress();
        });

        expect(onSelect).toHaveBeenCalledWith(undefined);
    });

    it('marks the row holding the current value, and the clearing row while there is none', () => {
        const chosen = render({selected: 'ok'});
        const empty = render();

        open(chosen);
        open(empty);

        expect(row(chosen, 'ok').props.accessibilityState.selected).toBe(true);
        expect(row(chosen, 'clear').props.accessibilityState.selected).toBe(false);
        expect(row(empty, 'clear').props.accessibilityState.selected).toBe(true);
    });

    // A field that must hold a value offers no way back to holding none - and so
    // always has one, which is why this is the only case rendered without a
    // clearing row. The chosen value reads twice: once in the field, once as the
    // row it came from.
    it('lists no clearing row when none is named', () => {
        const root = render({clearLabel: undefined, selected: 'ok'});

        open(root);

        expect(renderedText(root)).toEqual(['mood', 'ok', 'low', 'ok', 'high']);
        expect(root.root.findAllByProps({testID: 'field-clear'})).toHaveLength(0);
    });

    it('holds no selection of its own - a press changes nothing until the caller says so', () => {
        const root = render();

        open(root);
        act(() => {
            row(root, 'high').props.onPress();
        });

        expect(renderedText(root)).toEqual(['mood', 'None']);
    });

    it('renders a supplied error below the field, and borders the field with it', () => {
        const root = render({error: 'Invalid value'});

        expect(renderedText(root)).toEqual(['mood', 'None', 'Invalid value']);
        expect(borderColorOf(field(root))).toBe(COLORS.error);
    });

    it('borders the field with the ordinary outline when there is no error', () => {
        const root = render();

        expect(borderColorOf(field(root))).toBe(COLORS.outlineVariant);
    });

    it('offers no help button and no hint without help text', () => {
        const root = render();

        expect(root.root.findAllByProps({testID: 'field-help'})).toHaveLength(0);
        expect(field(root).props.accessibilityHint).toBeUndefined();
    });

    it('offers a help button beside the label, and hints the field, when help text is given', () => {
        const root = render({helpText: HELP});

        expect(root.root.findAllByProps({testID: 'field-help'}).length).toBeGreaterThan(0);
        expect(field(root).props.accessibilityHint).toBe(HELP);
    });

    it('announces the label and what the field currently reads', () => {
        expect(field(render({selected: 'ok'})).props.accessibilityLabel).toBe('mood: ok. Change.');
        expect(field(render()).props.accessibilityLabel).toBe('mood: None. Change.');
    });
});
