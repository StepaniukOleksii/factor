// Limits on what a user may enter: how long a text field's contents may run, and
// how many entries a repeating field may hold.
// A length is enforced in two places per field: the TextInput `maxLength` (UI)
// and the use case (defence against pastes/programmatic input, since the DB
// columns carry no length constraint).

export const OBSERVATION_NAME_MAX_LENGTH = 30;
export const METRIC_NAME_MAX_LENGTH = 15;
export const OBSERVATION_DESCRIPTION_MAX_LENGTH = 150;
export const METRIC_DESCRIPTION_MAX_LENGTH = 500;
// Nothing enforces the two Event limits: no form writes an Event yet.
export const EVENT_NAME_MAX_LENGTH = 30;
export const EVENT_DESCRIPTION_MAX_LENGTH = 150;
export const METRIC_UNIT_MAX_LENGTH = 6;
export const RECORD_NOTE_MAX_LENGTH = 150;
export const METRIC_ENUM_MAX_VALUES = 4;
export const METRIC_ENUM_VALUE_MAX_LENGTH = 12;
