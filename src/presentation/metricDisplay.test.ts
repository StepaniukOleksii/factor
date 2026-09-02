import {describe, expect, it} from 'vitest';
import {
    BOOLEAN_METRIC_OPTIONS,
    formatMetricLabel,
    formatMetricRange,
    formatMetricType,
    formatMetricValue,
    formatRangeError,
    toEnumOptions,
} from './metricDisplay';

describe('formatMetricType', () => {
    it.each([
        ['Boolean' as const, 'Yes/No'],
        ['Enum' as const, 'Choice'],
    ])('names a %s Metric after what it offers, not its data type', (type, expected) => {
        expect(formatMetricType(type)).toBe(expected);
    });

    it.each(['Numeric', 'Text'] as const)('leaves %s as it is', type => {
        expect(formatMetricType(type)).toBe(type);
    });
});

describe('formatMetricLabel', () => {
    it('puts a declared unit after the name, in parentheses', () => {
        expect(formatMetricLabel('hourly', 'min')).toBe('hourly (min)');
    });

    it('is the name alone where the Metric declares no unit', () => {
        expect(formatMetricLabel('hourly', null)).toBe('hourly');
    });

    // The caller hands in the casing it wants for the name; the unit keeps its
    // own, `KCAL/D` not being the unit `kcal/d` is.
    it('leaves the casing of both halves as it was given them', () => {
        expect(formatMetricLabel('HOURLY', 'kcal/d')).toBe('HOURLY (kcal/d)');
    });
});

describe('toEnumOptions', () => {
    it('offers each declared value, as both the label and the value, in declaration order', () => {
        expect(toEnumOptions({allowedValues: ['low', 'ok', 'high']})).toEqual([
            {value: 'low', label: 'low'},
            {value: 'ok', label: 'ok'},
            {value: 'high', label: 'high'},
        ]);
    });

    it('offers nothing for a Metric holding no constraint, which accepts no value either', () => {
        expect(toEnumOptions(null)).toEqual([]);
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
