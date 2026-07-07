import {describe, expect, it, vi} from 'vitest';
import {GetRecentRecordsUseCase} from './GetRecentRecordsUseCase';
import {RecordRepository} from './RecordRepository';
import {Record} from '../domain/Record';

describe('GetRecentRecordsUseCase', () => {
  it('should fetch the specified number of recent records', async () => {
    const mockRecords: Record[] = [
      new Record('1', 'obs1', new Date(), new Map()),
      new Record('2', 'obs1', new Date(Date.now() - 1000), new Map()),
    ];

    const mockRecordRepository: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn().mockResolvedValue(mockRecords),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new GetRecentRecordsUseCase(mockRecordRepository);
    
    const result = await useCase.execute('obs1', 3);

    expect(mockRecordRepository.getRecentRecords).toHaveBeenCalledWith('obs1', 3);
    expect(result).toBe(mockRecords);
  });
});
