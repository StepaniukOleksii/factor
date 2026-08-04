import {describe, expect, it} from 'vitest';
import {
    BOOLEAN_METRIC_OPTIONS,
    formatMetricRange,
    formatMetricType,
    formatMetricValue,
    formatRangeError,
} from './metricDisplay';

describe('formatMetricType', () => {
    it('names a Boolean Metric after the choice it offers, not its data type', () => {
        expect(formatMetricType('Boolean')).toBe('Yes/No');
    });

    it.each(['Numeric', 'Enum', 'Text'] as const)('leaves %s as it is', type => {
        expect(formatMetricType(type)).toBe(type);
    });
});

describe('formatMetricValue', () => {
    it.each(BOOLEAN_METRIC_OPTIONS)(
        'shows a Boolean $value as "$label" - the same word its input segment carries',
        option => {
            expect(formatMetricValue('Boolean', option.value)).toBe(option.label);
        },
    );

    it('treats false as a value, not a missing one', () => {
        expect(formatMetricValue('Boolean', false)).not.toBe('-');
    });

    it.each([
        ['Numeric' as const, 7.2, '7.2'],
        ['Text' as const, 'slept badly', 'slept badly'],
        ['Enum' as const, 'high', 'high'],
    ])('shows a %s value as it was entered', (type, value, expected) => {
        expect(formatMetricValue(type, value)).toBe(expected);
    });

    it.each([undefined, null])('shows a placeholder for a Metric holding %s', value => {
        expect(formatMetricValue('Numeric', value)).toBe('-');
        expect(formatMetricValue('Boolean', value)).toBe('-');
    });

    it('shows a value that does not match its Metric type as-is, rather than hiding it', () => {
        expect(formatMetricValue('Boolean', 'maybe')).toBe('maybe');
    });
});

describe('formatMetricRange', () => {
    it.each([
        ['a closed range', {min: 0, max: 100}, '0-100'],
        ['a floor', {min: 0}, 'Min 0'],
        ['a ceiling', {max: 100}, 'Max 100'],
    ])('states %s', (_shape, constraint, expected) => {
        expect(formatMetricRange(constraint)).toBe(expected);
    });

    // No range to state, and `undefined` is a placeholder never passed at all
    // rather than an empty one occupying the input.
    it('states nothing for an unbounded Metric', () => {
        expect(formatMetricRange(null)).toBeUndefined();
    });

    it.each([
        [{min: -40, max: -5}, '-40--5'],
        [{min: 0.5, max: 12.25}, '0.5-12.25'],
        [{min: -0.5}, 'Min -0.5'],
    ])('renders %o as its bounds were typed', (constraint, expected) => {
        expect(formatMetricRange(constraint)).toBe(expected);
    });
});

describe('formatRangeError', () => {
    it.each([
        ['a closed range', {min: 0, max: 100}, 'Must be between 0 and 100'],
        ['a floor', {min: 0}, 'Must be at least 0'],
        ['a ceiling', {max: 100}, 'Must be at most 100'],
    ])('names the bound broken on %s', (_shape, constraint, expected) => {
        expect(formatRangeError(constraint)).toBe(expected);
    });

    it('names nothing for an unbounded Metric, whose values break no bound', () => {
        expect(formatRangeError(null)).toBeUndefined();
    });

    it.each([
        [{min: -40, max: -5}, 'Must be between -40 and -5'],
        [{min: 0.5, max: 12.25}, 'Must be between 0.5 and 12.25'],
        [{max: -0.5}, 'Must be at most -0.5'],
    ])('renders %o as its bounds were typed', (constraint, expected) => {
        expect(formatRangeError(constraint)).toBe(expected);
    });
});
