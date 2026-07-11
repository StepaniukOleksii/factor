import {describe, expect, it, vi} from 'vitest';
import {CreateRecordCommand, CreateRecordUseCase} from './CreateRecordUseCase';
import {RecordRepository} from './RecordRepository';
import {ObservationRepository} from './ObservationRepository';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';
import {Record} from '../domain/Record';

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid'),
}));

describe('CreateRecordUseCase', () => {
  it('creates a record successfully', async () => {
    const metric = new Metric('metric-1', 'Duration', 'Numeric');
    const observation = new Observation('obs-1', 'Sleep', [metric]);

    const mockObservationRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([observation]),
      delete: vi.fn(),
    };

    const mockRecordRepo: RecordRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn(),
      getByObservationId: vi.fn(),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CreateRecordUseCase(mockRecordRepo, mockObservationRepo);

    const command: CreateRecordCommand = {
      observationId: 'obs-1',
      values: [{metricId: 'metric-1', value: 8}],
    };

    const result = await useCase.execute(command);

    expect(result).toBeInstanceOf(Record);
    expect(result.observationId).toBe('obs-1');
    expect(result.getValue('metric-1')).toBe(8);
    expect(mockRecordRepo.save).toHaveBeenCalledWith(result);
  });

  it('throws an error if observation is not found', async () => {
    const mockObservationRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    };

    const mockRecordRepo: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn(),
      getByObservationId: vi.fn(),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CreateRecordUseCase(mockRecordRepo, mockObservationRepo);

    const command: CreateRecordCommand = {
      observationId: 'obs-2',
      values: [],
    };

    await expect(useCase.execute(command)).rejects.toThrow('Observation with id obs-2 not found');
  });

  it('throws an error if metric validation fails', async () => {
    const metric = new Metric('metric-1', 'Duration', 'Numeric');
    const observation = new Observation('obs-1', 'Sleep', [metric]);

    const mockObservationRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([observation]),
      delete: vi.fn(),
    };

    const mockRecordRepo: RecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn(),
      getByObservationId: vi.fn(),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new CreateRecordUseCase(mockRecordRepo, mockObservationRepo);

    // Provide string for Numeric metric
    const command: CreateRecordCommand = {
      observationId: 'obs-1',
      values: [{metricId: 'metric-1', value: 'eight'}],
    };

    await expect(useCase.execute(command)).rejects.toThrow('Invalid value for metric Duration');
  });
});
