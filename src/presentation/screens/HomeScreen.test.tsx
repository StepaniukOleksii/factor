import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {HomeScreen} from './HomeScreen';

vi.mock('react-native', () => require('react-native-web'));
vi.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

function renderHome() {
    const navigation = {navigate: vi.fn()};
    let root: any;
    act(() => {
        root = renderer.create(<HomeScreen navigation={navigation as any} route={{} as any}/>);
    });
    return {root: root!, navigation};
}

function findAllByText(root: any, text: string) {
    return root.findAll(
        (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
    );
}

function findTouchableWithText(root: any, text: string) {
    for (const textNode of findAllByText(root, text)) {
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

describe('HomeScreen', () => {
    it('shows the app name and both destinations', () => {
        const {root} = renderHome();

        expect(findAllByText(root.root, 'Factor')).toHaveLength(1);
        expect(findAllByText(root.root, 'Observations')).toHaveLength(1);
        expect(findAllByText(root.root, 'Events')).toHaveLength(1);
    });

    it('opens the Observation list from the entry', () => {
        const {root, navigation} = renderHome();

        act(() => {
            findTouchableWithText(root.root, 'Observations')!.props.onPress();
        });

        expect(navigation.navigate).toHaveBeenCalledWith('ObservationList');
    });

    it('opens the Event list from the entry', () => {
        const {root, navigation} = renderHome();

        act(() => {
            findTouchableWithText(root.root, 'Events')!.props.onPress();
        });

        expect(navigation.navigate).toHaveBeenCalledWith('EventList');
    });

    it('offers no way back, being the stack root', () => {
        const {root} = renderHome();

        expect(root.root.findAllByProps({accessibilityLabel: 'Back'})).toHaveLength(0);
    });
});
