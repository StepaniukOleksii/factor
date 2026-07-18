import {describe, expect, it} from 'vitest';
import {formatShortDate, formatTimeRange} from './formatTimeRange';

// Both formatters follow the device locale, exactly as `formatRelativeTime`
// does, so these assert what the output is made of rather than pinning one
// locale's word order - "Jul 15" and "15 Jul" are both correct renderings of
// the same day.
const JUL_15 = new Date(2026, 6, 15);
const JUL_18 = new Date(2026, 6, 18);
const JUL_19 = new Date(2026, 6, 19);

/** Jul 15 through Jul 18, as the half-open range the app stores it. */
const JUL_15_THROUGH_18 = {start: JUL_15, end: JUL_19};

describe('formatShortDate', () => {
  it('names the month and the day', () => {
    const formatted = formatShortDate(JUL_15);

    expect(formatted).toContain('15');
    expect(formatted).toContain(JUL_15.toLocaleDateString([], {month: 'short'}));
  });

  it('leaves out the year and the time of day', () => {
    const formatted = formatShortDate(new Date(2026, 6, 15, 13, 45));

    expect(formatted).not.toContain('2026');
    expect(formatted).not.toContain('13');
    expect(formatted).not.toContain('45');
  });
});

describe('formatTimeRange', () => {
  it('reads as the first and the last day the range covers', () => {
    expect(formatTimeRange(JUL_15_THROUGH_18)).toBe(
      `${formatShortDate(JUL_15)} – ${formatShortDate(JUL_18)}`,
    );
  });

  // The exclusive boundary is a day the user never picked, so showing it would
  // overstate the window by a day.
  it('does not show the exclusive end boundary as a day of its own', () => {
    expect(formatTimeRange(JUL_15_THROUGH_18)).not.toContain(formatShortDate(JUL_19));
  });

  it('shows a one-day range as that day at both ends', () => {
    expect(formatTimeRange({start: JUL_18, end: JUL_19})).toBe(
      `${formatShortDate(JUL_18)} – ${formatShortDate(JUL_18)}`,
    );
  });
});
