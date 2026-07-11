import {describe, expect, it, vi} from 'vitest';
import {GetRecordsByTimeRangeUseCase} from './GetRecordsByTimeRangeUseCase';
import {RecordRepository} from './RecordRepository';
import {TimeRange} from './GetMetricSeriesUseCase';
import {Record} from '../domain/Record';

function mockRecordRepository(overrides: Partial<RecordRepository> = {}): RecordRepository {
  return {
    save: vi.fn(),
    getLastRecordTimestamps: vi.fn(),
    getRecentRecords: vi.fn(),
    getByObservationId: vi.fn(),
    deleteByObservationId: vi.fn(),
    deleteById: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

describe('GetRecordsByTimeRangeUseCase', () => {
  const range: TimeRange = {
    start: new Date('2026-06-11T00:00:00.000Z'),
    end: new Date('2026-07-11T00:00:00.000Z'),
  };

  it('delegates to the repository with the given observation id and range', async () => {
    const repository = mockRecordRepository({getByObservationId: vi.fn().mockResolvedValue([])});
    const useCase = new GetRecordsByTimeRangeUseCase(repository);

    await useCase.execute('obs-1', range);

    expect(repository.getByObservationId).toHaveBeenCalledWith('obs-1', range);
  });

  it('returns the repository result unchanged', async () => {
    const records = [
      new Record('r1', 'obs-1', new Date('2026-06-20T00:00:00.000Z'), new Map()),
      new Record('r2', 'obs-1', new Date('2026-07-01T00:00:00.000Z'), new Map()),
    ];
    const repository = mockRecordRepository({
      getByObservationId: vi.fn().mockResolvedValue(records),
    });
    const useCase = new GetRecordsByTimeRangeUseCase(repository);

    const result = await useCase.execute('obs-1', range);

    expect(result).toBe(records);
  });
});
