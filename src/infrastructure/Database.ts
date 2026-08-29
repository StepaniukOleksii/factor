import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * The database's shape, exported so a test can raise the same one in a SQLite of
 * its own.
 *
 * The application refuses a colliding name before it reaches the unique indexes
 * (ADR-4), which are here for a writer that never passed through it.
 */
export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_observations_name_unique
    ON observations (name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS metrics (
    id TEXT PRIMARY KEY NOT NULL,
    observationId TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    constraintJson TEXT,
    description TEXT,
    FOREIGN KEY (observationId) REFERENCES observations (id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_observation_name_unique
    ON metrics (observationId, name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY NOT NULL,
    observationId TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    note TEXT,
    FOREIGN KEY (observationId) REFERENCES observations (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS record_values (
    recordId TEXT NOT NULL,
    metricId TEXT NOT NULL,
    valueJson TEXT,
    PRIMARY KEY (recordId, metricId),
    FOREIGN KEY (recordId) REFERENCES records (id) ON DELETE CASCADE,
    FOREIGN KEY (metricId) REFERENCES metrics (id) ON DELETE CASCADE
  );
`;

export async function initDatabase(): Promise<void> {
  console.log('[Database] Initializing database...');
  try {
    const db = await getDatabase();

    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      ${SCHEMA}
    `);
    console.log('[Database] Initialization complete.');
  } catch (error) {
    console.error('[Database] Initialization failed:', error);
    throw error;
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance != null) {
    try {
      // Expo Go's Fast Refresh can drop the native connection while the JS instance
      // survives, so a live handle is not proof of a usable one.
      await dbInstance.execAsync('SELECT 1');
      return dbInstance;
    } catch (error: any) {
      console.warn(
        '[Database] Health check failed. The database connection is likely dead (e.g., due to Fast Refresh). Reconnecting...', 
        error?.message || error
      );
      dbInstance = null;
    }
  }

  console.log('[Database] Opening new database connection...');
  dbInstance = await SQLite.openDatabaseAsync('factor.db');
  
  try {
    // Foreign key enforcement is per connection rather than stored with the
    // database, so every connection has to state it: without it a deleted
    // Metric's `record_values` are left behind.
    await dbInstance.execAsync('PRAGMA foreign_keys = ON');
    console.log('[Database] New connection established and verified.');
  } catch (error: any) {
    console.error('[Database] Failed to verify new database connection:', error?.message || error);
    throw error;
  }

  return dbInstance;
}
