import * as SQLite from 'expo-sqlite';

export async function initDatabase(): Promise<void> {
  const db = await SQLite.openDatabaseAsync('factor.db');
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
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
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return await SQLite.openDatabaseAsync('factor.db');
}
