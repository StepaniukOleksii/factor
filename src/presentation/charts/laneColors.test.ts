import {describe, expect, it} from 'vitest';
import {getLaneColors} from './laneColors';
import {COLORS} from '@presentation/theme';

/** The two ends every ramp spans, however many steps it takes to get there. */
const DIM_END = '#5a8a45';
const LIGHT_END = COLORS.primaryContainer;

describe('getLaneColors', () => {
  it('ramps two lanes straight from one endpoint to the other', () => {
    expect(getLaneColors(2)).toEqual([DIM_END, LIGHT_END]);
  });

  it('puts one step between the endpoints for three lanes', () => {
    expect(getLaneColors(3)).toEqual([DIM_END, '#86bd68', LIGHT_END]);
  });

  it('puts two steps between the endpoints for four lanes', () => {
    expect(getLaneColors(4)).toEqual([DIM_END, '#75a85b', '#95ce79', LIGHT_END]);
  });

  // An entry's index is also its lane counted from the chart's top, so the first
  // one is what the top lane is painted with.
  it.each([2, 3, 4])('spans the shared endpoints at %i lanes, darkest first', laneCount => {
    const ramp = getLaneColors(laneCount);

    expect(ramp).toHaveLength(laneCount);
    expect(ramp[0]).toBe(DIM_END);
    expect(ramp[ramp.length - 1]).toBe(LIGHT_END);
  });

  // `METRIC_ENUM_MAX_VALUES` keeps a real chart at four lanes or fewer, so this
  // is about not crashing a screen rather than about what five lanes look like.
  it('falls back to the four-lane ramp past the value cap', () => {
    expect(getLaneColors(5)).toEqual(getLaneColors(4));
  });
});
