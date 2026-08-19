import {describe, expect, it} from 'vitest';
import type {SkFont} from '@shopify/react-native-skia';
import {LABEL_GUTTER, timeToX, toPlotRect, truncateToWidth} from './chartAxis';

// Every glyph the same width, the ellipsis included, so a width in pixels reads
// as a number of characters.
const GLYPH_WIDTH = 5;
const fontStub = {
  measureText: (text: string) => ({x: 0, y: 0, width: text.length * GLYPH_WIDTH, height: 9}),
  getMetrics: () => ({ascent: -7, descent: 2, leading: 0}),
} as unknown as SkFont;

function widthOf(characters: number): number {
  return characters * GLYPH_WIDTH;
}

describe('truncateToWidth', () => {
  it('leaves a string that fits alone', () => {
    expect(truncateToWidth(fontStub, 'low', widthOf(4))).toBe('low');
  });

  it('leaves a string that fits its width exactly alone', () => {
    expect(truncateToWidth(fontStub, 'low', widthOf(3))).toBe('low');
  });

  it('cuts a longer string to the widest prefix that fits with an ellipsis', () => {
    expect(truncateToWidth(fontStub, 'outstanding', widthOf(5))).toBe('outs…');
  });

  it('draws nothing at all when even an ellipsis would not fit', () => {
    expect(truncateToWidth(fontStub, 'outstanding', GLYPH_WIDTH - 1)).toBe('');
  });
});

describe('toPlotRect', () => {
  // The one gutter every chart reserves, so two cards of the same window put a
  // moment at the same place and can be read against each other down a column.
  it('reserves the shared label gutter, whatever the chart', () => {
    expect(toPlotRect(300, 108)).toEqual({left: LABEL_GUTTER, top: 6, right: 296, bottom: 94});
    expect(LABEL_GUTTER).toBe(32);
  });

  // The width of a chart card is measured on layout, so the first render draws
  // into a box with no room for its own gutters.
  it('collapses an unmeasured box rather than inverting it', () => {
    const plot = toPlotRect(0, 0);

    expect(plot.right).toBe(plot.left);
    expect(plot.bottom).toBe(plot.top);
  });
});

describe('timeToX', () => {
  const PLOT = {left: 32, top: 6, right: 296, bottom: 94};
  const TIME_RANGE = {start: new Date(1000), end: new Date(2000)};

  it('puts the range’s start on the plot’s left edge and its end on the right', () => {
    expect(timeToX(1000, TIME_RANGE, PLOT)).toBe(PLOT.left);
    expect(timeToX(2000, TIME_RANGE, PLOT)).toBe(PLOT.right);
  });

  it('puts a moment part-way through the window at that share of the plot', () => {
    expect(timeToX(1250, TIME_RANGE, PLOT)).toBe(PLOT.left + 0.25 * (PLOT.right - PLOT.left));
  });

  // Only a custom range entered with the same day at both ends can produce one.
  it('collapses an empty window onto the left edge rather than dividing by zero', () => {
    const instant = {start: new Date(1000), end: new Date(1000)};

    expect(timeToX(1000, instant, PLOT)).toBe(PLOT.left);
  });
});
