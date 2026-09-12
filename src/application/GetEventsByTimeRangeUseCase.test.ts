import {describe, expect, it, vi} from 'vitest';
import {GetEventsByTimeRangeUseCase} from './GetEventsByTimeRangeUseCase';
import {EventRepository} from './EventRepository';
import {TimeRange} from './GetMetricSeriesUseCase';
import {Event} from '../domain/Event';

const RANGE: TimeRange = {
  start: new Date('2026-03-01T00:00:00Z'),
  end: new Date('2026-03-31T00:00:00Z'),
};

function repositoryHolding(events: Event[]): EventRepository {
  return {
    save: vi.fn(),
    findAll: vi.fn(),
    findRecent: vi.fn(),
    findByTimeRange: vi.fn().mockResolvedValue(events),
    delete: vi.fn(),
  };
}

describe('GetEventsByTimeRangeUseCase', () => {
  it('passes the range through to the repository', async () => {
    const repository = repositoryHolding([]);

    await new GetEventsByTimeRangeUseCase(repository).execute(RANGE);

    expect(repository.findByTimeRange).toHaveBeenCalledWith(RANGE);
  });

  it('returns the events the repository gives it', async () => {
    const events = [
      new Event('event-1', 'Vacation', new Date('2026-03-04T09:00:00Z')),
      new Event('event-2', 'Illness', new Date('2026-03-20T09:00:00Z'), 'A week of it.'),
    ];

    const found = await new GetEventsByTimeRangeUseCase(repositoryHolding(events)).execute(RANGE);

    expect(found).toEqual(events);
  });

  it('returns nothing for a window holding no event', async () => {
    const found = await new GetEventsByTimeRangeUseCase(repositoryHolding([])).execute(RANGE);

    expect(found).toEqual([]);
  });
});
