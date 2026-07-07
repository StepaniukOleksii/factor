import {describe, expect, it, vi} from 'vitest';
import {GetObservationsUseCase} from './GetObservationsUseCase';
import {ObservationRepository} from './ObservationRepository';
import {RecordRepository} from './RecordRepository';
import {Observation} from '../domain/Observation';

describe('GetObservationsUseCase', () => {
  it('returns an empty array when there are no observations', async () => {
    const mockRepo: ObservationRepository = {
      findAll: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      delete: vi.fn(),
    };
    const mockRecordRepo: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn().mockResolvedValue(new Map()),
      getRecentRecords: vi.fn(),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    }

    const useCase = new GetObservationsUseCase(mockRepo, mockRecordRepo);

    const result = await useCase.execute();
    expect(result).toEqual([]);
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    expect(mockRecordRepo.getLastRecordTimestamps).toHaveBeenCalledWith([]);
  });

  it('returns observations with their last record timestamps', async () => {
    const obs1 = new Observation('obs-1', 'Test 1');
    const obs2 = new Observation('obs-2', 'Test 2');
    
    const mockRepo: ObservationRepository = {
      findAll: vi.fn().mockResolvedValue([obs1, obs2]),
      save: vi.fn(),
      delete: vi.fn(),
    };

    const d = new Date();
    const timestamps = new Map<string, Date>();
    timestamps.set('obs-1', d);

    const mockRecordRepo: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn().mockResolvedValue(timestamps),
      getRecentRecords: vi.fn(),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    }

    const useCase = new GetObservationsUseCase(mockRepo, mockRecordRepo);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0].observation).toBe(obs1);
    expect(result[0].lastRecordAt).toBe(d);
    expect(result[1].observation).toBe(obs2);
    expect(result[1].lastRecordAt).toBeNull();
    
    expect(mockRecordRepo.getLastRecordTimestamps).toHaveBeenCalledWith(['obs-1', 'obs-2']);
  });
});
