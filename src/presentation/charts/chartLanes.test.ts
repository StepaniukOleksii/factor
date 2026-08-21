import {describe, expect, it} from 'vitest';
import {getChartLanes, swimlaneCardHeight} from './chartLanes';
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

describe('swimlaneCardHeight', () => {
  // The 6px of top padding and the 14px time-label strip every chart reserves,
  // around lanes of 32px each.
  it.each([
    [['a', 'b'], 84],
    [['a', 'b', 'c'], 116],
    [['a', 'b', 'c', 'd'], 148],
  ])('gives an Enum Metric declaring %s a card of %ipx', (allowedValues, height) => {
    expect(swimlaneCardHeight(metric('Enum', {allowedValues}))).toBe(height);
  });

  it('gives a Boolean Metric the two-lane height, its pair being fixed by its type', () => {
    expect(swimlaneCardHeight(metric('Boolean'))).toBe(84);
  });

  it('gives a Metric it can find no lanes for that same two-lane height', () => {
    expect(swimlaneCardHeight(metric('Enum'))).toBe(84);
  });
});
