import type {MetricValueType} from '../domain/Metric';
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

/** Shown in place of a Metric a Record holds no value for. */
const MISSING_VALUE = '-';

/**
 * How each Metric type is named to the user. The domain's own names are
 * developer vocabulary; `Boolean` in particular names a data type rather than
 * the choice it presents, so it is offered as "Yes/No" instead.
 */
const METRIC_TYPE_LABELS: Record<MetricValueType, string> = {
    Numeric: 'Numeric',
    Boolean: 'Yes/No',
    Enum: 'Enum',
    Text: 'Text',
};

export function formatMetricType(type: MetricValueType): string {
    return METRIC_TYPE_LABELS[type];
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
