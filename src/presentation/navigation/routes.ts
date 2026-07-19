/**
 * Every screen the app's stack can hold, paired with the parameters it is
 * opened with. React Navigation derives its own types from this, so a screen's
 * `route.params` and every `navigate` call are checked against it - adding a
 * screen means adding it here first.
 */
export type RootStackParamList = {
    ObservationList: undefined;
    CreateObservation: undefined;
    ObservationDetails: {observationId: string};
    CreateRecord: {observationId: string};
    EditRecord: {observationId: string; recordId: string};
};
