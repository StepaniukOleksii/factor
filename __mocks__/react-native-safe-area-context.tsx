/**
 * Vitest mock for `react-native-safe-area-context`.
 *
 * The package ships native bindings that cannot load in the Node test
 * environment, the same problem `@shopify/react-native-skia` has (see ADR-1).
 * React Navigation reaches for it through `SafeAreaProviderCompat`, so any test
 * rendering the navigator pulls it in. It is activated globally in
 * `vitest.setup.ts`.
 *
 * Insets are reported as zero throughout. Screens do not consume this package -
 * `ScreenContainer` uses React Native's own `SafeAreaView` plus explicit
 * Android status-bar padding (see ADR-2) - so nothing under test depends on
 * real inset values.
 */
import React, {type ReactNode} from 'react';

export interface EdgeInsets {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ZERO_INSETS: EdgeInsets = {top: 0, left: 0, right: 0, bottom: 0};

/**
 * Defaulted rather than left null so `SafeAreaProviderCompat` takes its
 * "insets already available" branch and renders a plain View, keeping the
 * rendered tree the same shape on every run.
 */
export const SafeAreaInsetsContext = React.createContext<EdgeInsets | null>(ZERO_INSETS);

export const initialWindowMetrics: {frame: Rect; insets: EdgeInsets} = {
  frame: {x: 0, y: 0, width: 0, height: 0},
  insets: ZERO_INSETS,
};

export function SafeAreaProvider({children}: {children?: ReactNode}): ReactNode {
  return children ?? null;
}

export function SafeAreaView({children}: {children?: ReactNode}): ReactNode {
  return children ?? null;
}

export const useSafeAreaInsets = (): EdgeInsets => ZERO_INSETS;

export const useSafeAreaFrame = (): Rect => initialWindowMetrics.frame;
