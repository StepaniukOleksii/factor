/**
 * Vitest mock for `@shopify/react-native-skia`.
 *
 * Skia ships native bindings that cannot load in the Node test environment
 * (see ADR-1). This module stands in for the primitives that chart components
 * will reach for, so those components can be imported and rendered under Vitest
 * without touching native code. It is activated globally in `vitest.setup.ts`.
 *
 * Extend this as later visualization slices use more Skia primitives.
 */
import type {ReactNode} from 'react';

type StubProps = {children?: ReactNode};

const createStubComponent = (name: string) => {
  const Stub = ({children}: StubProps): ReactNode => children ?? null;
  Stub.displayName = `SkiaMock(${name})`;
  return Stub;
};

export const Canvas = createStubComponent('Canvas');
export const Group = createStubComponent('Group');
export const Path = createStubComponent('Path');
export const Line = createStubComponent('Line');
export const Circle = createStubComponent('Circle');
export const Rect = createStubComponent('Rect');
export const Text = createStubComponent('Text');

export interface SkiaPathStub {
  moveTo(x: number, y: number): SkiaPathStub;
  lineTo(x: number, y: number): SkiaPathStub;
  cubicTo(...args: number[]): SkiaPathStub;
  quadTo(...args: number[]): SkiaPathStub;
  addCircle(x: number, y: number, radius: number): SkiaPathStub;
  addRect(rect: unknown): SkiaPathStub;
  close(): SkiaPathStub;
  reset(): SkiaPathStub;
  copy(): SkiaPathStub;
}

const createPathStub = (): SkiaPathStub => {
  const path = {} as SkiaPathStub;
  const chain = () => path;
  Object.assign(path, {
    moveTo: chain,
    lineTo: chain,
    cubicTo: chain,
    quadTo: chain,
    addCircle: chain,
    addRect: chain,
    close: chain,
    reset: chain,
    copy: () => createPathStub(),
  });
  return path;
};

export const Skia = {
  Path: {
    Make: (): SkiaPathStub => createPathStub(),
  },
};

export const useFont = (): null => null;
export const useCanvasRef = (): {current: null} => ({current: null});
