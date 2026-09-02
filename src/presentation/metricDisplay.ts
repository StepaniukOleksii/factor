import type {EnumConstraint, MetricValueType, NumericConstraint} from '../domain/Metric';
import type {SegmentedFieldOption} from './components';

/**
 * The two answers a Boolean Metric offers, in the order they are presented.
 *
 * The single source of the wording: the Record form renders these as its
 * segments, and a stored value is displayed by looking its option up here - so a
 * Record can never read back as `true`/`false`, words the user was never shown.
 */
export const BOOLEAN_METRIC_OPTIONS: SegmentedFieldOption<boolean>[] = [
    {value: true, label: 'Yes'},
    {value: false, label: 'No'},
];

/**
 * The choices an Enum Metric offers, in the order they were declared - and none
 * at all for a Metric holding no constraint, which accepts no value either.
 *
 * Beside `BOOLEAN_METRIC_OPTIONS` for the reason stated there: one source for
 * the words a Record can read back as.
 */
export function toEnumOptions(constraint: EnumConstraint | null): SegmentedFieldOption<string>[] {
    return (constraint?.allowedValues ?? []).map(value => ({value, label: value}));
}

/** Shown in place of a Metric a Record holds no value for. */
const MISSING_VALUE = '-';

/**
 * The picker row returning a Metric to unanswered, and what its field reads
 * while it is. A word rather than `MISSING_VALUE`'s dash, because this one is
 * tapped and read as a choice, where that one only ever fills a column.
 */
export const NO_METRIC_VALUE = 'None';

/**
 * How each Metric type is named to the user. The domain's own names are
 * developer vocabulary; `Boolean` and `Enum` in particular name data types
 * rather than what they offer, so they are offered as "Yes/No" and "Choice"
 * instead.
 */
const METRIC_TYPE_LABELS: Record<MetricValueType, string> = {
    Numeric: 'Numeric',
    Boolean: 'Yes/No',
    Enum: 'Choice',
    Text: 'Text',
};

export function formatMetricType(type: MetricValueType): string {
    return METRIC_TYPE_LABELS[type];
}

/**
 * How a Metric is named to a user: its name, and what its numbers count after
 * it.
 *
 * Takes the name rather than the Metric so the caller keeps the casing: an
 * expanded Record's column header uppercases the name, and `KCAL/D` is not the
 * unit `kcal/d` is.
 */
export function formatMetricLabel(name: string, unit: string | null): string {
    return unit ? `${name} (${unit})` : name;
}

/**
 * A stored Metric value as the user should read it, or a placeholder when the
 * Record holds none. `false` is a value like any other - only a missing one gets
 * the placeholder.
 *
 * A value that doesn't match its Metric's type is shown as-is rather than hidden
 * or guessed at, so bad data stays visible.
 */
export function formatMetricValue(type: MetricValueType, value: unknown): string {
    if (value === undefined || value === null) {
        return MISSING_VALUE;
    }
    if (type === 'Boolean') {
        const option = BOOLEAN_METRIC_OPTIONS.find(candidate => candidate.value === value);
        return option ? option.label : String(value);
    }
    return String(value);
}

/**
 * The range a Numeric Metric accepts, as its input states it before anything is
 * typed - or `undefined` when the Metric declares no bounds, so no placeholder
 * is shown at all.
 */
export function formatMetricRange(constraint: NumericConstraint | null): string | undefined {
    const min = constraint?.min;
    const max = constraint?.max;
    if (min !== undefined && max !== undefined) {
        return `${min}-${max}`;
    }
    if (min !== undefined) {
        return `Min ${min}`;
    }
    if (max !== undefined) {
        return `Max ${max}`;
    }
    return undefined;
}

/** A bound nothing was typed into is unset rather than zero. */
export function formatTypedRange(min: string, max: string): string | undefined {
    const bound = (text: string) => text.trim() === '' ? undefined : Number(text);
    return formatMetricRange({min: bound(min), max: bound(max)});
}

/**
 * Why a value was refused, naming the bound it broke - or `undefined` for an
 * unbounded Metric, whose values break none.
 */
export function formatRangeError(constraint: NumericConstraint | null): string | undefined {
    const min = constraint?.min;
    const max = constraint?.max;
    if (min !== undefined && max !== undefined) {
        return `Must be between ${min} and ${max}`;
    }
    if (min !== undefined) {
        return `Must be at least ${min}`;
    }
    if (max !== undefined) {
        return `Must be at most ${max}`;
    }
    return undefined;
}
