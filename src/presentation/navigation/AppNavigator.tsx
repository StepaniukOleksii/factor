import React, {useState} from 'react';
import {ObservationListScreen} from '../screens/ObservationListScreen';
import {CreateObservationScreen} from '../screens/CreateObservationScreen';
import {CreateRecordScreen} from '../screens/CreateRecordScreen';
import {ObservationDetailsScreen} from '../screens/ObservationDetailsScreen';

type ScreenState = 
  | { name: 'ObservationList' }
  | { name: 'CreateObservation' }
  | { name: 'CreateRecord'; observationId: string }
  | { name: 'ObservationDetails'; observationId: string };

export function AppNavigator() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>({ name: 'ObservationList' });

  const navigateToList = () => setCurrentScreen({ name: 'ObservationList' });
  const navigateToCreateObservation = () => setCurrentScreen({ name: 'CreateObservation' });
  const navigateToCreateRecord = (observationId: string) => setCurrentScreen({ name: 'CreateRecord', observationId });
  const navigateToObservationDetails = (observationId: string) => setCurrentScreen({ name: 'ObservationDetails', observationId });

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
      <CreateRecordScreen
        observationId={currentScreen.observationId}
        onBack={navigateToList}
        onCreated={navigateToList}
      />
    );
  }

  if (currentScreen.name === 'ObservationDetails') {
    return (
      <ObservationDetailsScreen
        observationId={currentScreen.observationId}
        onBack={navigateToList}
        onCreateRecord={() => navigateToCreateRecord(currentScreen.observationId)}
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
