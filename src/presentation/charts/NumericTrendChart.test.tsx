import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import renderer, {act} from 'react-test-renderer';
import {Skia} from '@shopify/react-native-skia';
import {NumericTrendChart} from './NumericTrendChart';
import {NUMERIC_TREND_INSUFFICIENT_MESSAGE} from './chartDefaults';
import {MetricSeriesPoint} from '../../application/GetMetricSeriesUseCase';
import {Metric} from '../../domain/Metric';

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

function render(chartPoints: MetricSeriesPoint[]) {
  let root: any;
  act(() => {
    root = renderer.create(
      <NumericTrendChart metric={metric} points={chartPoints} width={300} height={90}/>,
    );
  });
  return root!;
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
});
