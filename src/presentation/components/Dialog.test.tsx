import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Pressable, Text, TouchableOpacity} from 'react-native';
import {Dialog, type DialogAction} from './Dialog';

vi.mock('react-native', () => {
    const RN = require('react-native-web');
    // The real Modal renders into a portal that needs `document`; stub it as a
    // plain host node that honours `visible`, exactly as the screen tests do.
    RN.Modal = ({children, visible, onRequestClose}: any) =>
        visible ? <RN.View testID="modal" onRequestClose={onRequestClose}>{children}</RN.View> : null;
    return RN;
});

const TITLE = 'Delete this record?';
const MESSAGE = 'This specific entry will be permanently removed.';

interface RenderOptions {
    visible?: boolean;
    message?: string;
    actions?: ReadonlyArray<DialogAction>;
    onRequestClose?: () => void;
    children?: React.ReactNode;
}

function render(options: RenderOptions = {}) {
    const {
        visible = true,
        actions = [{label: 'Cancel', onPress: () => undefined}],
        onRequestClose = () => undefined,
        children,
    } = options;
    // Keyed on the key's presence, not its value, so a test can ask for no
    // message at all by passing `message: undefined`.
    const message = 'message' in options ? options.message : MESSAGE;
    let root: any;
    act(() => {
        root = renderer.create(
            <Dialog
                visible={visible}
                title={TITLE}
                message={message}
                actions={actions}
                onRequestClose={onRequestClose}
                testID="dialog"
            >
                {children}
            </Dialog>,
        );
    });
    return root!;
}

/** The card - `accessible` tells it from the `Dialog` it was passed to. */
function card(root: any) {
    return root.root.findAllByProps({testID: 'dialog', accessible: false})[0];
}

/** The scrim is the outer of the two Pressables; the card is the inner. */
function scrim(root: any) {
    return root.root.findAllByType(Pressable)[0];
}

function findAllByText(root: any, text: string) {
    return root.root.findAll(
        (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
    );
}

/** The action buttons, one instance each, in render order. */
function buttons(root: any) {
    return root.root.findAllByType(TouchableOpacity);
}

function labelOf(button: any) {
    return button.findByType(Text).props.children;
}

describe('Dialog', () => {
    it('renders nothing while it is not visible', () => {
        const root = render({visible: false});

        expect(card(root)).toBeUndefined();
        expect(findAllByText(root, TITLE)).toHaveLength(0);
    });

    it('renders its title, message and children once visible', () => {
        const root = render({children: <Text>Body child</Text>});

        expect(card(root)).toBeTruthy();
        expect(findAllByText(root, TITLE).length).toBeGreaterThan(0);
        // One Text holding the whole message, so the newlines a caller passes
        // survive as line breaks rather than being split across nodes.
        expect(findAllByText(root, MESSAGE).length).toBeGreaterThan(0);
        expect(findAllByText(root, 'Body child').length).toBeGreaterThan(0);
    });

    it('leaves out the message when none is given', () => {
        const root = render({message: undefined});

        expect(findAllByText(root, TITLE).length).toBeGreaterThan(0);
        expect(findAllByText(root, MESSAGE)).toHaveLength(0);
    });

    it('renders one button per action, in the order given', () => {
        const root = render({
            actions: [
                {label: 'Cancel', onPress: () => undefined},
                {label: 'Delete', onPress: () => undefined, variant: 'destructive'},
            ],
        });

        expect(buttons(root).map(labelOf)).toEqual(['Cancel', 'Delete']);
    });

    it('calls the pressed action', () => {
        const onCancel = vi.fn();
        const onDelete = vi.fn();
        const root = render({
            actions: [
                {label: 'Cancel', onPress: onCancel},
                {label: 'Delete', onPress: onDelete, variant: 'destructive'},
            ],
        });

        act(() => {
            buttons(root)[1].props.onPress();
        });

        expect(onDelete).toHaveBeenCalledOnce();
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('blocks a disabled action and announces it as disabled', () => {
        const onDelete = vi.fn();
        const root = render({
            actions: [{label: 'Deleting…', onPress: onDelete, disabled: true}],
        });

        const button = buttons(root)[0];
        expect(button.props.disabled).toBe(true);
        expect(button.props.accessibilityState).toEqual({disabled: true});
    });

    it('announces an enabled action as enabled', () => {
        const root = render();

        expect(buttons(root)[0].props.accessibilityState).toEqual({disabled: false});
    });

    it('gives an action its own accessibility label when one is set', () => {
        const root = render({
            actions: [{
                label: 'Delete',
                onPress: () => undefined,
                accessibilityLabel: 'Confirm record deletion',
            }],
        });

        expect(buttons(root)[0].props.accessibilityLabel).toBe('Confirm record deletion');
    });

    it('leaves an action without one, so it is announced by its visible text', () => {
        const root = render({actions: [{label: 'Cancel', onPress: () => undefined}]});

        expect(buttons(root)[0].props.accessibilityLabel).toBeUndefined();
    });

    it('closes on a press outside the card, but not on a press on the card itself', () => {
        const onRequestClose = vi.fn();
        const root = render({onRequestClose});

        act(() => {
            card(root).props.onPress({stopPropagation: () => undefined});
        });
        expect(onRequestClose).not.toHaveBeenCalled();

        act(() => {
            scrim(root).props.onPress();
        });
        expect(onRequestClose).toHaveBeenCalledOnce();
    });

    it('closes on the Android back gesture', () => {
        const onRequestClose = vi.fn();
        const root = render({onRequestClose});

        act(() => {
            root.root.findAllByProps({testID: 'modal'})[0].props.onRequestClose();
        });

        expect(onRequestClose).toHaveBeenCalledOnce();
    });

    it('keeps the card out of the accessibility tree, so its contents are reached', () => {
        const root = render();

        expect(card(root).props.accessible).toBe(false);
    });
});
