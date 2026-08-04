// Maximum character lengths for user-entered text fields.
// Enforced in two places per field: the TextInput `maxLength` (UI) and the
// use case (defence against pastes/programmatic input, since the DB columns
// carry no length constraint).

export const OBSERVATION_NAME_MAX_LENGTH = 30;
export const METRIC_NAME_MAX_LENGTH = 15;
export const OBSERVATION_DESCRIPTION_MAX_LENGTH = 150;
export const METRIC_DESCRIPTION_MAX_LENGTH = 500;
export const RECORD_NOTE_MAX_LENGTH = 150;
