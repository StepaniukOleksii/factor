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
