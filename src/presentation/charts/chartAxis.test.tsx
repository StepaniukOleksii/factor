import {describe, expect, it} from 'vitest';
import type {SkFont} from '@shopify/react-native-skia';
import {LABEL_GUTTER, toPlotRect, truncateToWidth} from './chartAxis';

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
