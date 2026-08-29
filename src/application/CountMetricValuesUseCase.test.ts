import {describe, expect, it, vi} from 'vitest';
import {CountMetricValuesUseCase} from './CountMetricValuesUseCase';
import {RecordRepository} from './RecordRepository';

describe('CountMetricValuesUseCase', () => {
  it('should return the count the repository made across the metrics asked about', async () => {
    const mockRecordRepository: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn(),
      getByObservationId: vi.fn(),
      countByObservationId: vi.fn(),
      countValuesByMetricIds: vi.fn().mockResolvedValue(45),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CountMetricValuesUseCase(mockRecordRepository);

    const result = await useCase.execute(['metric-1', 'metric-2']);

    expect(mockRecordRepository.countValuesByMetricIds)
      .toHaveBeenCalledWith(['metric-1', 'metric-2']);
    expect(result).toBe(45);
  });
});
