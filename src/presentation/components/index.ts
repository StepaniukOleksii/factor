/**
 * Shared UI Components
 *
 * This is the central registry of all reusable components.
 * Always check here before creating a new UI Component
 *
 */

/** Primary call-to-action button with loading state and icon support - used for main screen actions **/
export {PrimaryActionButton} from './PrimaryActinButton';
/** Ports interface for PrimaryActionButton component **/
export {PrimaryActinButtonProps} from './PrimaryActinButton';

/** Screen header with title, and optional back button on the left and action button on the right - used for screens **/
export {ScreenHeader} from './ScreenHeader';
/** Props interface for ScreenHeader component **/
export {ScreenHeaderProps} from './ScreenHeader';

/** Labeled text input with optional character counter and inline error - used for form fields across screens **/
export {LabeledTextField} from './LabeledTextField';
/** Props interface for LabeledTextField component **/
export {LabeledTextFieldProps} from './LabeledTextField';