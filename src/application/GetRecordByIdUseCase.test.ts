import {describe, expect, it, vi} from 'vitest';
import {GetRecordByIdUseCase} from './GetRecordByIdUseCase';
import {RecordRepository} from './RecordRepository';
import {Record} from '../domain/Record';

describe('GetRecordByIdUseCase', () => {
  it('returns the record if found', async () => {
    const record = new Record('record-1', 'obs-1', new Date(), new Map());

    const mockRepo: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn(),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn().mockResolvedValue(record),
      update: vi.fn(),
    };

    const useCase = new GetRecordByIdUseCase(mockRepo);
    const result = await useCase.execute('record-1');

    expect(result).toBe(record);
    expect(mockRepo.getById).toHaveBeenCalledWith('record-1');
  });

  it('returns null if record is not found', async () => {
    const mockRepo: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn(),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    };

    const useCase = new GetRecordByIdUseCase(mockRepo);
    const result = await useCase.execute('record-404');

    expect(result).toBeNull();
  });
});
