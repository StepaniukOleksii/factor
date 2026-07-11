import {describe, expect, it, vi} from 'vitest';
import {rendererRegistry} from './rendererRegistry';
import {NumericTrendChart} from './NumericTrendChart';
import {MetricValueType} from '../../domain/Metric';

// NumericTrendChart (pulled in transitively when the registry registers it)
// imports react-native, which can't load raw under Node.
vi.mock('react-native', () => require('react-native-web'));

describe('rendererRegistry', () => {
  it('imports and initializes without error', () => {
    expect(rendererRegistry).toBeInstanceOf(Map);
  });

  it('is keyed by MetricValueType', () => {
    const type: MetricValueType = 'Numeric';
    expect(rendererRegistry.has(type)).toBe(true);
  });

  it('registers NumericTrendChart for the Numeric metric type', () => {
    expect(rendererRegistry.get('Numeric')).toBe(NumericTrendChart);
  });
});
