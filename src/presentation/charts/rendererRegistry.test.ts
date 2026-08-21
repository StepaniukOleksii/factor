import {describe, expect, it, vi} from 'vitest';
import {rendererRegistry} from './rendererRegistry';
import {NumericTrendChart} from './NumericTrendChart';
import {CategorySwimlaneChart} from './CategorySwimlaneChart';
import {TextMarkerChart} from './TextMarkerChart';
import {swimlaneCardHeight} from './chartLanes';
import {Metric, MetricValueType} from '../../domain/Metric';

// The charts (pulled in transitively when the registry registers them) import
// react-native, which can't load raw under Node.
vi.mock('react-native', () => require('react-native-web'));

const ALL_TYPES: MetricValueType[] = ['Numeric', 'Boolean', 'Enum', 'Text'];

function enumMetric(...allowedValues: string[]): Metric {
  return new Metric('e1', 'category', 'Enum', {allowedValues});
}

function heightOf(type: MetricValueType, metric: Metric): number {
  return rendererRegistry.get(type)!.cardHeight(metric);
}

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

  it('declares every card height as a function of the Metric being drawn', () => {
    const declared = ALL_TYPES.map(type => typeof rendererRegistry.get(type)!.cardHeight);

    expect(new Set(declared)).toEqual(new Set(['function']));
  });

  // Two Metrics of the same type differing only in how many values they declare:
  // the one thing a swimlane's height turns on and the other two ignore.
  it('sizes a swimlane from its own Metric where Numeric and Text answer the same for any', () => {
    const two = enumMetric('a', 'b');
    const four = enumMetric('a', 'b', 'c', 'd');

    expect(heightOf('Enum', four)).toBeGreaterThan(heightOf('Enum', two));
    expect(heightOf('Numeric', four)).toBe(heightOf('Numeric', two));
    expect(heightOf('Text', four)).toBe(heightOf('Text', two));
  });

  it.each(['Enum', 'Boolean'] as const)(
    'answers for a %s Metric with the height its lane count asks for',
    type => {
      const metric = type === 'Enum' ? enumMetric('a', 'b', 'c') : new Metric('b1', 'done', 'Boolean');

      expect(heightOf(type, metric)).toBe(swimlaneCardHeight(metric));
    },
  );
});
