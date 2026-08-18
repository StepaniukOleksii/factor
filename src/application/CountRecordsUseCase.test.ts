import {describe, expect, it, vi} from 'vitest';
import {CountRecordsUseCase} from './CountRecordsUseCase';
import {RecordRepository} from './RecordRepository';

describe('CountRecordsUseCase', () => {
  it('should return the count the repository made for the observation', async () => {
    const mockRecordRepository: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn(),
      getByObservationId: vi.fn(),
      countByObservationId: vi.fn().mockResolvedValue(12),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CountRecordsUseCase(mockRecordRepository);

    const result = await useCase.execute('obs1');

    expect(mockRecordRepository.countByObservationId).toHaveBeenCalledWith('obs1');
    expect(result).toBe(12);
  });
});
