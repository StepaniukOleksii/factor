import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {MetricDraft, MetricEditorCard, toMetricDraft} from './MetricEditorCard';
import {Metric} from '../../domain/Metric';
import type {MetricErrors} from '../../application/validateCreateObservation';

vi.mock('react-native', () => {
    const RN = require('react-native-web');
    // react-native-web's real TextInput touches `document` on mount, which isn't
    // available under the node test environment; stub it as a plain host node so
    // its props remain inspectable.
    RN.TextInput = 'TextInput';
    RN.Modal = ({children, visible}: any) =>
        visible ? <RN.View testID="modal">{children}</RN.View> : null;
    return RN;
});
vi.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

const NUMERIC: MetricDraft = {
    id: 'metric-1',
    name: 'Hours',
    type: 'Numeric',
    description: 'Time asleep',
    min: '0',
    max: '24',
    values: ['', ''],
};

interface RenderOptions {
    metric?: MetricDraft;
    errors?: MetricErrors;
    onChange?: (metric: MetricDraft) => void;
    onRemove?: () => void;
    locked?: boolean;
}

function renderCard({metric = NUMERIC, errors = {}, onChange = vi.fn(), onRemove, locked}: RenderOptions = {}) {
    let root: any;
    act(() => {
        root = renderer.create(
            <MetricEditorCard
                metric={metric}
                index={0}
                errors={errors}
                onChange={onChange}
                onRemove={onRemove}
                locked={locked}
            />,
        );
    });
    return root!;
}

function findAllByText(root: any, text: string) {
    return root.root.findAll(
        (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
    );
}

const shows = (root: any, text: string) => findAllByText(root, text).length > 0;
const has = (root: any, testID: string) => root.root.findAllByProps({testID}).length > 0;
const fieldByLabel = (root: any, label: string) => root.root.findAllByProps({label})[0];

describe('MetricEditorCard', () => {
    describe('unlocked', () => {
        it('offers the type picker and both bounds', () => {
            const root = renderCard();

            expect(has(root, 'metric-type-0')).toBe(true);
            expect(has(root, 'metric-min-0')).toBe(true);
            expect(has(root, 'metric-max-0')).toBe(true);
            expect(has(root, 'metric-type-locked-0')).toBe(false);
        });

        it('offers a value row per declared value, and Add Value below them', () => {
            const root = renderCard({metric: {...NUMERIC, type: 'Enum', values: ['sunny', 'rainy']}});

            expect(has(root, 'metric-value-0-0')).toBe(true);
            expect(has(root, 'metric-value-0-1')).toBe(true);
            expect(shows(root, 'Add Value')).toBe(true);
        });

        it('hands back the Metric with the edited field replaced', () => {
            const onChange = vi.fn();
            const root = renderCard({onChange});

            act(() => {
                fieldByLabel(root, 'METRIC NAME').props.onChangeText('Duration');
            });

            expect(onChange).toHaveBeenCalledWith({...NUMERIC, name: 'Duration'});
        });

        it('clears the editors belonging to the type left behind', () => {
            const onChange = vi.fn();
            const root = renderCard({onChange});

            act(() => {
                root.root.findAllByProps({testID: 'metric-type-0'})[0].props.onSelect('Text');
            });

            expect(onChange).toHaveBeenCalledWith(
                {...NUMERIC, type: 'Text', min: '', max: '', values: ['', '']});
        });

        it('marks each field with the error it was given', () => {
            const root = renderCard({errors: {name: 'Metric names must be unique', range: 'Bad range'}});

            expect(fieldByLabel(root, 'METRIC NAME').props.error).toBe('Metric names must be unique');
            expect(shows(root, 'Bad range')).toBe(true);
        });
    });

    describe('locked', () => {
        it('states the type in place of the picker', () => {
            const root = renderCard({metric: {...NUMERIC, type: 'Enum', values: ['a', 'b']}, locked: true});

            expect(has(root, 'metric-type-locked-0')).toBe(true);
            expect(has(root, 'metric-type-0')).toBe(false);
            expect(shows(root, 'Choice')).toBe(true);
        });

        it('states a range in place of the bounds', () => {
            const root = renderCard({locked: true});

            expect(shows(root, '0-24')).toBe(true);
            expect(has(root, 'metric-min-0')).toBe(false);
            expect(has(root, 'metric-max-0')).toBe(false);
        });

        it.each([
            ['a lower bound alone', '0', '', 'Min 0'],
            ['an upper bound alone', '', '24', 'Max 24'],
        ])('states %s the way the Record form does', (_kind, min, max, expected) => {
            const root = renderCard({metric: {...NUMERIC, min, max}, locked: true});

            expect(shows(root, expected)).toBe(true);
        });

        it('states nothing at all for an unbounded Metric', () => {
            const root = renderCard({metric: {...NUMERIC, min: '', max: ''}, locked: true});

            expect(has(root, 'metric-range-locked-0')).toBe(false);
        });

        it('states a Choice\'s values in declaration order, with no row to edit', () => {
            const root = renderCard({metric: {...NUMERIC, type: 'Enum', values: ['a', 'b', 'c']}, locked: true});

            expect(shows(root, 'a, b, c')).toBe(true);
            expect(has(root, 'metric-value-0-0')).toBe(false);
            expect(shows(root, 'Add Value')).toBe(false);
        });

        it('still takes a new name and a new description', () => {
            const onChange = vi.fn();
            const root = renderCard({onChange, locked: true});

            act(() => {
                fieldByLabel(root, 'METRIC NAME').props.onChangeText('Duration');
            });

            expect(onChange).toHaveBeenCalledWith({...NUMERIC, name: 'Duration'});
        });
    });

    describe('the delete affordance', () => {
        it('is absent without an onRemove', () => {
            const root = renderCard();

            expect(root.root.findAllByProps({accessibilityLabel: 'Remove metric 1'})).toHaveLength(0);
        });

        it('calls onRemove when given one', () => {
            const onRemove = vi.fn();
            const root = renderCard({onRemove});

            act(() => {
                root.root.findAllByProps({accessibilityLabel: 'Remove metric 1'})[0].props.onPress();
            });

            expect(onRemove).toHaveBeenCalled();
        });
    });
});

describe('toMetricDraft', () => {
    it('spreads a Numeric constraint back into the fields that state it', () => {
        const draft = toMetricDraft(new Metric('m-1', 'Hours', 'Numeric', {min: 0, max: 24}, 'Time asleep'));

        expect(draft).toMatchObject({id: 'm-1', name: 'Hours', min: '0', max: '24', description: 'Time asleep'});
    });

    it('leaves an absent bound empty rather than zero', () => {
        const draft = toMetricDraft(new Metric('m-1', 'Hours', 'Numeric', {max: 24}));

        expect(draft.min).toBe('');
        expect(draft.max).toBe('24');
    });

    it('carries a Choice\'s declared values in order', () => {
        const draft = toMetricDraft(new Metric('m-1', 'Weather', 'Enum', {allowedValues: ['sunny', 'rainy']}));

        expect(draft.values).toEqual(['sunny', 'rainy']);
    });

    it('reads a Metric with no description as an empty field', () => {
        expect(toMetricDraft(new Metric('m-1', 'Notes', 'Text')).description).toBe('');
    });
});
