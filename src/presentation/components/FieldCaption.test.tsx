import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, Text} from 'react-native';
import {FieldCaption} from './FieldCaption';
import {COLORS, TYPOGRAPHY} from '@presentation/theme';

vi.mock('react-native', () => require('react-native-web'));

function render(required?: boolean) {
    let root: any;
    act(() => {
        root = renderer.create(<FieldCaption label="OBSERVATION NAME" required={required}/>);
    });
    return root!.root.findByType(Text);
}

describe('FieldCaption', () => {
    it('marks a required caption, and leaves every other one bare', () => {
        expect(render(true).props.children).toBe('OBSERVATION NAME *');
        expect(render(false).props.children).toBe('OBSERVATION NAME');
        expect(render().props.children).toBe('OBSERVATION NAME');
    });

    it('announces a required field as required, and says nothing extra otherwise', () => {
        expect(render(true).props.accessibilityLabel).toBe('OBSERVATION NAME, required');
        expect(render().props.accessibilityLabel).toBeUndefined();
    });

    // The mark says what the form asks for, not that anything is wrong with
    // what the field holds.
    it('draws the mark in the caption\'s own colour', () => {
        const marked = StyleSheet.flatten(render(true).props.style);

        expect(marked.color).toBe(TYPOGRAPHY.fieldLabel.color);
        expect(marked.color).not.toBe(COLORS.error);
    });
});
