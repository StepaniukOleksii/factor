import {describe, expect, it, vi} from 'vitest';
import {rendererRegistry} from './rendererRegistry';
import {NumericTrendChart} from './NumericTrendChart';
import {EnumSwimlaneChart} from './EnumSwimlaneChart';
import {MetricValueType} from '../../domain/Metric';

// The charts (pulled in transitively when the registry registers them) import
// react-native, which can't load raw under Node.
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

  it('registers EnumSwimlaneChart for the Enum metric type', () => {
    expect(rendererRegistry.get('Enum')).toBe(EnumSwimlaneChart);
  });

  // The Trends section renders a card for every registered type, so a type
  // registered before it can draw would put an empty card on the screen.
  it.each(['Boolean', 'Text'] as const)('leaves %s unregistered until it can draw', type => {
    expect(rendererRegistry.has(type)).toBe(false);
  });
});
