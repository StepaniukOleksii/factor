import React, {useState} from 'react';
import {ObservationListScreen} from '../screens/ObservationListScreen';
import {CreateObservationScreen} from '../screens/CreateObservationScreen';
import {CreateRecordScreen} from '../screens/CreateRecordScreen';

type ScreenState = 
  | { name: 'ObservationList' }
  | { name: 'CreateObservation' }
  | { name: 'CreateRecord'; observationId: string };

export function AppNavigator() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>({ name: 'ObservationList' });

  const navigateToList = () => setCurrentScreen({ name: 'ObservationList' });
  const navigateToCreateObservation = () => setCurrentScreen({ name: 'CreateObservation' });
  const navigateToCreateRecord = (observationId: string) => setCurrentScreen({ name: 'CreateRecord', observationId });

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

  return (
    <ObservationListScreen 
      onCreateNew={navigateToCreateObservation} 
      onCreateRecord={navigateToCreateRecord} 
    />
  );
}
