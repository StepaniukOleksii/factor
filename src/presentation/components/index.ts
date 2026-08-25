/**
 * Shared UI Components
 *
 * The central registry of every reusable component. Always check here before
 * creating a new one; a component added elsewhere is invisible to this catalog
 * and gets duplicated.
 */

/** Primary call-to-action button with loading state and icon support - used for main screen actions */
export {PrimaryActionButton} from './PrimaryActinButton';
export {PrimaryActinButtonProps} from './PrimaryActinButton';

/** Screen header with title, and optional back button on the left and action button on the right - used for screens */
export {ScreenHeader} from './ScreenHeader';
export {ScreenHeaderProps} from './ScreenHeader';

/** Labeled text input with optional character counter and inline error - used for form fields across screens */
export {LabeledTextField} from './LabeledTextField';
export {LabeledTextFieldProps} from './LabeledTextField';

/** Labeled row of single-select segments, deselectable, with an inline error - used for form fields choosing one of a few fixed values, or none */
export {SegmentedField} from './SegmentedField';
export {SegmentedFieldProps, SegmentedFieldOption} from './SegmentedField';

/** Labeled field opening a modal list of options - used for form fields choosing one value from more options than segments can hold */
export {SelectField} from './SelectField';
export {SelectFieldProps, SelectFieldOption} from './SelectField';

/** Dashed outline button appending one more of something to a form - used for Add Metric and Add Value */
export {DashedButton} from './DashedButton';
export {DashedButtonProps} from './DashedButton';

/** Editor for one Metric of an Observation - used by the forms that declare an Observation and that edit one */
export {MetricEditorCard, EMPTY_METRIC, toMetricDraft} from './MetricEditorCard';
export {MetricEditorCardProps, MetricDraft} from './MetricEditorCard';

/** Centered modal dialog - use when an action from user is needed */
export {Dialog} from './Dialog';
export {DialogProps, DialogAction} from './Dialog';

/** Info button opening a dialog that explains the field it sits in - used inside a form field's label row */
export {FieldHelpButton} from './FieldHelpButton';
export {FieldHelpButtonProps} from './FieldHelpButton';

/** Full-screen safe-area root wrapper (app background + Android status-bar padding) - outermost element of every screen */
export {ScreenContainer} from './ScreenContainer';
export {ScreenContainerProps} from './ScreenContainer';

/** Centered full-height state - a loading spinner, or a short message for empty/not-found fallbacks */
export {CenteredState} from './CenteredState';
export {CenteredStateProps} from './CenteredState';

/** Fixed bottom action bar that hosts a screen's primary call-to-action - translucent with a top divider */
export {FooterBar} from './FooterBar';
export {FooterBarProps} from './FooterBar';

/** Bottom padding a scrolling screen must reserve so its last element clears the FooterBar floating over it */
export {useFooterClearance} from './FooterBar';

/** System chrome below `bottom: 0` that a screen's own floating elements must clear - the Android navigation bar */
export {useBottomInset} from './useBottomInset';
