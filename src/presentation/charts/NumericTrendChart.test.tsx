import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Circle, Skia} from '@shopify/react-native-skia';
import {NumericTrendChart} from './NumericTrendChart';
import {NUMERIC_TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import {MetricSeriesPoint} from '../../application/GetMetricSeriesUseCase';
import {Metric} from '../../domain/Metric';
import {COLORS} from '@presentation/theme';

vi.mock('react-native', () => require('react-native-web'));

const metric = new Metric('m1', 'Duration', 'Numeric');

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

function points(...values: number[]): MetricSeriesPoint[] {
  return values.map((y, index) => ({x: index * 1000, y, recordId: `r${index}`}));
}

function findAllByText(root: any, text: string) {
  return root.findAll(
    (node: any) => node.children && node.children.length === 1 && node.children[0] === text,
  );
}

function render(chartPoints: MetricSeriesPoint[], onPointPress = vi.fn()) {
  let root: any;
  act(() => {
    root = renderer.create(
      <NumericTrendChart
        metric={metric}
        points={chartPoints}
        width={300}
        height={90}
        onPointPress={onPointPress}
      />,
    );
  });
  return root!;
}

// The chart is drawn in a 300x90 box with 6px vertical padding, so the points
// built by `points(10, 20, 15, 25)` land at these screen coordinates: x is
// spread evenly across the width, y is inverted across the value range.
//   index 0 (y=10, min): screen (0, 84)
//   index 1 (y=20):      screen (100, 32)
//   index 2 (y=15):      screen (200, 58)
//   index 3 (y=25, max): screen (300, 6)
function press(root: any, locationX: number, locationY: number) {
  const pressable = root.root.findByProps({testID: 'numeric-trend-chart-pressable'});
  act(() => {
    pressable.props.onPress({nativeEvent: {locationX, locationY}});
  });
}

describe('NumericTrendChart', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('derives a gradient area path that closes the curve down to the baseline', () => {
    render(points(10, 20, 15, 25));

    expect(linePath.copy).toHaveBeenCalledTimes(1);
    // Down to the baseline under the last point, across to the first, then close.
    expect(areaPath.lineTo).toHaveBeenCalledTimes(2);
    expect(areaPath.close).toHaveBeenCalledTimes(1);
  });

  it('draws one record marker dot per point so the tap targets are visible', () => {
    const root = render(points(10, 20, 15, 25));

    // The line-coloured circles are the record dots (each also has a halo circle
    // in the card colour); one dot per aggregated point.
    const dots = root.root
      .findAllByType(Circle)
      .filter((circle: any) => circle.props.color === COLORS.primaryContainer);
    expect(dots.length).toBe(4);
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

  it('opens the record nearest a tap in the middle of the chart', () => {
    const onPointPress = vi.fn();
    const root = render(points(10, 20, 15, 25), onPointPress);

    // Nearest the third point at screen (200, 58).
    press(root, 200, 58);

    expect(onPointPress).toHaveBeenCalledWith('r2');
  });

  it('resolves a tap near the start of the curve to the first record', () => {
    const onPointPress = vi.fn();
    const root = render(points(10, 20, 15, 25), onPointPress);

    // Nearest the first point at screen (0, 84).
    press(root, 0, 84);

    expect(onPointPress).toHaveBeenCalledWith('r0');
  });

  it('resolves a tap near the end of the curve to the last record', () => {
    const onPointPress = vi.fn();
    const root = render(points(10, 20, 15, 25), onPointPress);

    // Nearest the last point at screen (300, 6).
    press(root, 300, 6);

    expect(onPointPress).toHaveBeenCalledWith('r3');
  });

  it('ignores a tap that falls outside the vertical tolerance of its nearest point', () => {
    const onPointPress = vi.fn();
    const root = render(points(10, 20, 15, 25), onPointPress);

    // Horizontally nearest the first point (screen y 84), but tapped at the very
    // top of the chart — far above the curve, so it selects nothing.
    press(root, 0, 0);

    expect(onPointPress).not.toHaveBeenCalled();
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
