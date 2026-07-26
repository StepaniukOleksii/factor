import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Pressable} from 'react-native';
import {FieldHelpButton} from './FieldHelpButton';

vi.mock('react-native', () => {
    const RN = require('react-native-web');
    // The real Modal renders into a portal that needs `document`; stub it as a
    // plain host node that honours `visible`, exactly as the screen tests do.
    RN.Modal = ({children, visible, onRequestClose}: any) =>
        visible ? <RN.View testID="modal" onRequestClose={onRequestClose}>{children}</RN.View> : null;
    return RN;
});
vi.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

const TITLE = 'Mood';
const TEXT = 'How you felt on average today.\n1 = barely functioning\n5 = great';

function render() {
    let root: any;
    act(() => {
        root = renderer.create(
            <FieldHelpButton title={TITLE} text={TEXT} testID="field-help"/>,
        );
    });
    return root!;
}

/** The touchable itself - the testID is also on the component it was passed to. */
function button(root: any) {
    return root.root.findAllByProps({testID: 'field-help', accessibilityRole: 'button'})[0];
}

function dialogs(root: any) {
    return root.root.findAllByProps({testID: 'field-help-dialog'});
}

/** The overlay is the outer of the dialog's two Pressables; the dialog is the inner. */
function overlay(root: any) {
    return root.root.findAllByType(Pressable)[0];
}

function findAllByText(root: any, text: string) {
    return root.root.findAll(
        (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
    );
}

async function open(root: any) {
    await act(async () => {
        button(root).props.onPress();
    });
}

describe('FieldHelpButton', () => {
    it('renders its button and no dialog until it is pressed', () => {
        const root = render();

        expect(button(root)).toBeTruthy();
        expect(dialogs(root)).toHaveLength(0);
        expect(findAllByText(root, TITLE)).toHaveLength(0);
    });

    it('shows the given title and text once opened', async () => {
        const root = render();

        await open(root);

        expect(dialogs(root).length).toBeGreaterThan(0);
        expect(findAllByText(root, TITLE).length).toBeGreaterThan(0);
        // One Text holding the whole body, so the newlines the user typed survive
        // as line breaks rather than being split across nodes.
        expect(findAllByText(root, TEXT).length).toBeGreaterThan(0);
    });

    it('closes on its own dismiss action', async () => {
        const root = render();
        await open(root);

        const close = root.root.findByProps({accessibilityLabel: `Close ${TITLE} description`});
        await act(async () => {
            close.props.onPress();
        });

        expect(dialogs(root)).toHaveLength(0);
    });

    it('closes on a press outside it, but not on a press on the dialog itself', async () => {
        const root = render();
        await open(root);

        await act(async () => {
            dialogs(root)[0].props.onPress({stopPropagation: () => undefined});
        });
        expect(dialogs(root).length).toBeGreaterThan(0);

        await act(async () => {
            overlay(root).props.onPress();
        });

        expect(dialogs(root)).toHaveLength(0);
    });

    it('closes on the Android back gesture', async () => {
        const root = render();
        await open(root);

        const modal = root.root.findAllByProps({testID: 'modal'})[0];
        await act(async () => {
            modal.props.onRequestClose();
        });

        expect(dialogs(root)).toHaveLength(0);
    });

    it('exposes the button as a button naming the field it explains', () => {
        const root = render();

        expect(button(root).props.accessibilityRole).toBe('button');
        expect(button(root).props.accessibilityLabel).toBe(`About ${TITLE}`);
    });
});
