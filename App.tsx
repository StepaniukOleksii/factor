import React, {useEffect, useState} from 'react';
import {StatusBar} from 'expo-status-bar';
import {ActivityIndicator, Linking, StyleSheet, Text, View} from 'react-native';
import {registerDevMenuItems} from 'expo-dev-menu';
import {initDatabase} from './src/infrastructure/Database';
import {clearDevData, reseedDevData} from './src/infrastructure/devSeed';
import {AppNavigator} from './src/presentation/navigation/AppNavigator';

// Dev-only commands reachable as `exp+factor://dev/<name>`, so an E2E flow can
// set up fixtures without the dev menu, which it has no way to open. See
// testing-android-e2e.md. The host is `dev` because the dev client reserves
// `expo-development-client` for its own links.
const DEV_LINK_HOST = 'dev';

const devLinkCommands: Record<string, () => Promise<void>> = {
  seed: reseedDevData,
  reset: clearDevData,
};

// `onComplete` fires only once the command has finished writing — a flow has no
// other way to tell, since firing a link is one-way.
function handleDevLink(url: string, dbReady: Promise<void>, onComplete: () => void): void {
  const afterScheme = url.split('://')[1];
  if (!afterScheme) return;

  const [host, ...rest] = afterScheme.split('/');
  if (host !== DEV_LINK_HOST) return;

  const name = rest.join('/').replace(/\/$/, '');
  const command = devLinkCommands[name];
  if (!command) {
    console.warn(`[devLink] Unknown command '${name}' — expected one of ${Object.keys(devLinkCommands).join(', ')}`);
    return;
  }

  console.log(`[devLink] Running '${name}'`);
  dbReady
    .then(command)
    .then(() => {
      console.log(`[devLink] '${name}' done`);
      onComplete();
    })
    .catch(e => console.error(`[devLink] '${name}' failed:`, e));
}

export default function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped when a dev-link command finishes, remounting the navigator so screens
  // re-read the database it just rewrote. Nothing else changes it.
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const dbReady = initDatabase();
    let subscription: {remove: () => void} | undefined;

    if (__DEV__) {
      // Registered before the database is awaited, not after: a link arriving
      // before this listener exists is dropped and never re-delivered. Commands
      // still wait on `dbReady` for the schema.
      const bumpDataVersion = () => setDataVersion(v => v + 1);
      subscription = Linking.addEventListener('url', ({url}) => handleDevLink(url, dbReady, bumpDataVersion));
      Linking.getInitialURL().then(url => {
        if (url) handleDevLink(url, dbReady, bumpDataVersion);
      });
    }

    dbReady
      .then(() => {
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
      })
      .catch((e: any) => setError(e.message || 'Failed to initialize database'));

    return () => subscription?.remove();
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
      <AppNavigator key={dataVersion} />
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
