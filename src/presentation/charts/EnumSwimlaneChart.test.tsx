import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Line, RoundedRect, type SkFont, Text as SkiaText, useFont} from '@shopify/react-native-skia';
import {EnumSwimlaneChart} from './EnumSwimlaneChart';
import {getLaneColors} from './laneColors';
import {TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import {AggregationStrategy, MetricSeriesPoint, TimeRange,} from '../../application/GetMetricSeriesUseCase';
import {Metric} from '../../domain/Metric';
import {COLORS} from '@presentation/theme';

vi.mock('react-native', () => require('react-native-web'));

const MOODS = ['low', 'ok', 'high'];

function enumMetric(allowedValues: string[] | null = MOODS): Metric {
  return new Metric('e1', 'mood', 'Enum', allowedValues ? {allowedValues} : null);
}

const CHART_WIDTH = 300;
const CHART_HEIGHT = 108;

// The plotting rectangle this chart carves out of its box: a 48px gutter for the
// lane labels, then the same top padding, right inset and time-label strip every
// chart reserves.
const PLOT = {left: 48, top: 6, right: 296, bottom: 94};
const PLOT_WIDTH = PLOT.right - PLOT.left;
const LANE_HEIGHT = (PLOT.bottom - PLOT.top) / MOODS.length;
/** Where every time label's baseline sits: 12px below the plot's bottom edge. */
const TIME_LABEL_BASELINE = PLOT.bottom + 12;
/** The gutter less the 5px gap a lane label keeps from the plot. */
const LANE_LABEL_WIDTH = 43;

// A ten-bucket window, so a bucket is a tenth of the plot wide and a point's own
// `x` reads as its bucket index.
const BUCKET_MS = 1000;
const TIME_RANGE: TimeRange = {start: new Date(0), end: new Date(10 * BUCKET_MS)};
const AGGREGATION: AggregationStrategy = {bucketSizeMs: BUCKET_MS};

// Stands in for a loaded typeface, every glyph the same width - the ellipsis
// included, so a truncated label's width reads as a number of characters.
const GLYPH_WIDTH = 5;
const fontStub = {
  measureText: (text: string) => ({x: 0, y: 0, width: text.length * GLYPH_WIDTH, height: 9}),
  getMetrics: () => ({ascent: -7, descent: 2, leading: 0}),
} as unknown as SkFont;

function loadFont() {
  vi.mocked(useFont).mockReturnValue(fontStub);
}

/** One bucket's Records, as the values they took and each value's share of them. */
function bucket(bucketIndex: number, ...shares: [string, number][]): MetricSeriesPoint {
  return {
    kind: 'category',
    x: bucketIndex * BUCKET_MS,
    shares: shares.map(([value, share]) => ({value, share})),
    recordId: `r${bucketIndex}`,
    recordCount: shares.length,
    firstRecordAt: bucketIndex * BUCKET_MS,
    lastRecordAt: bucketIndex * BUCKET_MS,
  };
}

function render(
  points: MetricSeriesPoint[],
  metric: Metric = enumMetric(),
  onPointPress = vi.fn(),
) {
  let root: any;
  act(() => {
    root = renderer.create(
      <EnumSwimlaneChart
        metric={metric}
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

function marks(root: any) {
  return root.root.findAllByType(RoundedRect).map((mark: any) => mark.props);
}

function separators(root: any) {
  return root.root.findAllByType(Line).map((line: any) => line.props);
}

function labels(root: any) {
  return root.root.findAllByType(SkiaText).map((text: any) => text.props);
}

function laneLabels(root: any) {
  return labels(root).filter((label: any) => label.y !== TIME_LABEL_BASELINE);
}

function timeLabels(root: any) {
  return labels(root).filter((label: any) => label.y === TIME_LABEL_BASELINE);
}

function findAllByText(root: any, text: string) {
  return root.findAll(
    (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
  );
}

/** The bottom edge of a lane, counting lanes up from the plot's own bottom. */
function laneFloor(lane: number): number {
  return PLOT.bottom - lane * LANE_HEIGHT;
}

describe('EnumSwimlaneChart', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // The typeface resolves asynchronously on device, so the default state of a
    // freshly mounted chart is "font not ready yet".
    vi.mocked(useFont).mockReturnValue(null);
  });

  it('draws one mark per value a bucket took, each in the lane of that value', () => {
    const root = render([bucket(0, ['low', 0.5], ['high', 0.5])]);

    expect(marks(root)).toHaveLength(2);
    const [low, high] = marks(root);
    expect(low.y + low.height).toBeCloseTo(laneFloor(0) - 3);
    expect(high.y + high.height).toBeCloseTo(laneFloor(2) - 3);
  });

  it('colours each mark from the ramp entry of its own lane, darkest at the bottom', () => {
    const ramp = getLaneColors(MOODS.length);

    const root = render([bucket(0, ['low', 0.34], ['ok', 0.33], ['high', 0.33])]);

    expect(marks(root).map((mark: any) => mark.color)).toEqual([ramp[0], ramp[1], ramp[2]]);
    expect(ramp[ramp.length - 1]).toBe(COLORS.primaryContainer);
  });

  it('fills a lane with the single mark of a unanimous bucket', () => {
    const [mark] = marks(render([bucket(0, ['ok', 1])]));

    // The lane less the 3px inset it keeps from its separators, top and bottom.
    expect(mark.height).toBeCloseTo(LANE_HEIGHT - 6);
    expect(mark.y).toBeCloseTo(laneFloor(1) - 3 - mark.height);
  });

  it('draws a share too small to see at a minimum height rather than rounding it away', () => {
    const [tiny] = marks(render([bucket(0, ['low', 0.01], ['high', 0.99])]));

    expect(tiny.height).toBe(3);
  });

  it('makes a mark as wide as its bucket, less the gap holding it off the next one', () => {
    const [mark] = marks(render([bucket(0, ['ok', 1])]));

    expect(mark.x).toBeCloseTo(PLOT.left);
    expect(mark.width).toBeCloseTo(PLOT_WIDTH / 10 - 2);
  });

  it('places each bucket at its own moment in the window', () => {
    const root = render([bucket(0, ['ok', 1]), bucket(5, ['ok', 1])]);

    expect(marks(root).map((mark: any) => mark.x)).toEqual([
      PLOT.left,
      PLOT.left + 0.5 * PLOT_WIDTH,
    ]);
  });

  it('cuts the newest mark at the right edge of the plot when the window ends mid-bucket', () => {
    // A bucket starting 95% of the way through a window it is 10% as long as:
    // half of it lies past the window's end.
    const midBucket: MetricSeriesPoint = {...bucket(0, ['ok', 1]), x: 9.5 * BUCKET_MS};

    const [mark] = marks(render([midBucket]));

    expect(mark.x + mark.width).toBeCloseTo(PLOT.right);
  });

  it('rules off every lane boundary and nothing else', () => {
    const root = render([bucket(0, ['ok', 1])]);
    const lines = separators(root);

    expect(lines).toHaveLength(MOODS.length + 1);
    expect(lines.map((line: any) => line.p1.y)).toEqual([
      laneFloor(0),
      laneFloor(1),
      laneFloor(2),
      laneFloor(3),
    ]);
    lines.forEach((line: any) => {
      expect(line.p1.x).toBe(PLOT.left);
      expect(line.p2.x).toBe(PLOT.right);
      expect(line.p2.y).toBe(line.p1.y);
    });
  });

  it('labels each lane in the gutter, the last-declared value on top', () => {
    loadFont();

    const root = render([bucket(0, ['ok', 1])]);

    expect(laneLabels(root).map((label: any) => label.text)).toEqual(['low', 'ok', 'high']);
    laneLabels(root).forEach((label: any, lane: number) => {
      expect(label.x).toBe(0);
      expect(label.y).toBeCloseTo(laneFloor(lane) - LANE_HEIGHT / 2 + 2.5);
    });
  });

  it('truncates a lane label too long for the gutter rather than overrunning the plot', () => {
    loadFont();

    const [label] = laneLabels(render([bucket(0, ['outstanding', 1])], enumMetric(['outstanding'])));

    expect(label.text.endsWith('…')).toBe(true);
    expect(label.text.length * GLYPH_WIDTH).toBeLessThanOrEqual(LANE_LABEL_WIDTH);
  });

  it('draws no value gridline and no value label', () => {
    loadFont();

    const root = render([bucket(0, ['ok', 1])]);

    // Every line is a lane boundary, and every label is either a lane's or the
    // time axis's - there is no value scale to label.
    expect(separators(root)).toHaveLength(MOODS.length + 1);
    expect(laneLabels(root)).toHaveLength(MOODS.length);
    expect(timeLabels(root).length).toBeGreaterThan(0);
  });

  it('draws the marks and separators while the font is still loading', () => {
    const points = [bucket(0, ['low', 0.5], ['high', 0.5])];

    const loading = render(points);
    loadFont();
    const loaded = render(points);

    expect(labels(loading)).toHaveLength(0);
    // The lanes are laid out the same either way, so nothing shifts once the
    // labels arrive.
    expect(marks(loading)).toEqual(marks(loaded));
    expect(separators(loading)).toEqual(separators(loaded));
  });

  it('renders the insufficient-data message for a window holding no Records', () => {
    const root = render([]);

    expect(findAllByText(root.root, TREND_INSUFFICIENT_MESSAGE).length).toBeGreaterThan(0);
    expect(marks(root)).toHaveLength(0);
    expect(separators(root)).toHaveLength(0);
  });

  it('renders it for a Metric with no declared values, which has no lanes to draw', () => {
    const root = render([bucket(0, ['ok', 1])], enumMetric(null));

    expect(findAllByText(root.root, TREND_INSUFFICIENT_MESSAGE).length).toBeGreaterThan(0);
    expect(marks(root)).toHaveLength(0);
  });

  it('reports no point, having nothing to press', () => {
    const onPointPress = vi.fn();

    const root = render([bucket(0, ['low', 0.5], ['high', 0.5])], enumMetric(), onPointPress);

    const pressables = root.root.findAll(
      (node: any) => node.props && typeof node.props.onPress === 'function',
    );
    expect(pressables).toHaveLength(0);
    expect(onPointPress).not.toHaveBeenCalled();
  });
});
