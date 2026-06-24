import {describe, expect, it, vi} from 'vitest';
import {GetRecentRecordsUseCase} from './GetRecentRecordsUseCase';
import {RecordRepository} from './RecordRepository';
import {Record} from '../domain/Record';

describe('GetRecentRecordsUseCase', () => {
  it('should fetch the specified number of recent records', async () => {
    const mockRecords: Record[] = [
      new Record({id: '1', observationId: 'obs1', timestamp: new Date(), values: new Map()}),
      new Record({id: '2', observationId: 'obs1', timestamp: new Date(Date.now() - 1000), values: new Map()}),
    ];

    const mockRecordRepository: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn().mockResolvedValue(mockRecords),
    };

    const useCase = new GetRecentRecordsUseCase(mockRecordRepository);
    
    const result = await useCase.execute('obs1', 3);

    expect(mockRecordRepository.getRecentRecords).toHaveBeenCalledWith('obs1', 3);
    expect(result).toBe(mockRecords);
  });
});
