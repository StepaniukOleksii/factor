import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {emptyMetricDraft, MetricDraft, MetricEditorCard, moveMetricDraft, toMetricDraft} from './MetricEditorCard';
import {Metric} from '../../domain/Metric';
import type {MetricErrors} from '../../application/validateCreateObservation';
import {COLORS} from '@presentation/theme';
import {METRIC_UNIT_MAX_LENGTH} from '../../domain/validationLimits';

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
    key: 'draft-hours',
    id: 'metric-1',
    name: 'Hours',
    type: 'Numeric',
    description: 'Time asleep',
    min: '0',
    max: '24',
    values: ['', ''],
    unit: 'h',
};

interface RenderOptions {
    metric?: MetricDraft;
    errors?: MetricErrors;
    onChange?: (metric: MetricDraft) => void;
    onRemove?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    stored?: boolean;
}

function renderCard(
    {metric = NUMERIC, errors = {}, onChange = vi.fn(), onRemove, onMoveUp, onMoveDown, stored}: RenderOptions = {}) {
    let root: any;
    act(() => {
        root = renderer.create(
            <MetricEditorCard
                metric={metric}
                index={0}
                errors={errors}
                onChange={onChange}
                onRemove={onRemove}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                stored={stored}
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
    describe('added', () => {
        it('offers the type picker and both bounds', () => {
            const root = renderCard();

            expect(has(root, 'metric-type-0')).toBe(true);
            expect(has(root, 'metric-min-0')).toBe(true);
            expect(has(root, 'metric-max-0')).toBe(true);
            expect(has(root, 'metric-type-locked-0')).toBe(false);
        });

        it('offers the unit beside the bounds, capped at its limit', () => {
            const root = renderCard();

            expect(has(root, 'metric-unit-0')).toBe(true);
            expect(fieldByLabel(root, 'UNIT').props.maxLength).toBe(METRIC_UNIT_MAX_LENGTH);
            expect(fieldByLabel(root, 'UNIT').props.showCounter).toBe(true);
        });

        it.each(['Text', 'Boolean', 'Enum'] as const)('offers no unit on a %s Metric', type => {
            const root = renderCard({metric: {...NUMERIC, type, unit: ''}});

            expect(has(root, 'metric-unit-0')).toBe(false);
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
                {...NUMERIC, type: 'Text', min: '', max: '', values: ['', ''], unit: ''});
        });

        it('marks each field with the error it was given', () => {
            const root = renderCard({errors: {name: 'Metric names must be unique', range: 'Bad range'}});

            expect(fieldByLabel(root, 'METRIC NAME').props.error).toBe('Metric names must be unique');
            expect(shows(root, 'Bad range')).toBe(true);
        });
    });

    describe('stored', () => {
        it('states the type in place of the picker', () => {
            const root = renderCard({metric: {...NUMERIC, type: 'Enum', values: ['a', 'b']}, stored: true});

            expect(has(root, 'metric-type-locked-0')).toBe(true);
            expect(has(root, 'metric-type-0')).toBe(false);
            expect(shows(root, 'Choice')).toBe(true);
        });

        it('leaves the unit open to editing, the range beside it stated', () => {
            const root = renderCard({stored: true});

            expect(has(root, 'metric-unit-0')).toBe(true);
            expect(fieldByLabel(root, 'UNIT').props.value).toBe('h');
            expect(has(root, 'metric-range-locked-0')).toBe(true);
        });

        it('offers no unit on a stored Metric that could not hold one', () => {
            const root = renderCard({metric: {...NUMERIC, type: 'Text', unit: ''}, stored: true});

            expect(has(root, 'metric-unit-0')).toBe(false);
        });

        it('offers the unit on a Numeric Metric declaring no range', () => {
            const root = renderCard({metric: {...NUMERIC, min: '', max: ''}, stored: true});

            expect(has(root, 'metric-unit-0')).toBe(true);
            expect(has(root, 'metric-range-locked-0')).toBe(false);
        });

        it('states a range in place of the bounds', () => {
            const root = renderCard({stored: true});

            expect(shows(root, '0-24')).toBe(true);
            expect(has(root, 'metric-min-0')).toBe(false);
            expect(has(root, 'metric-max-0')).toBe(false);
        });

        it.each([
            ['a lower bound alone', '0', '', 'Min 0'],
            ['an upper bound alone', '', '24', 'Max 24'],
        ])('states %s the way the Record form does', (_kind, min, max, expected) => {
            const root = renderCard({metric: {...NUMERIC, min, max}, stored: true});

            expect(shows(root, expected)).toBe(true);
        });

        it('states nothing at all for an unbounded Metric', () => {
            const root = renderCard({metric: {...NUMERIC, min: '', max: ''}, stored: true});

            expect(has(root, 'metric-range-locked-0')).toBe(false);
        });

        it('states a Choice\'s values in declaration order, with no row to edit', () => {
            const root = renderCard({metric: {...NUMERIC, type: 'Enum', values: ['a', 'b', 'c']}, stored: true});

            expect(shows(root, 'a, b, c')).toBe(true);
            expect(has(root, 'metric-value-0-0')).toBe(false);
            expect(shows(root, 'Add Value')).toBe(false);
        });

        it('still takes a new name and a new description', () => {
            const onChange = vi.fn();
            const root = renderCard({onChange, stored: true});

            act(() => {
                fieldByLabel(root, 'METRIC NAME').props.onChangeText('Duration');
            });

            expect(onChange).toHaveBeenCalledWith({...NUMERIC, name: 'Duration'});
        });
    });

    describe('the delete affordance', () => {
        const removeButton = (root: any, label: string) =>
            root.root.findAllByProps({accessibilityLabel: label});

        const bin = (root: any) =>
            removeButton(root, 'Remove metric Hours')[0].findByType('MaterialIcons');

        it('is absent without an onRemove', () => {
            const root = renderCard();

            expect(removeButton(root, 'Remove metric Hours')).toHaveLength(0);
        });

        it('calls onRemove when given one', () => {
            const onRemove = vi.fn();
            const root = renderCard({onRemove});

            act(() => {
                removeButton(root, 'Remove metric Hours')[0].props.onPress();
            });

            expect(onRemove).toHaveBeenCalled();
        });

        it('names the Metric it removes', () => {
            const root = renderCard({metric: {...NUMERIC, name: '  insufficient  '}, onRemove: vi.fn()});

            expect(removeButton(root, 'Remove metric insufficient')).not.toHaveLength(0);
        });

        // How an added card starts, and how it stays until a name is typed.
        it('falls back to its position while the name is blank', () => {
            const root = renderCard({metric: {...NUMERIC, name: ' '}, onRemove: vi.fn()});

            expect(removeButton(root, 'Remove metric 1')).not.toHaveLength(0);
        });

        it('draws in the error colour on a stored card', () => {
            const root = renderCard({onRemove: vi.fn(), stored: true});

            expect(bin(root).props.color).toBe(COLORS.error);
        });

        it('draws in the outline colour on an added one', () => {
            const root = renderCard({onRemove: vi.fn()});

            expect(bin(root).props.color).toBe(COLORS.outline);
        });
    });

    describe('the move affordances', () => {
        const arrow = (root: any, label: string) =>
            root.root.findAllByProps({accessibilityLabel: label});

        const icon = (root: any, label: string) => arrow(root, label)[0].findByType('MaterialIcons');

        it('are both absent on a card that can move neither way', () => {
            const root = renderCard({onRemove: vi.fn()});

            expect(arrow(root, 'Move metric Hours up')).toHaveLength(0);
            expect(arrow(root, 'Move metric Hours down')).toHaveLength(0);
        });

        it('are both present when only one move can be made', () => {
            const root = renderCard({onMoveDown: vi.fn()});

            expect(arrow(root, 'Move metric Hours up')).not.toHaveLength(0);
            expect(arrow(root, 'Move metric Hours down')).not.toHaveLength(0);
        });

        it('calls the handler of the arrow that was tapped', () => {
            const onMoveUp = vi.fn();
            const onMoveDown = vi.fn();
            const root = renderCard({onMoveUp, onMoveDown});

            act(() => {
                arrow(root, 'Move metric Hours down')[0].props.onPress();
            });

            expect(onMoveDown).toHaveBeenCalled();
            expect(onMoveUp).not.toHaveBeenCalled();
        });

        it('reports the move it cannot make as disabled', () => {
            const root = renderCard({onMoveDown: vi.fn()});

            const up = arrow(root, 'Move metric Hours up')[0];
            expect(up.props.disabled).toBe(true);
            expect(up.props.accessibilityState).toEqual({disabled: true});

            const down = arrow(root, 'Move metric Hours down')[0];
            expect(down.props.disabled).toBe(false);
            expect(down.props.accessibilityState).toEqual({disabled: false});
        });

        it('dims the arrow whose move cannot be made', () => {
            const root = renderCard({onMoveDown: vi.fn()});

            expect(icon(root, 'Move metric Hours up').props.color).toBe(COLORS.outlineVariant);
            expect(icon(root, 'Move metric Hours down').props.color).toBe(COLORS.outline);
        });

        // A move is destructive of nothing, so it never takes the bin's red.
        it('keeps the outline colour on a stored card', () => {
            const root = renderCard({onMoveUp: vi.fn(), onMoveDown: vi.fn(), stored: true});

            expect(icon(root, 'Move metric Hours up').props.color).toBe(COLORS.outline);
        });

        it('names the Metric it moves', () => {
            const root = renderCard({metric: {...NUMERIC, name: '  insufficient  '}, onMoveUp: vi.fn()});

            expect(arrow(root, 'Move metric insufficient up')).not.toHaveLength(0);
        });

        it('falls back to its position while the name is blank', () => {
            const root = renderCard({metric: {...NUMERIC, name: ' '}, onMoveUp: vi.fn()});

            expect(arrow(root, 'Move metric 1 up')).not.toHaveLength(0);
        });
    });
});

describe('moveMetricDraft', () => {
    const draft = (name: string): MetricDraft => ({...NUMERIC, key: name, name});
    const names = (drafts: readonly MetricDraft[]) => drafts.map(one => one.name);

    const drafts = [draft('a'), draft('b'), draft('c')];

    it('moves a draft up, sliding the one it passes down', () => {
        expect(names(moveMetricDraft(drafts, 2, 1))).toEqual(['a', 'c', 'b']);
    });

    it('moves a draft down, sliding the one it passes up', () => {
        expect(names(moveMetricDraft(drafts, 0, 1))).toEqual(['b', 'a', 'c']);
    });

    it('leaves every other draft in its existing relative order', () => {
        expect(names(moveMetricDraft([...drafts, draft('d')], 3, 0))).toEqual(['d', 'a', 'b', 'c']);
    });

    it('moves nothing for an index outside the list', () => {
        expect(names(moveMetricDraft(drafts, 0, 3))).toEqual(['a', 'b', 'c']);
        expect(names(moveMetricDraft(drafts, -1, 0))).toEqual(['a', 'b', 'c']);
    });

    it('leaves the array it was given alone', () => {
        const moved = moveMetricDraft(drafts, 0, 2);

        expect(moved).not.toBe(drafts);
        expect(names(drafts)).toEqual(['a', 'b', 'c']);
    });
});

describe('emptyMetricDraft', () => {
    it('keys each draft apart from the one before it', () => {
        expect(emptyMetricDraft().key).not.toBe(emptyMetricDraft().key);
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

    it('keys each draft apart, so two Metrics never share a card', () => {
        const metric = new Metric('m-1', 'Hours', 'Numeric');

        expect(toMetricDraft(metric).key).not.toBe(toMetricDraft(metric).key);
    });
});
