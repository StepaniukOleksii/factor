/**
 * Derives a translucent `rgba()` string from a solid hex color token.
 *
 * Use this for scrims, gradient fills, and faded borders instead of hardcoding
 * an `rgba(...)` literal, so the translucent variant stays tied to its source
 * token in `COLORS` and can't silently drift out of sync with it.
 *
 * @param hex   A `#rgb` or `#rrggbb` color (typically a `COLORS` token).
 * @param alpha Opacity in the range 0–1.
 */
export function withAlpha(hex: string, alpha: number): string {
    const normalized = hex.replace('#', '');
    const full = normalized.length === 3
        ? normalized.split('').map(c => c + c).join('')
        : normalized;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
