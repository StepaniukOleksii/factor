import {formatShortTime} from './formatTimeRange';

export function formatRelativeTime(date: Date): string {
    const now = new Date();
    const timeStr = formatShortTime(date);

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today.getTime() - targetDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return `Today, ${timeStr}`;
    if (diffDays === 1) return `Yesterday, ${timeStr}`;
    if (diffDays > 1 && diffDays < 7) {
        return `${date.toLocaleDateString([], {weekday: 'short'})}, ${timeStr}`;
    }
    return `${date.toLocaleDateString([], {month: 'short', day: 'numeric'})}, ${timeStr}`;
}
