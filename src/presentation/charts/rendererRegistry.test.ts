import {describe, expect, it, vi} from 'vitest';
import {rendererRegistry} from './rendererRegistry';
import {NumericTrendChart} from './NumericTrendChart';
import {CategorySwimlaneChart} from './CategorySwimlaneChart';
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

  // One component under two keys: both types reduce to the same point kind, and
  // it takes its lanes from the Metric rather than from the type it was fetched
  // under.
  it.each(['Enum', 'Boolean'] as const)(
    'registers CategorySwimlaneChart for the %s metric type',
    type => {
      expect(rendererRegistry.get(type)).toBe(CategorySwimlaneChart);
    },
  );

  // The Trends section renders a card for every registered type, so a type
  // registered before it can draw would put an empty card on the screen.
  it('leaves Text unregistered until it can draw', () => {
    expect(rendererRegistry.has('Text')).toBe(false);
  });
});
