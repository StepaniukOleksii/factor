/**
 * Vitest mock for `react-native-safe-area-context`.
 *
 * Native bindings that cannot load under Node (see ADR-1). React Navigation
 * reaches for it through `SafeAreaProviderCompat`, so any test rendering the
 * navigator pulls it in. Activated globally in `vitest.setup.ts`.
 *
 * Insets are zero throughout, which renders every screen as if it had no system
 * chrome below it. Screens reach them only through `useBottomInset`, and no test
 * here asserts on the spacing that derives - `FooterBar.test.tsx` replaces this
 * mock with its own to cover that (see ADR-2).
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
