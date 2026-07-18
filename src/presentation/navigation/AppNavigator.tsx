import React, {useState} from 'react';
import {ObservationListScreen} from '../screens/ObservationListScreen';
import {CreateObservationScreen} from '../screens/CreateObservationScreen';
import {RecordFormScreen} from '../screens/RecordFormScreen';
import {ObservationDetailsScreen} from '../screens/ObservationDetailsScreen';
import {DEFAULT_TIME_RANGE_SELECTION, type TimeRangeSelection} from '../charts/chartDefaults';

type ScreenState =
    | { name: 'ObservationList' }
    | { name: 'CreateObservation' }
    | { name: 'CreateRecord'; observationId: string }
    | { name: 'EditRecord'; observationId: string; recordId: string }
    | { name: 'ObservationDetails'; observationId: string };

/**
 * The Observation the user is currently exploring, or `null` where they are not
 * inside one at all.
 *
 * Opening a Record from a chart point is part of exploring that Observation -
 * the chart is where the Record was tapped from, and coming back should land on
 * the same window. Stepping out to the Observation list ends the exploration,
 * and anything scoped to it goes too.
 *
 * Adding a screen to `ScreenState` makes this switch stop compiling until the
 * new screen is placed on one side or the other, so a later Observation Config
 * or Info screen - or a Home button - has to be classified deliberately rather
 * than falling into the wrong one by omission.
 */
function exploredObservationId(screen: ScreenState): string | null {
    switch (screen.name) {
        case 'ObservationDetails':
        case 'CreateRecord':
        case 'EditRecord':
            return screen.observationId;
        case 'ObservationList':
        case 'CreateObservation':
            return null;
        default:
            return assertNever(screen);
    }
}

function assertNever(screen: never): never {
    throw new Error(`Unhandled screen: ${JSON.stringify(screen)}`);
}

export function AppNavigator() {
    const [currentScreen, setCurrentScreen] = useState<ScreenState>({name: 'ObservationList'});
    // The Trends window the user picked, held here because the Details screen
    // unmounts whenever a Record is opened and so cannot carry it across the
    // trip. Scoped to one Observation's exploration by `navigate` below, and
    // session-only - nothing is persisted across app restarts.
    const [trendSelection, setTrendSelection] = useState<TimeRangeSelection>(DEFAULT_TIME_RANGE_SELECTION);

    /**
     * Every navigation goes through here, so the trend window's lifetime is
     * decided in one place instead of each way out of an Observation having to
     * remember to clear it.
     */
    const navigate = (next: ScreenState) => {
        if (exploredObservationId(next) !== exploredObservationId(currentScreen)) {
            setTrendSelection(DEFAULT_TIME_RANGE_SELECTION);
        }
        setCurrentScreen(next);
    };

    const navigateToList = () => navigate({name: 'ObservationList'});
    const navigateToCreateObservation = () => navigate({name: 'CreateObservation'});
    const navigateToCreateRecord = (observationId: string) => navigate({name: 'CreateRecord', observationId});
    const navigateToEditRecord = (observationId: string, recordId: string) => navigate({
        name: 'EditRecord',
        observationId,
        recordId
    });
    const navigateToObservationDetails = (observationId: string) => navigate({
        name: 'ObservationDetails',
        observationId
    });

    if (currentScreen.name === 'CreateObservation') {
        return (
            <CreateObservationScreen
                onBack={navigateToList}
                onCreated={navigateToList}
            />
        );
    }

    if (currentScreen.name === 'CreateRecord') {
        return (
            <RecordFormScreen
                observationId={currentScreen.observationId}
                onBack={navigateToList}
                onCreated={() => navigateToObservationDetails(currentScreen.observationId)}
            />
        );
    }

    if (currentScreen.name === 'EditRecord') {
        return (
            <RecordFormScreen
                observationId={currentScreen.observationId}
                recordId={currentScreen.recordId}
                onBack={() => navigateToObservationDetails(currentScreen.observationId)}
                onCreated={() => navigateToObservationDetails(currentScreen.observationId)}
            />
        );
    }

    if (currentScreen.name === 'ObservationDetails') {
        const {observationId} = currentScreen;
        return (
            <ObservationDetailsScreen
                observationId={observationId}
                timeRangeSelection={trendSelection}
                onTimeRangeSelectionChange={setTrendSelection}
                onBack={navigateToList}
                onCreateRecord={() => navigateToCreateRecord(observationId)}
                onEditRecord={(recordId) => navigateToEditRecord(observationId, recordId)}
                onDeleted={navigateToList}
            />
        );
    }

    return (
        <ObservationListScreen
            onCreateNew={navigateToCreateObservation}
            onCreateRecord={navigateToCreateRecord}
            onObservationSelected={navigateToObservationDetails}
        />
    );
}
