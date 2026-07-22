import React, {useEffect, useState} from 'react';
import {StatusBar} from 'expo-status-bar';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {registerDevMenuItems} from 'expo-dev-menu';
import {initDatabase} from './src/infrastructure/Database';
import {reseedDevData} from './src/infrastructure/devSeed';
import {AppNavigator} from './src/presentation/navigation/AppNavigator';

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      try {
        await initDatabase();
        setIsDbReady(true);

        // Dev-only: lets you populate the DB with fixture data for manual QA
        // (charts, "last record" states, etc.) without entering data by hand.
        // Uses expo-dev-menu's custom-item API (not React Native's built-in
        // DevSettings.addMenuItem) since this project's dev client renders
        // its own dev menu, which doesn't read from DevSettings.
        // See testing-data.md and testing-android-manually.md > "Loading test data".
        if (__DEV__) {
          registerDevMenuItems([
            {
              name: 'Reseed test data',
              callback: () => {
                reseedDevData().catch(e => console.error('[devSeed] Reseed failed:', e));
              },
            },
          ]).catch(() => {
            // Expected on web: expo-dev-menu has no web implementation.
          });
        }
      } catch (e: any) {
        setError(e.message || 'Failed to initialize database');
      }
    }
    setup();
  }, []);

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error initializing app: {error}</Text>
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Initializing database...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppNavigator />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  }
});
