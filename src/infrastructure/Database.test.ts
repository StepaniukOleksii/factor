import {beforeEach, describe, expect, it, vi} from 'vitest';

const {openDatabaseAsync} = vi.hoisted(() => ({openDatabaseAsync: vi.fn()}));
vi.mock('expo-sqlite', () => ({openDatabaseAsync}));

function connection() {
  const statements: string[] = [];
  const execAsync = vi.fn(async (sql: string) => {
    statements.push(sql);
  });
  return {statements, execAsync};
}

describe('getDatabase', () => {
  beforeEach(() => {
    vi.resetModules();
    openDatabaseAsync.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('arms foreign keys on the connection it opens', async () => {
    const opened = connection();
    openDatabaseAsync.mockResolvedValue(opened);

    const {getDatabase} = await import('./Database');
    await getDatabase();

    expect(opened.statements).toContain('PRAGMA foreign_keys = ON');
  });

  it('reuses a live connection rather than opening a second', async () => {
    openDatabaseAsync.mockResolvedValue(connection());

    const {getDatabase} = await import('./Database');
    const first = await getDatabase();

    expect(await getDatabase()).toBe(first);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('arms them again on the connection replacing one that died', async () => {
    const dropped = connection();
    const replacement = connection();
    openDatabaseAsync.mockResolvedValueOnce(dropped).mockResolvedValueOnce(replacement);

    const {getDatabase} = await import('./Database');
    await getDatabase();
    dropped.execAsync.mockRejectedValue(new Error('database is closed'));

    expect(await getDatabase()).toBe(replacement);
    expect(replacement.statements).toContain('PRAGMA foreign_keys = ON');
  });
});
