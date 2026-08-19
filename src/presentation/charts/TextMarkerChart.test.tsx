import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Circle, Line, RoundedRect, type SkFont, Text as SkiaText, useFont} from '@shopify/react-native-skia';
import {TextMarkerChart} from './TextMarkerChart';
import {CategorySwimlaneChart} from './CategorySwimlaneChart';
import {TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import {POINT_COUNT_LABEL_COLOR} from './chartAxis';
import {AggregationStrategy, MetricSeriesPoint, TimeRange} from '../../application/GetMetricSeriesUseCase';
import {Metric} from '../../domain/Metric';

vi.mock('react-native', () => require('react-native-web'));

const CHART_WIDTH = 300;
/** The height the registry draws a Text card at, which the plot below follows from. */
const CHART_HEIGHT = 40;
/** What the other three types are registered at, for the card a mark is lined up against. */
const PLOT_CHART_HEIGHT = 108;

// The plotting rectangle this chart carves out of its box: the 32px gutter every
// chart reserves, the same top padding and right inset, and the time-label strip
// along the bottom - leaving a 20px band whose middle the marks sit on.
const PLOT = {left: 32, top: 6, right: 296, bottom: 26};
const PLOT_WIDTH = PLOT.right - PLOT.left;
const MARK_Y = (PLOT.top + PLOT.bottom) / 2;
/** Where every time label's baseline sits: 12px below the plot's bottom edge. */
const TIME_LABEL_BASELINE = PLOT.bottom + 12;
const COUNT_LABEL_OFFSET = 7;

// A ten-bucket window, so a bucket is a tenth of the plot wide and a point's own
// `x` reads as its bucket index.
const BUCKET_MS = 1000;
const TIME_RANGE: TimeRange = {start: new Date(0), end: new Date(10 * BUCKET_MS)};
const AGGREGATION: AggregationStrategy = {bucketSizeMs: BUCKET_MS};

// Stands in for a loaded typeface, every glyph the same width, so a label's
// width reads as a number of characters.
const GLYPH_WIDTH = 5;
const fontStub = {
  measureText: (text: string) => ({x: 0, y: 0, width: text.length * GLYPH_WIDTH, height: 9}),
  getMetrics: () => ({ascent: -7, descent: 2, leading: 0}),
} as unknown as SkFont;

function loadFont() {
  vi.mocked(useFont).mockReturnValue(fontStub);
}

function textMetric(): Metric {
  return new Metric('t1', 'note', 'Text');
}

function marker(bucketIndex: number, recordCount = 1): MetricSeriesPoint {
  return {
    kind: 'marker',
    x: bucketIndex * BUCKET_MS,
    recordId: `r${bucketIndex}`,
    recordCount,
    firstRecordAt: bucketIndex * BUCKET_MS,
    lastRecordAt: bucketIndex * BUCKET_MS,
  };
}

function render(points: MetricSeriesPoint[], onPointPress = vi.fn()) {
  let root: any;
  act(() => {
    root = renderer.create(
      <TextMarkerChart
        metric={textMetric()}
        points={points}
        timeRange={TIME_RANGE}
        aggregation={AGGREGATION}
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        onPointPress={onPointPress}
      />,
    );
  });
  return root!;
}

function circles(root: any) {
  return root.root.findAllByType(Circle).map((circle: any) => circle.props);
}

/** The coloured dot of each mark: the smaller of the two circles drawn per bucket. */
function dots(root: any) {
  const smallest = Math.min(...circles(root).map((circle: any) => circle.r));
  return circles(root).filter((circle: any) => circle.r === smallest);
}

function labels(root: any) {
  return root.root.findAllByType(SkiaText).map((text: any) => text.props);
}

function countLabels(root: any) {
  return labels(root).filter((label: any) => label.y !== TIME_LABEL_BASELINE);
}

function findAllByText(root: any, text: string) {
  return root.findAll(
    (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
  );
}

function markX(bucketIndex: number): number {
  return PLOT.left + (bucketIndex / 10) * PLOT_WIDTH;
}

describe('TextMarkerChart', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // The typeface resolves asynchronously on device, so the default state of a
    // freshly mounted chart is "font not ready yet".
    vi.mocked(useFont).mockReturnValue(null);
  });

  it('draws one mark per bucket, at that bucket’s place in time', () => {
    const root = render([marker(0), marker(5)]);

    expect(dots(root).map((dot: any) => dot.cx)).toEqual([markX(0), markX(5)]);
    expect(dots(root).every((dot: any) => dot.cy === MARK_Y)).toBe(true);
  });

  it('draws every mark the same size whatever its bucket holds', () => {
    const root = render([marker(0, 1), marker(5, 40)]);

    const [lone, busy] = dots(root);
    expect(lone.r).toBe(busy.r);
    expect(circles(root)).toHaveLength(4);
  });

  it('rules a single line across the middle of the plot and nothing else', () => {
    const lines = render([marker(0)]).root.findAllByType(Line).map((line: any) => line.props);

    expect(lines).toHaveLength(1);
    expect(lines[0].p1).toEqual({x: PLOT.left, y: MARK_Y});
    expect(lines[0].p2).toEqual({x: PLOT.right, y: MARK_Y});
  });

  it('writes a count above a mark standing for more than one Record', () => {
    loadFont();

    const [label] = countLabels(render([marker(3, 7)]));

    expect(label.text).toBe('7');
    expect(label.x).toBeCloseTo(markX(3) - GLYPH_WIDTH / 2);
    expect(label.y).toBe(MARK_Y - COUNT_LABEL_OFFSET);
    expect(label.color).toBe(POINT_COUNT_LABEL_COLOR);
  });

  it('leaves a mark standing for a single Record unlabelled', () => {
    loadFont();

    expect(countLabels(render([marker(0), marker(5, 2)]))).toHaveLength(1);
  });

  it('caps a count past ninety-nine rather than widening the label', () => {
    loadFont();

    expect(countLabels(render([marker(0, 100)]))[0].text).toBe('99+');
  });

  it('draws its marks while the font is still loading', () => {
    const points = [marker(0, 3)];

    const loading = render(points);
    loadFont();
    const loaded = render(points);

    expect(labels(loading)).toHaveLength(0);
    expect(circles(loading)).toEqual(circles(loaded));
  });

  it('renders the insufficient-data message for a window holding no text', () => {
    const root = render([]);

    expect(findAllByText(root.root, TREND_INSUFFICIENT_MESSAGE).length).toBeGreaterThan(0);
    expect(circles(root)).toHaveLength(0);
  });

  it('never reports a point, wherever the canvas is touched', () => {
    const onPointPress = vi.fn();
    const root = render([marker(0), marker(5)], onPointPress);

    const pressed = root.root.findAll((node: any) => typeof node.props?.onPress === 'function');

    expect(pressed).toHaveLength(0);
    expect(onPointPress).not.toHaveBeenCalled();
  });

  // The two cards are drawn at different heights, which is what could have pulled
  // their x scales apart.
  it('places a mark at the same x a swimlane places one for the same moment', () => {
    const swimlanePoint: MetricSeriesPoint = {
      ...marker(5),
      kind: 'category',
      counts: [{value: 'a', count: 1}],
    };
    let swimlane: any;
    act(() => {
      swimlane = renderer.create(
        <CategorySwimlaneChart
          metric={new Metric('e1', 'category', 'Enum', {allowedValues: ['a']})}
          points={[swimlanePoint]}
          timeRange={TIME_RANGE}
          aggregation={AGGREGATION}
          width={CHART_WIDTH}
          height={PLOT_CHART_HEIGHT}
          onPointPress={vi.fn()}
        />,
      );
    });

    const [column] = swimlane.root.findAllByType(RoundedRect).map((mark: any) => mark.props);
    const [dot] = dots(render([marker(5)]));

    expect(dot.cx).toBeCloseTo(column.x);
  });
});
