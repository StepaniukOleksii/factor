import React, {useState} from 'react';
import {ObservationListScreen} from '../screens/ObservationListScreen';
import {CreateObservationScreen} from '../screens/CreateObservationScreen';
import {RecordFormScreen} from '../screens/RecordFormScreen';
import {ObservationDetailsScreen} from '../screens/ObservationDetailsScreen';

type ScreenState =
    | { name: 'ObservationList' }
    | { name: 'CreateObservation' }
    | { name: 'CreateRecord'; observationId: string }
    | { name: 'EditRecord'; observationId: string; recordId: string }
    | { name: 'ObservationDetails'; observationId: string };

export function AppNavigator() {
    const [currentScreen, setCurrentScreen] = useState<ScreenState>({name: 'ObservationList'});

    const navigateToList = () => setCurrentScreen({name: 'ObservationList'});
    const navigateToCreateObservation = () => setCurrentScreen({name: 'CreateObservation'});
    const navigateToCreateRecord = (observationId: string) => setCurrentScreen({name: 'CreateRecord', observationId});
    const navigateToEditRecord = (observationId: string, recordId: string) => setCurrentScreen({
        name: 'EditRecord',
        observationId,
        recordId
    });
    const navigateToObservationDetails = (observationId: string) => setCurrentScreen({
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
        return (
            <ObservationDetailsScreen
                observationId={currentScreen.observationId}
                onBack={navigateToList}
                onCreateRecord={() => navigateToCreateRecord(currentScreen.observationId)}
                onEditRecord={(recordId) => navigateToEditRecord(currentScreen.observationId, recordId)}
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
