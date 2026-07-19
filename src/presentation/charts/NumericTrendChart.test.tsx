import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Circle, Line, type SkFont, Skia, Text as SkiaText, useFont} from '@shopify/react-native-skia';
import {NumericTrendChart} from './NumericTrendChart';
import {NUMERIC_TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import {MetricSeriesPoint, TimeRange} from '../../application/GetMetricSeriesUseCase';
import {Metric} from '../../domain/Metric';
import {COLORS} from '@presentation/theme';

vi.mock('react-native', () => require('react-native-web'));

const metric = new Metric('m1', 'Duration', 'Numeric');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const CHART_WIDTH = 300;
const CHART_HEIGHT = 108;

// The plotting rectangle the chart carves out of its box: a 24px column on the
// left for value labels, a 14px strip along the bottom for time labels, 6px of
// top padding so peaks aren't clipped, and a 4px right inset mirroring the left
// gutter. Mirrors NumericTrendChart's own layout constants.
const PLOT = {left: 24, top: 6, right: 296, bottom: 94};
const PLOT_WIDTH = PLOT.right - PLOT.left;
const PLOT_HEIGHT = PLOT.bottom - PLOT.top;
/** Where every time label's baseline sits: 12px below the plot's bottom edge. */
const TIME_LABEL_BASELINE = PLOT.bottom + 12;

interface PathStub {
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  cubicTo: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  copy: ReturnType<typeof vi.fn>;
}

// The stroked line path (returned by Skia.Path.Make) and the gradient area path
// (derived from it via .copy()), captured so tests can assert what each received.
let linePath: PathStub;
let areaPath: PathStub;

function makePathStub(): PathStub {
  const path = {} as PathStub;
  Object.assign(path, {
    moveTo: vi.fn(() => path),
    lineTo: vi.fn(() => path),
    cubicTo: vi.fn(() => path),
    close: vi.fn(() => path),
    copy: vi.fn(() => {
      areaPath = makePathStub();
      return areaPath;
    }),
  });
  return path;
}

// Stands in for a loaded typeface. Every glyph is a fixed width so the tests can
// predict where a label of a given length starts once it is centred or aligned
// to an edge; the metrics are a plausible ascent/descent for a 9px font.
const GLYPH_WIDTH = 5;
const fontStub = {
  measureText: (text: string) => ({x: 0, y: 0, width: text.length * GLYPH_WIDTH, height: 9}),
  getMetrics: () => ({ascent: -7, descent: 2, leading: 0}),
} as unknown as SkFont;

function loadFont() {
  vi.mocked(useFont).mockReturnValue(fontStub);
}

function points(...values: number[]): MetricSeriesPoint[] {
  return values.map((y, index) => ({x: index * 1000, y, recordId: `r${index}`}));
}

function findAllByText(root: any, text: string) {
  return root.findAll(
    (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
  );
}

// Unless a test passes an explicit window, the chart is drawn over the exact span
// of its data — reproducing the pre-fix "scale x across the data" behaviour so the
// coordinate-based assertions below stay stable. Tests that exercise the window
// scaling pass their own wider `timeRange`.
function dataSpanRange(chartPoints: MetricSeriesPoint[]): TimeRange {
  const xs = chartPoints.map(p => p.x);
  return {
    start: new Date(xs.length ? Math.min(...xs) : 0),
    end: new Date(xs.length ? Math.max(...xs) : 1),
  };
}

function render(
  chartPoints: MetricSeriesPoint[],
  onPointPress = vi.fn(),
  timeRange: TimeRange = dataSpanRange(chartPoints),
) {
  let root: any;
  act(() => {
    root = renderer.create(
      <NumericTrendChart
        metric={metric}
        points={chartPoints}
        timeRange={timeRange}
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        onPointPress={onPointPress}
      />,
    );
  });
  return root!;
}

/** The line-coloured circles are the record dots; each also has a halo behind it. */
function recordDots(root: any) {
  return root.root
    .findAllByType(Circle)
    .filter((circle: any) => circle.props.color === COLORS.primaryContainer);
}

function gridlines(root: any) {
  return root.root.findAllByType(Line).map((line: any) => line.props);
}

function axisLabels(root: any) {
  return root.root.findAllByType(SkiaText).map((text: any) => text.props);
}

function valueLabels(root: any) {
  return axisLabels(root).filter((label: any) => label.y !== TIME_LABEL_BASELINE);
}

function timeLabels(root: any) {
  return axisLabels(root).filter((label: any) => label.y === TIME_LABEL_BASELINE);
}

/** A label is drawn from its left edge, so its middle is half a text width along. */
function labelCentre(label: any): number {
  return label.x + (label.text.length * GLYPH_WIDTH) / 2;
}

// The chart draws its curve inside PLOT, so the points built by
// `points(10, 20, 15, 25)` land at these screen coordinates: x spread evenly
// across the plotting rectangle's width, y inverted across the value range.
//   index 0 (y=10, min): screen (24, 94)
//   index 1 (y=20):      screen (114.7, 35.3)
//   index 2 (y=15):      screen (205.3, 64.7)
//   index 3 (y=25, max): screen (296, 6)
function press(root: any, locationX: number, locationY: number) {
  const pressable = root.root.findByProps({testID: 'numeric-trend-chart-pressable'});
  act(() => {
    pressable.props.onPress({nativeEvent: {locationX, locationY}});
  });
}

describe('NumericTrendChart', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // The typeface resolves asynchronously on device, so the default state of a
    // freshly mounted chart is "font not ready yet".
    vi.mocked(useFont).mockReturnValue(null);
    vi.spyOn(Skia.Path, 'Make').mockImplementation(() => {
      linePath = makePathStub();
      return linePath as any;
    });
  });

  it('builds a smooth line with a single moveTo and a cubicTo for each remaining point', () => {
    render(points(10, 20, 15, 25));

    expect(Skia.Path.Make).toHaveBeenCalledTimes(1);
    expect(linePath.moveTo).toHaveBeenCalledTimes(1);
    expect(linePath.cubicTo).toHaveBeenCalledTimes(3);
    // The line itself is a pure curve; only the derived fill closes to a baseline.
    expect(linePath.lineTo).not.toHaveBeenCalled();
  });

  it('derives a gradient area path that closes the curve down to the plot baseline', () => {
    render(points(10, 20, 15, 25));

    expect(linePath.copy).toHaveBeenCalledTimes(1);
    // Down to the baseline under the last point, across to the first, then close —
    // at the plot's bottom edge, not the canvas's, so the fill stops above the
    // time labels.
    expect(areaPath.lineTo).toHaveBeenCalledTimes(2);
    expect(areaPath.lineTo).toHaveBeenNthCalledWith(1, expect.any(Number), PLOT.bottom);
    expect(areaPath.lineTo).toHaveBeenNthCalledWith(2, expect.any(Number), PLOT.bottom);
    expect(areaPath.close).toHaveBeenCalledTimes(1);
  });

  it('draws one record marker dot per point so the tap targets are visible', () => {
    const root = render(points(10, 20, 15, 25));

    expect(recordDots(root).length).toBe(4);
  });

  it('insets the plotted curve into the axis gutters', () => {
    const root = render(points(10, 20, 15, 25));
    const dots = recordDots(root);

    // The curve no longer spans the full box: it starts clear of the value-label
    // column and stops short of the right edge, and its lowest point rests on the
    // plot's baseline rather than running into the time-label strip.
    expect(dots[0].props.cx).toBe(PLOT.left);
    expect(dots[dots.length - 1].props.cx).toBe(PLOT.right);
    expect(Math.max(...dots.map((dot: any) => dot.props.cy))).toBe(PLOT.bottom);
    expect(Math.min(...dots.map((dot: any) => dot.props.cy))).toBe(PLOT.top);
  });

  it('scales x across the time window so leading and trailing gaps stay visible', () => {
    // A 30-day window whose data is clustered around days 5-7: there is empty
    // space both before the first Record and after the last.
    const timeRange: TimeRange = {start: new Date(0), end: new Date(30 * DAY_MS)};
    const chartPoints: MetricSeriesPoint[] = [5, 6, 7].map(day => ({
      x: day * DAY_MS,
      y: 10 + day,
      recordId: `r${day}`,
    }));

    const root = render(chartPoints, vi.fn(), timeRange);
    const dots = recordDots(root);

    // Day 5 of 30 and day 7 of 30, measured across the plotting rectangle rather
    // than the full chart box — both far from its right edge.
    expect(dots[0].props.cx).toBeCloseTo(PLOT.left + (5 / 30) * PLOT_WIDTH);
    expect(dots[dots.length - 1].props.cx).toBeCloseTo(PLOT.left + (7 / 30) * PLOT_WIDTH);
  });

  it('renders the insufficient-data message and no path for a single point', () => {
    const root = render(points(10));

    expect(Skia.Path.Make).not.toHaveBeenCalled();
    expect(findAllByText(root.root, NUMERIC_TREND_INSUFFICIENT_MESSAGE).length).toBeGreaterThan(0);
  });

  it('renders the insufficient-data message and no path for zero points', () => {
    const root = render(points());

    expect(Skia.Path.Make).not.toHaveBeenCalled();
    expect(findAllByText(root.root, NUMERIC_TREND_INSUFFICIENT_MESSAGE).length).toBeGreaterThan(0);
  });

  it('draws no axis at all in the insufficient-data state', () => {
    loadFont();

    const root = render(points(10));

    expect(gridlines(root).length).toBe(0);
    expect(axisLabels(root).length).toBe(0);
  });

  it('opens the record nearest a tap in the middle of the chart', () => {
    const onPointPress = vi.fn();
    const root = render(points(10, 20, 15, 25), onPointPress);

    // Nearest the third point at screen (205.3, 64.7).
    press(root, 205, 65);

    expect(onPointPress).toHaveBeenCalledWith('r2');
  });

  it('resolves a tap near the start of the curve to the first record', () => {
    const onPointPress = vi.fn();
    const root = render(points(10, 20, 15, 25), onPointPress);

    // Nearest the first point at screen (24, 94) — inside the plot, not at the
    // chart box's own left edge.
    press(root, PLOT.left, PLOT.bottom);

    expect(onPointPress).toHaveBeenCalledWith('r0');
  });

  it('resolves a tap near the end of the curve to the last record', () => {
    const onPointPress = vi.fn();
    const root = render(points(10, 20, 15, 25), onPointPress);

    // Nearest the last point at screen (296, 6).
    press(root, PLOT.right, PLOT.top);

    expect(onPointPress).toHaveBeenCalledWith('r3');
  });

  it('ignores a tap that falls outside the vertical tolerance of its nearest point', () => {
    const onPointPress = vi.fn();
    const root = render(points(10, 20, 15, 25), onPointPress);

    // Horizontally nearest the first point (screen y 94), but tapped at the very
    // top of the chart — far above the curve, so it selects nothing.
    press(root, PLOT.left, 0);

    expect(onPointPress).not.toHaveBeenCalled();
  });

  it('keeps hit-testing against the plotting rectangle once the axis labels are drawn', () => {
    loadFont();
    const onPointPress = vi.fn();
    const root = render(points(10, 20, 15, 25), onPointPress);

    press(root, PLOT.left, PLOT.bottom);
    press(root, PLOT.right, PLOT.top);

    expect(onPointPress).toHaveBeenNthCalledWith(1, 'r0');
    expect(onPointPress).toHaveBeenNthCalledWith(2, 'r3');
  });

  it('renders no pressable for a single point and never opens a record', () => {
    const onPointPress = vi.fn();
    const root = render(points(10), onPointPress);

    expect(root.root.findAllByProps({testID: 'numeric-trend-chart-pressable'}).length).toBe(0);
    expect(onPointPress).not.toHaveBeenCalled();
  });

  it('renders no pressable for zero points and never opens a record', () => {
    const onPointPress = vi.fn();
    const root = render(points(), onPointPress);

    expect(root.root.findAllByProps({testID: 'numeric-trend-chart-pressable'}).length).toBe(0);
    expect(onPointPress).not.toHaveBeenCalled();
  });
});

describe('NumericTrendChart axes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(useFont).mockReturnValue(null);
    vi.spyOn(Skia.Path, 'Make').mockImplementation(() => {
      linePath = makePathStub();
      return linePath as any;
    });
  });

  it('draws the curve but no axis while the font is still loading', () => {
    const root = render(points(10, 20, 15, 25));

    expect(gridlines(root).length).toBe(0);
    expect(axisLabels(root).length).toBe(0);
    // The chart is never blank while it waits: the curve and its markers are
    // already there.
    expect(Skia.Path.Make).toHaveBeenCalledTimes(1);
    expect(recordDots(root).length).toBe(4);
  });

  it('draws five value gridlines across the plot once the font resolves', () => {
    loadFont();

    const root = render(points(10, 20, 15, 25));
    const lines = gridlines(root);

    expect(lines.length).toBe(5);
    // Evenly spaced across the same value domain the curve is scaled against,
    // and horizontal only — no vertical gridlines rise from the time labels.
    expect(lines.map((line: any) => line.p1.y)).toEqual([94, 72, 50, 28, 6]);
    lines.forEach((line: any) => {
      expect(line.p1.x).toBe(PLOT.left);
      expect(line.p2.x).toBe(PLOT.right);
      expect(line.p2.y).toBe(line.p1.y);
    });
  });

  it('labels each gridline with its own value, right-aligned into the left gutter', () => {
    loadFont();

    const root = render(points(10, 20, 15, 25));
    const labels = valueLabels(root);

    // The series runs 10 to 25, so the five gridlines name that range.
    expect(labels.map((label: any) => label.text)).toEqual(['10', '13.8', '17.5', '21.3', '25']);
    labels.forEach((label: any) => {
      expect(label.x + label.text.length * GLYPH_WIDTH).toBeLessThanOrEqual(PLOT.left);
      expect(label.color).toBe(COLORS.onSurfaceVariant);
    });
  });

  it('scales each chart to its own value range rather than a shared one', () => {
    loadFont();

    const dense = valueLabels(render(points(10, 20, 15, 25)));
    const sparse = valueLabels(render(points(1000, 1200, 1100, 1400)));

    expect(dense.map((label: any) => label.text)).not.toEqual(
      sparse.map((label: any) => label.text),
    );
    expect(sparse.map((label: any) => label.text)).toEqual([
      '1000',
      '1100',
      '1200',
      '1300',
      '1400',
    ]);
  });

  it('labels a one-day window with eight hours of the day, none at either edge', () => {
    loadFont();
    const start = new Date(2026, 6, 13);
    const timeRange: TimeRange = {start, end: new Date(start.getTime() + DAY_MS)};

    const labels = timeLabels(render(points(10, 20, 15, 25), vi.fn(), timeRange));

    expect(labels.map((label: any) => label.text)).toEqual([
      '1',
      '4',
      '7',
      '10',
      '13',
      '16',
      '19',
      '22',
    ]);
    // Every label is centred within its own slice, so the row sits inset from
    // both edges — and by matching margins, since the outer two slices are the
    // same width.
    const firstLabel = labels[0];
    const lastLabel = labels[labels.length - 1];
    expect(firstLabel.x).toBeGreaterThan(PLOT.left);
    expect(lastLabel.x + lastLabel.text.length * GLYPH_WIDTH).toBeLessThan(PLOT.right);
    expect(labelCentre(firstLabel) - PLOT.left).toBeCloseTo(PLOT.right - labelCentre(lastLabel));
  });

  it('labels a one-week window with a weekday initial per day', () => {
    loadFont();
    const start = new Date(2026, 6, 13);
    const timeRange: TimeRange = {start, end: new Date(start.getTime() + 7 * DAY_MS)};

    const labels = timeLabels(render(points(10, 20, 15, 25), vi.fn(), timeRange));

    expect(labels.map((label: any) => label.text)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('labels a one-month window with five short dates pinned to its endpoints', () => {
    loadFont();
    const start = new Date(2026, 5, 19);
    const timeRange: TimeRange = {start, end: new Date(start.getTime() + 30 * DAY_MS)};

    const labels = timeLabels(render(points(10, 20, 15, 25), vi.fn(), timeRange));

    expect(labels.length).toBe(5);
    // The first and last ticks sit exactly at the window's start and end, so they
    // are aligned inwards instead of centred — otherwise they'd overflow the card.
    const lastLabel = labels[4];
    expect(labels[0].x).toBe(PLOT.left);
    expect(lastLabel.x + lastLabel.text.length * GLYPH_WIDTH).toBe(PLOT.right);
  });

  it('labels a year-long window with two-digit years', () => {
    loadFont();
    const start = new Date(2025, 6, 19);
    const timeRange: TimeRange = {start, end: new Date(start.getTime() + 365 * DAY_MS)};

    const labels = timeLabels(render(points(10, 20, 15, 25), vi.fn(), timeRange));

    expect(labels.length).toBe(5);
    labels.forEach((label: any) => {
      expect(label.text).toMatch(/^\w+ '\d{2}$/);
    });
  });

  it('re-labels the axes when the selected window changes', () => {
    loadFont();
    const start = new Date(2026, 6, 13);
    const day: TimeRange = {start, end: new Date(start.getTime() + DAY_MS)};
    const month: TimeRange = {start, end: new Date(start.getTime() + 30 * DAY_MS)};
    const chartPoints = points(10, 20, 15, 25);

    let root: any;
    act(() => {
      root = renderer.create(
        <NumericTrendChart
          metric={metric}
          points={chartPoints}
          timeRange={day}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          onPointPress={vi.fn()}
        />,
      );
    });
    expect(timeLabels(root).length).toBe(8);

    act(() => {
      root.update(
        <NumericTrendChart
          metric={metric}
          points={chartPoints}
          timeRange={month}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          onPointPress={vi.fn()}
        />,
      );
    });

    // The same reactive pass that redraws the curve relabels the axis: an hour
    // scale becomes a month one, with no separate refresh.
    expect(timeLabels(root).map((label: any) => label.text)).toHaveLength(5);
    expect(timeLabels(root).every((label: any) => /\d/.test(label.text))).toBe(true);
  });
});
