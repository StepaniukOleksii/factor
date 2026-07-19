import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ObservationListScreen} from '../screens/ObservationListScreen';
import {CreateObservationScreen} from '../screens/CreateObservationScreen';
import {RecordFormScreen} from '../screens/RecordFormScreen';
import {ObservationDetailsScreen} from '../screens/ObservationDetailsScreen';
import type {RootStackParamList} from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * The app's single native stack, rooted at the Observation list.
 *
 * A screen pushed on top of another leaves it mounted with its state intact,
 * and popping returns to that same instance - which is what makes "screens
 * opened from an Observation are part of exploring it" structural rather than
 * a rule the router has to enforce. See ADR-2.
 */
export function AppNavigator() {
    return (
        // Route names are not page titles, so the browser tab under
        // `expo start --web` is left alone. On device this is a no-op.
        <NavigationContainer documentTitle={{enabled: false}}>
            <Stack.Navigator
                initialRouteName="ObservationList"
                // `ScreenHeader` is the app's header on every screen; the
                // framework's own would be a second one stacked above it.
                screenOptions={{headerShown: false}}
            >
                <Stack.Screen name="ObservationList" component={ObservationListScreen}/>
                <Stack.Screen name="CreateObservation" component={CreateObservationScreen}/>
                <Stack.Screen name="ObservationDetails" component={ObservationDetailsScreen}/>
                {/* One screen, two routes: creating and editing differ only by
                    whether a Record id came along in the params. */}
                <Stack.Screen name="CreateRecord" component={RecordFormScreen}/>
                <Stack.Screen name="EditRecord" component={RecordFormScreen}/>
            </Stack.Navigator>
        </NavigationContainer>
    );
}
