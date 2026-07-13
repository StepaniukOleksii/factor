/**
 * Color design tokens for the presentation layer.
 *
 * These are the app's Material color roles (dark scheme). Import from here
 * (via the `@presentation/theme` barrel) instead of re-declaring a local
 * `COLORS` object in each screen/component.
 */
export const COLORS = {
    background: '#131313',
    surface: '#131313',
    onSurface: '#e5e2e1',
    onSurfaceVariant: '#c2c9b9',
    surfaceContainerLowest: '#0e0e0e',
    surfaceContainerLow: '#1c1b1b',
    surfaceContainerHigh: '#2a2a2a',
    surfaceContainerHighest: '#353534',
    outlineVariant: '#42493d',
    outline: '#8c9385',
    primary: '#f9fff0',
    onPrimary: '#0b3900',
    primaryContainer: '#b6f09c',
    onPrimaryContainer: '#3c6f2a',
    onPrimaryFixedVariant: '#205110',
    error: '#ffb4ab',
    onError: '#690005',
} as const;
