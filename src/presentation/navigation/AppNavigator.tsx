import React, {useState} from 'react';
import {ObservationListScreen} from '../screens/ObservationListScreen';
import {CreateObservationScreen} from '../screens/CreateObservationScreen';

type ScreenName = 'ObservationList' | 'CreateObservation';

export function AppNavigator() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('ObservationList');

  const navigateToList = () => setCurrentScreen('ObservationList');
  const navigateToCreate = () => setCurrentScreen('CreateObservation');

  if (currentScreen === 'CreateObservation') {
    return (
      <CreateObservationScreen 
        onBack={navigateToList} 
        onCreated={navigateToList} 
      />
    );
  }

  return <ObservationListScreen onCreateNew={navigateToCreate} />;
}
