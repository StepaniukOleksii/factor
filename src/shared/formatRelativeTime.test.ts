import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {formatRelativeTime} from './formatRelativeTime';

const NOW = new Date(2026, 8, 9, 14, 30);

/** The label the device's own locale gives a weekday, which is what the formatter reaches for. */
function weekdayOf(date: Date): string {
  return date.toLocaleDateString([], {weekday: 'short'});
}

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('names today and yesterday', () => {
    expect(formatRelativeTime(new Date(2026, 8, 9, 9, 0))).toMatch(/^Today, /);
    expect(formatRelativeTime(new Date(2026, 8, 8, 9, 0))).toMatch(/^Yesterday, /);
  });

  it('names the weekday within the last week', () => {
    const date = new Date(2026, 8, 6, 9, 0);

    expect(formatRelativeTime(date).split(',')[0]).toBe(weekdayOf(date));
  });

  it('leaves a date of the current year outside the last week year-less', () => {
    expect(formatRelativeTime(new Date(2026, 0, 12, 9, 0))).not.toContain('2026');
  });

  it('carries the year for a date outside the last week in another year', () => {
    expect(formatRelativeTime(new Date(2025, 7, 5, 9, 0))).toContain('2025');
  });

  it('keeps the weekday wording for a date within the last week that falls in another year', () => {
    vi.setSystemTime(new Date(2026, 0, 2, 14, 30));
    const date = new Date(2025, 11, 30, 9, 0);

    expect(formatRelativeTime(date).split(',')[0]).toBe(weekdayOf(date));
    expect(formatRelativeTime(date)).not.toContain('2025');
  });
});
