import {describe, expect, it, vi} from 'vitest';
import {rendererRegistry} from './rendererRegistry';
import {NumericTrendChart} from './NumericTrendChart';
import {CategorySwimlaneChart} from './CategorySwimlaneChart';
import {TextMarkerChart} from './TextMarkerChart';
import {MetricValueType} from '../../domain/Metric';

// The charts (pulled in transitively when the registry registers them) import
// react-native, which can't load raw under Node.
vi.mock('react-native', () => require('react-native-web'));

const ALL_TYPES: MetricValueType[] = ['Numeric', 'Boolean', 'Enum', 'Text'];

describe('rendererRegistry', () => {
  it('imports and initializes without error', () => {
    expect(rendererRegistry).toBeInstanceOf(Map);
  });

  it('is keyed by MetricValueType', () => {
    const type: MetricValueType = 'Numeric';
    expect(rendererRegistry.has(type)).toBe(true);
  });

  it('registers NumericTrendChart for the Numeric metric type', () => {
    expect(rendererRegistry.get('Numeric')?.renderer).toBe(NumericTrendChart);
  });

  // One component under two keys: both types reduce to the same point kind, and
  // it takes its lanes from the Metric rather than from the type it was fetched
  // under.
  it.each(['Enum', 'Boolean'] as const)(
    'registers CategorySwimlaneChart for the %s metric type',
    type => {
      expect(rendererRegistry.get(type)?.renderer).toBe(CategorySwimlaneChart);
    },
  );

  it('registers TextMarkerChart for the Text metric type', () => {
    expect(rendererRegistry.get('Text')?.renderer).toBe(TextMarkerChart);
  });

  it('covers every metric type a Metric can be declared with', () => {
    expect(ALL_TYPES.filter(type => !rendererRegistry.has(type))).toEqual([]);
  });

  it('draws the Text card shorter than the height the other three share', () => {
    const heightOf = (type: MetricValueType) => rendererRegistry.get(type)!.cardHeight;
    const plotted = (['Numeric', 'Boolean', 'Enum'] as const).map(heightOf);

    expect(new Set(plotted).size).toBe(1);
    expect(heightOf('Text')).toBeLessThan(plotted[0]);
  });
});
