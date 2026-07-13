/**
 * Border-radius scale. Reference these instead of raw numbers so a component's
 * corner rounding is a deliberate choice on a shared ramp rather than an ad-hoc
 * literal.
 *
 * Circular elements (e.g. a 40×40 icon button rounded to a full circle) stay as
 * literal `size / 2` values — they are not steps on this scale.
 */
export const RADIUS = {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 24,
} as const;
