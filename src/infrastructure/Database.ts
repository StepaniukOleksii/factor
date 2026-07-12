import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<void> {
  console.log('[Database] Initializing database...');
  try {
    const db = await getDatabase();
    
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS metrics (
        id TEXT PRIMARY KEY NOT NULL,
        observationId TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        constraintJson TEXT,
        FOREIGN KEY (observationId) REFERENCES observations (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY NOT NULL,
        observationId TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
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
      // Perform a health check query to ensure the native connection is still alive.
      // During Expo Go Fast Refresh, the native connection can drop while the JS instance remains.
      await dbInstance.execAsync('SELECT 1');
      return dbInstance;
    } catch (error: any) {
      console.warn(
        '[Database] Health check failed. The database connection is likely dead (e.g., due to Fast Refresh). Reconnecting...', 
        error?.message || error
      );
      // Clear the dead instance
      dbInstance = null;
    }
  }

  console.log('[Database] Opening new database connection...');
  dbInstance = await SQLite.openDatabaseAsync('factor.db');
  
  // Verify the new connection
  try {
    await dbInstance.execAsync('SELECT 1');
    console.log('[Database] New connection established and verified.');
  } catch (error: any) {
    console.error('[Database] Failed to verify new database connection:', error?.message || error);
    throw error;
  }

  return dbInstance;
}
