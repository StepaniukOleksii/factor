import type {TimeRange} from '../application/GetMetricSeriesUseCase';

/**
 * A calendar day as a short, year-less label (e.g. "Jul 15"), mirroring how
 * `formatRelativeTime` renders dates outside the last week. The exact wording
 * follows the device locale, so the same day may read as "15 Jul" elsewhere.
 */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString([], {month: 'short', day: 'numeric'});
}

/**
 * A time-of-day as a short, locale-formatted label (e.g. "8:15 AM"), mirroring
 * how `formatRelativeTime` renders the time portion of a timestamp.
 */
export function formatShortTime(date: Date): string {
  return date.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
}

/**
 * A time range as the two calendar days it covers (e.g. "Jul 15 – Jul 18").
 *
 * `range.end` is the exclusive half-open boundary — the start of the day *after*
 * the last day the user selected, not a day they actually picked — so it is
 * stepped back one millisecond before formatting. A Start=Jul 15/End=Jul 18
 * selection is stored as `{start: Jul 15 00:00, end: Jul 19 00:00}` and must
 * display as "Jul 15 – Jul 18", not "Jul 15 – Jul 19".
 */
export function formatTimeRange(range: TimeRange): string {
  const lastIncludedDay = new Date(range.end.getTime() - 1);
  return `${formatShortDate(range.start)} – ${formatShortDate(lastIncludedDay)}`;
}
