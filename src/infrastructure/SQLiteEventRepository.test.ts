import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SQLiteEventRepository} from './SQLiteEventRepository';
import {Event} from '../domain/Event';

const {mockRunAsync, mockGetAllAsync} = vi.hoisted(() => {
  return {
    mockRunAsync: vi.fn().mockResolvedValue(undefined),
    mockGetAllAsync: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('./Database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
  })
}));

describe('SQLiteEventRepository', () => {
  let repository: SQLiteEventRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllAsync.mockResolvedValue([]);
    repository = new SQLiteEventRepository();
  });

  it('should save an event', async () => {
    const occurredAt = new Date('2026-03-14T09:00:00Z');

    await repository.save(new Event('event-1', 'Vacation', occurredAt, 'Two weeks away.'));

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO events'),
      ['event-1', 'Vacation', 'Two weeks away.', occurredAt.getTime()]
    );
  });

  it('should store a missing description as null', async () => {
    await repository.save(new Event('event-1', 'Vacation', new Date()));

    expect(mockRunAsync.mock.calls[0][1][2]).toBeNull();
  });

  it('should read events back most recently occurred first', async () => {
    const newest = new Date('2026-06-01T12:00:00Z');
    const oldest = new Date('2026-01-01T12:00:00Z');
    mockGetAllAsync.mockResolvedValue([
      {id: 'event-2', name: 'Illness', description: null, occurredAt: newest.getTime()},
      {id: 'event-1', name: 'Vacation', description: 'Two weeks away.', occurredAt: oldest.getTime()},
    ]);

    const events = await repository.findAll();

    expect(mockGetAllAsync).toHaveBeenCalledWith(expect.stringContaining('ORDER BY occurredAt DESC'));
    expect(events.map(event => event.id)).toEqual(['event-2', 'event-1']);
    expect(events[0].occurredAt).toEqual(newest);
    expect(events[0].description).toBeNull();
    expect(events[1].description).toBe('Two weeks away.');
  });

  it('should return nothing when no event is stored', async () => {
    expect(await repository.findAll()).toEqual([]);
  });

  it('should delete an event by id', async () => {
    await repository.delete('event-1');

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM events'),
      ['event-1']
    );
  });
});
