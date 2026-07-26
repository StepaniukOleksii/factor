import {describe, expect, it} from 'vitest';
import {BOOLEAN_METRIC_OPTIONS, formatMetricType, formatMetricValue} from './metricDisplay';

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
