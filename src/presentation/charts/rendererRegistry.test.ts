import {describe, expect, it} from 'vitest';
import {rendererRegistry} from './rendererRegistry';
import {MetricValueType} from '../../domain/Metric';

describe('rendererRegistry', () => {
  it('imports and initializes without error', () => {
    expect(rendererRegistry).toBeInstanceOf(Map);
  });

  it('starts empty with no renderers registered', () => {
    expect(rendererRegistry.size).toBe(0);
  });

  it('is keyed by MetricValueType so later slices can register into it', () => {
    const type: MetricValueType = 'Numeric';
    expect(rendererRegistry.get(type)).toBeUndefined();
  });
});
