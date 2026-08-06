import {describe, expect, it} from 'vitest';
import {getChartLanes} from './chartLanes';
import {Metric, type MetricConstraint, type MetricValueType} from '../../domain/Metric';

function metric(type: MetricValueType, constraint: MetricConstraint = null): Metric {
  return new Metric('m1', 'metric', type, constraint);
}

describe('getChartLanes', () => {
  it('gives an Enum Metric one lane per declared value, in declared order', () => {
    expect(getChartLanes(metric('Enum', {allowedValues: ['low', 'ok', 'high']}))).toEqual([
      {value: 'low', label: 'low'},
      {value: 'ok', label: 'ok'},
      {value: 'high', label: 'high'},
    ]);
  });

  it('gives an Enum Metric with no constraint no lanes, as it accepts no value', () => {
    expect(getChartLanes(metric('Enum'))).toEqual([]);
  });

  // The words come from the Record form's own segments, and the values from what
  // the series keys its counts by - never the other way round.
  it('gives a Boolean Metric a Yes lane over a No one', () => {
    expect(getChartLanes(metric('Boolean'))).toEqual([
      {value: 'true', label: 'Yes'},
      {value: 'false', label: 'No'},
    ]);
  });

  // Its two values are fixed by its type, so a constraint reaching it - which
  // the domain never gives one - changes nothing.
  it('gives a Boolean Metric that same pair whatever constraint it carries', () => {
    expect(getChartLanes(metric('Boolean', {allowedValues: ['yes', 'no', 'maybe']}))).toEqual(
      getChartLanes(metric('Boolean')),
    );
  });

  it.each(['Numeric', 'Text'] as const)('gives a %s Metric no lanes at all', type => {
    expect(getChartLanes(metric(type))).toEqual([]);
  });
});
