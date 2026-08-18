import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Line, RoundedRect, type SkFont, Text as SkiaText, useFont} from '@shopify/react-native-skia';
import {CategorySwimlaneChart} from './CategorySwimlaneChart';
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

// The plotting rectangle this chart carves out of its box: the 32px gutter every
// chart reserves for its left-hand labels, then the same top padding, right
// inset and time-label strip.
const PLOT = {left: 32, top: 6, right: 296, bottom: 94};
const PLOT_WIDTH = PLOT.right - PLOT.left;
const LANE_HEIGHT = (PLOT.bottom - PLOT.top) / MOODS.length;
/** Where every time label's baseline sits: 12px below the plot's bottom edge. */
const TIME_LABEL_BASELINE = PLOT.bottom + 12;
/** The gutter less the 5px gap a lane label keeps from the plot. */
const LANE_LABEL_WIDTH = PLOT.left - 5;

// A ten-bucket window, so a bucket is a tenth of the plot wide and a point's own
// `x` reads as its bucket index.
const BUCKET_MS = 1000;
/** The gap a mark keeps off the next bucket's, which its own width is short by. */
const MARK_GAP = 2;
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

/** One bucket's Records, as the values they took and how many took each. */
function bucket(bucketIndex: number, ...counts: [string, number][]): MetricSeriesPoint {
  return {
    kind: 'category',
    x: bucketIndex * BUCKET_MS,
    counts: counts.map(([value, count]) => ({value, count})),
    recordId: `r${bucketIndex}`,
    recordCount: counts.reduce((total, [, count]) => total + count, 0),
    firstRecordAt: bucketIndex * BUCKET_MS,
    lastRecordAt: bucketIndex * BUCKET_MS,
  };
}

function render(
  points: MetricSeriesPoint[],
  metric: Metric = enumMetric(),
  onPointPress = vi.fn(),
  aggregation: AggregationStrategy = AGGREGATION,
) {
  let root: any;
  act(() => {
    root = renderer.create(
      <CategorySwimlaneChart
        metric={metric}
        points={points}
        timeRange={TIME_RANGE}
        aggregation={aggregation}
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        onPointPress={onPointPress}
      />,
    );
  });
  return root!;
}

/**
 * Taps the canvas at a position across it. `locationY` defaults to the plot's
 * own top edge, the furthest a tap can land from the marks a bucket's Records
 * usually draw at the foot of their lanes - a column is tapped anywhere down its
 * height, so no test needs to aim at one.
 */
function press(root: any, locationX: number, locationY = PLOT.top) {
  const pressable = root.root.findByProps({testID: 'category-swimlane-chart-pressable'});
  act(() => {
    pressable.props.onPress({nativeEvent: {locationX, locationY}});
  });
}

/** The middle of the column a bucket draws, which its tap target is centred on. */
function columnCentre(bucketIndex: number): number {
  return PLOT.left + (bucketIndex + 0.5) * (PLOT_WIDTH / 10) - MARK_GAP / 2;
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

/** Every lane boundary, counting down from the plot's own top edge at index 0. */
function laneBoundary(index: number): number {
  return PLOT.top + index * LANE_HEIGHT;
}

/** The bottom edge of the lane holding the value declared at `lane`. */
function laneFloor(lane: number): number {
  return laneBoundary(lane + 1);
}

describe('CategorySwimlaneChart drawing an Enum Metric', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // The typeface resolves asynchronously on device, so the default state of a
    // freshly mounted chart is "font not ready yet".
    vi.mocked(useFont).mockReturnValue(null);
  });

  it('draws one mark per value a bucket took, each in the lane of that value', () => {
    const root = render([bucket(0, ['low', 1], ['high', 1])]);

    expect(marks(root)).toHaveLength(2);
    const [low, high] = marks(root);
    expect(low.y + low.height).toBeCloseTo(laneFloor(0) - 3);
    expect(high.y + high.height).toBeCloseTo(laneFloor(2) - 3);
    expect(low.y).toBeLessThan(high.y);
  });

  it('colours each mark from the ramp entry of its own lane, darkest at the top', () => {
    const ramp = getLaneColors(MOODS.length);

    const root = render([bucket(0, ['low', 1], ['ok', 1], ['high', 1])]);

    expect(marks(root).map((mark: any) => mark.color)).toEqual([ramp[0], ramp[1], ramp[2]]);
    expect(ramp[ramp.length - 1]).toBe(COLORS.primaryContainer);
  });

  it('fills a lane with the largest count anywhere in the series', () => {
    const [half, largest] = marks(render([bucket(0, ['ok', 2]), bucket(5, ['ok', 4])]));

    // A lane is scaled against less the 3px inset it keeps at each end, and every
    // mark is a share of that same band rather than of its own inset lane.
    expect(largest.height).toBeCloseTo(LANE_HEIGHT - 6);
    expect(largest.y).toBeCloseTo(laneFloor(1) - 3 - largest.height);
    expect(half.height).toBeCloseTo(largest.height / 2);
  });

  // One Record against thirty: measured against its own bucket's total the lone
  // one would be the whole of it, and out-ink the ten in the lane beside it.
  it('draws a bucket of one Record shorter than a busy bucket beside it', () => {
    const root = render([bucket(0, ['low', 1]), bucket(5, ['low', 10], ['high', 20])]);

    const [lone, busyLow, busyHigh] = marks(root);
    expect(lone.height).toBeLessThan(busyLow.height);
    expect(busyHigh.height).toBeCloseTo(LANE_HEIGHT - 6);
  });

  // A fifth of the busiest count is a fifth of a lane, not the minimum: it drew
  // the minimum while the insets were a toll on every mark whatever its count.
  it('holds a count far below the tallest at its own share of the lane', () => {
    const [small, tallest] = marks(render([bucket(0, ['low', 1]), bucket(5, ['high', 5])]));

    expect(small.height).toBeCloseTo(tallest.height / 5);
    expect(small.height).toBeGreaterThan(3);
  });

  it('draws a count too small to see at a minimum height rather than rounding it away', () => {
    const [tiny] = marks(render([bucket(0, ['low', 1], ['high', 99])]));

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
      laneBoundary(0),
      laneBoundary(1),
      laneBoundary(2),
      laneBoundary(3),
    ]);
    expect(lines[0].p1.y).toBe(PLOT.top);
    expect(lines[MOODS.length].p1.y).toBe(PLOT.bottom);
    lines.forEach((line: any) => {
      expect(line.p1.x).toBe(PLOT.left);
      expect(line.p2.x).toBe(PLOT.right);
      expect(line.p2.y).toBe(line.p1.y);
    });
  });

  it('labels each lane in the gutter, in declared order read top down', () => {
    loadFont();

    const root = render([bucket(0, ['ok', 1])]);

    // The order the Record form lists them in, so the chart and the picker agree.
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

    expect(separators(root)).toHaveLength(MOODS.length + 1);
    expect(laneLabels(root)).toHaveLength(MOODS.length);
    expect(timeLabels(root).length).toBeGreaterThan(0);
  });

  it('draws the marks and separators while the font is still loading', () => {
    const points = [bucket(0, ['low', 1], ['high', 1])];

    const loading = render(points);
    loadFont();
    const loaded = render(points);

    expect(labels(loading)).toHaveLength(0);
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

  it('reports the whole point of the bucket whose column a tap lands on', () => {
    const onPointPress = vi.fn();
    const points = [bucket(0, ['low', 1]), bucket(5, ['ok', 2], ['high', 1])];
    const root = render(points, enumMetric(), onPointPress);

    press(root, columnCentre(5));

    // The point entire, counts included: what the tap means - opening the one
    // Record or narrowing onto the three - is read off it by the screen.
    expect(onPointPress).toHaveBeenCalledWith(points[1]);
  });

  it('answers a tap at the far end of a column as readily as one at its start', () => {
    const onPointPress = vi.fn();
    // A window of six buckets rather than ten, drawing each 42px wide - about
    // the widest the app produces, at `1W`. The end of a bar that wide is
    // further from the bucket's own start than the tolerance reaches, so only a
    // target centred on the bar covers it.
    const wide: AggregationStrategy = {bucketSizeMs: (10 * BUCKET_MS) / 6};
    const points = [bucket(0, ['low', 1])];
    const root = render(points, enumMetric(), onPointPress, wide);

    press(root, PLOT.left + PLOT_WIDTH / 6 - MARK_GAP);

    expect(onPointPress).toHaveBeenCalledWith(points[0]);
  });

  it('reports the nearer column when a tap falls between two', () => {
    const onPointPress = vi.fn();
    const points = [bucket(0, ['low', 1]), bucket(1, ['high', 1])];
    const root = render(points, enumMetric(), onPointPress);

    press(root, (columnCentre(0) + columnCentre(1)) / 2 + 1);

    expect(onPointPress).toHaveBeenCalledWith(points[1]);
  });

  it('reports nothing from the empty stretch between two distant columns', () => {
    const onPointPress = vi.fn();
    const root = render([bucket(0, ['low', 1]), bucket(5, ['high', 1])], enumMetric(), onPointPress);

    press(root, (columnCentre(0) + columnCentre(5)) / 2);

    expect(onPointPress).not.toHaveBeenCalled();
  });

  it('reports nothing from beyond either end of the drawn columns', () => {
    const onPointPress = vi.fn();
    const root = render([bucket(3, ['low', 1]), bucket(5, ['high', 1])], enumMetric(), onPointPress);

    press(root, PLOT.left);
    press(root, PLOT.right);

    expect(onPointPress).not.toHaveBeenCalled();
  });

  it('answers a tap high above a bucket whose marks are drawn short', () => {
    const onPointPress = vi.fn();
    // A single Record against twenty: its mark is the 3px minimum, at the foot
    // of its lane and most of the plot below the tap.
    const points = [bucket(0, ['low', 1]), bucket(5, ['high', 20])];
    const root = render(points, enumMetric(), onPointPress);

    press(root, columnCentre(0), PLOT.top);

    expect(onPointPress).toHaveBeenCalledWith(points[0]);
  });

  it('makes no target of a bucket whose counts matched no lane', () => {
    const onPointPress = vi.fn();
    const points = [bucket(0, ['maybe', 3]), bucket(5, ['high', 1])];
    const root = render(points, enumMetric(), onPointPress);

    press(root, columnCentre(0));

    expect(onPointPress).not.toHaveBeenCalled();

    press(root, columnCentre(5));

    expect(onPointPress).toHaveBeenCalledWith(points[1]);
  });
});

describe('CategorySwimlaneChart drawing a Boolean Metric', () => {
  const BOOLEAN_LANE_HEIGHT = (PLOT.bottom - PLOT.top) / 2;

  function booleanMetric(): Metric {
    return new Metric('b1', 'done', 'Boolean');
  }

  /** The bottom edge of the lane at `lane`, over two lanes rather than three. */
  function booleanLaneFloor(lane: number): number {
    return PLOT.top + (lane + 1) * BOOLEAN_LANE_HEIGHT;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(useFont).mockReturnValue(null);
  });

  it('draws two lanes labelled Yes over No, Yes on the ramp’s dark end', () => {
    loadFont();
    const ramp = getLaneColors(2);

    const root = render([bucket(0, ['true', 1], ['false', 1])], booleanMetric());

    expect(laneLabels(root).map((label: any) => label.text)).toEqual(['Yes', 'No']);
    expect(separators(root)).toHaveLength(3);
    const [yes, no] = marks(root);
    expect(yes.y + yes.height).toBeCloseTo(booleanLaneFloor(0) - 3);
    expect(no.y + no.height).toBeCloseTo(booleanLaneFloor(1) - 3);
    expect([yes.color, no.color]).toEqual([ramp[0], ramp[1]]);
  });

  // One gutter for every chart, whatever it labels - so two cards of the same
  // window put a moment at the same x and can be read down a column.
  it('draws from the same left edge, and over the same plot, an Enum swimlane does', () => {
    loadFont();

    const root = render([bucket(0, ['true', 1])], booleanMetric());

    expect(separators(root).every((line: any) => line.p1.x === PLOT.left)).toBe(true);
    const [mark] = marks(root);
    expect(mark.x).toBeCloseTo(PLOT.left);
    expect(mark.width).toBeCloseTo(PLOT_WIDTH / 10 - 2);
  });

  // A bucket splitting 2:1, beside one holding the busiest mark on the card - so
  // the two are read against the series' scale rather than their own bucket's.
  it('draws the answer given twice as often twice as tall', () => {
    const root = render(
      [bucket(0, ['true', 2], ['false', 1]), bucket(5, ['false', 4])],
      booleanMetric(),
    );

    const [yes, no, busiest] = marks(root);
    expect(busiest.height).toBeCloseTo(BOOLEAN_LANE_HEIGHT - 6);
    expect(yes.height).toBeCloseTo(2 * no.height);
  });

  it('neither draws a count matching no lane nor lets it set the height scale', () => {
    const root = render([bucket(0, ['true', 1], ['maybe', 9])], booleanMetric());

    expect(marks(root)).toHaveLength(1);
    // Nine of a stray value would otherwise be the tallest count in the series,
    // leaving the one real mark a ninth of its lane.
    expect(marks(root)[0].height).toBeCloseTo(BOOLEAN_LANE_HEIGHT - 6);
  });

  it('answers a press by its column too, the two charts being one renderer', () => {
    const onPointPress = vi.fn();
    const points = [bucket(0, ['true', 1], ['false', 1]), bucket(5, ['true', 1])];
    const root = render(points, booleanMetric(), onPointPress);

    press(root, columnCentre(0));

    expect(onPointPress).toHaveBeenCalledWith(points[0]);
  });
});
