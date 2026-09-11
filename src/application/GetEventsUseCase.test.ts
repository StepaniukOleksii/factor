import {describe, expect, it, vi} from 'vitest';
import {GetEventsUseCase} from './GetEventsUseCase';
import {EventRepository} from './EventRepository';
import {Event} from '../domain/Event';

function buildEvents(count: number): Event[] {
  return Array.from({length: count}, (_, index) =>
    new Event(`event-${index}`, `Event ${index}`, new Date(2026, 0, count - index)));
}

function repositoryHolding(events: Event[]): EventRepository {
  return {
    save: vi.fn(),
    findAll: vi.fn().mockResolvedValue(events),
    findRecent: vi.fn((limit: number) => Promise.resolve(events.slice(0, limit))),
    delete: vi.fn(),
  };
}

describe('GetEventsUseCase', () => {
  it('returns an empty page when no event is stored', async () => {
    const repository = repositoryHolding([]);

    const page = await new GetEventsUseCase(repository).execute(20);

    expect(page).toEqual({events: [], hasMore: false});
  });

  it('returns the events most recently occurred first', async () => {
    const events = buildEvents(3);

    const page = await new GetEventsUseCase(repositoryHolding(events)).execute(20);

    expect(page.events).toEqual(events);
  });

  it('returns at most the events asked for', async () => {
    const page = await new GetEventsUseCase(repositoryHolding(buildEvents(25))).execute(20);

    expect(page.events).toHaveLength(20);
  });

  it('reports more when the store holds one beyond the limit', async () => {
    const page = await new GetEventsUseCase(repositoryHolding(buildEvents(21))).execute(20);

    expect(page.hasMore).toBe(true);
  });

  it('reports no more when the store holds exactly the limit', async () => {
    const page = await new GetEventsUseCase(repositoryHolding(buildEvents(20))).execute(20);

    expect(page.hasMore).toBe(false);
    expect(page.events).toHaveLength(20);
  });

  it('asks the repository for one event beyond the limit', async () => {
    const repository = repositoryHolding(buildEvents(5));

    await new GetEventsUseCase(repository).execute(20);

    expect(repository.findRecent).toHaveBeenCalledWith(21);
  });
});
