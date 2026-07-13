/**
 * Shared design tokens for the presentation layer.
 *
 * These are the app's Material color roles (dark scheme). Import from here
 * instead of re-declaring a local `COLORS` object in each screen/component.
 */
export const COLORS = {
    background: '#131313',
    surface: '#131313',
    onSurface: '#e5e2e1',
    onSurfaceVariant: '#c2c9b9',
    surfaceContainerLowest: '#0e0e0e',
    surfaceContainerLow: '#1c1b1b',
    outlineVariant: '#42493d',
    outline: '#8c9385',
    primary: '#f9fff0',
    onPrimary: '#0b3900',
    primaryContainer: '#b6f09c',
    onPrimaryFixedVariant: '#205110',
    error: '#ffb4ab',
} as const;
