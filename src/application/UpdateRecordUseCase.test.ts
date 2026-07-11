import {describe, expect, it, vi} from 'vitest';
import {UpdateRecordCommand, UpdateRecordUseCase} from './UpdateRecordUseCase';
import {RecordRepository} from './RecordRepository';
import {ObservationRepository} from './ObservationRepository';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';
import {Record} from '../domain/Record';

function createMockRecordRepo(overrides: Partial<RecordRepository> = {}): RecordRepository {
  return {
    save: vi.fn(),
    getLastRecordTimestamps: vi.fn(),
    getRecentRecords: vi.fn(),
    getByObservationId: vi.fn(),
    deleteByObservationId: vi.fn(),
    deleteById: vi.fn(),
    getById: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('UpdateRecordUseCase', () => {
  it('updates a record successfully and preserves its identifier', async () => {
    const metric = new Metric('metric-1', 'Duration', 'Numeric');
    const observation = new Observation('obs-1', 'Sleep', [metric]);
    const existingRecord = new Record('record-1', 'obs-1', new Date(), new Map([['metric-1', 7]]));

    const mockObservationRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([observation]),
      delete: vi.fn(),
    };

    const mockRecordRepo = createMockRecordRepo({
      getById: vi.fn().mockResolvedValue(existingRecord),
    });

    const useCase = new UpdateRecordUseCase(mockRecordRepo, mockObservationRepo);

    const command: UpdateRecordCommand = {
      recordId: 'record-1',
      observationId: 'obs-1',
      values: [{metricId: 'metric-1', value: 8}],
    };

    const result = await useCase.execute(command);

    expect(result).toBe(existingRecord);
    expect(result.id).toBe('record-1');
    expect(result.getValue('metric-1')).toBe(8);
    expect(mockRecordRepo.update).toHaveBeenCalledWith(existingRecord);
  });

  it('throws an error if observation is not found', async () => {
    const mockObservationRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    };
    const mockRecordRepo = createMockRecordRepo();

    const useCase = new UpdateRecordUseCase(mockRecordRepo, mockObservationRepo);

    const command: UpdateRecordCommand = {
      recordId: 'record-1',
      observationId: 'obs-2',
      values: [],
    };

    await expect(useCase.execute(command)).rejects.toThrow('Observation with id obs-2 not found');
  });

  it('throws an error if record is not found', async () => {
    const observation = new Observation('obs-1', 'Sleep');

    const mockObservationRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([observation]),
      delete: vi.fn(),
    };
    const mockRecordRepo = createMockRecordRepo({
      getById: vi.fn().mockResolvedValue(null),
    });

    const useCase = new UpdateRecordUseCase(mockRecordRepo, mockObservationRepo);

    const command: UpdateRecordCommand = {
      recordId: 'record-404',
      observationId: 'obs-1',
      values: [],
    };

    await expect(useCase.execute(command)).rejects.toThrow('Record with id record-404 not found');
  });

  it('throws an error if metric validation fails', async () => {
    const metric = new Metric('metric-1', 'Duration', 'Numeric');
    const observation = new Observation('obs-1', 'Sleep', [metric]);
    const existingRecord = new Record('record-1', 'obs-1', new Date(), new Map([['metric-1', 7]]));

    const mockObservationRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([observation]),
      delete: vi.fn(),
    };
    const mockRecordRepo = createMockRecordRepo({
      getById: vi.fn().mockResolvedValue(existingRecord),
    });

    const useCase = new UpdateRecordUseCase(mockRecordRepo, mockObservationRepo);

    const command: UpdateRecordCommand = {
      recordId: 'record-1',
      observationId: 'obs-1',
      values: [{metricId: 'metric-1', value: 'eight'}],
    };

    await expect(useCase.execute(command)).rejects.toThrow('Invalid value for metric Duration');
    expect(mockRecordRepo.update).not.toHaveBeenCalled();
  });

  it('throws an error if the record does not belong to the given observation', async () => {
    const observation = new Observation('obs-1', 'Sleep');
    const existingRecord = new Record('record-1', 'obs-2', new Date(), new Map());

    const mockObservationRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([observation]),
      delete: vi.fn(),
    };
    const mockRecordRepo = createMockRecordRepo({
      getById: vi.fn().mockResolvedValue(existingRecord),
    });

    const useCase = new UpdateRecordUseCase(mockRecordRepo, mockObservationRepo);

    const command: UpdateRecordCommand = {
      recordId: 'record-1',
      observationId: 'obs-1',
      values: [],
    };

    await expect(useCase.execute(command)).rejects.toThrow('Observation ID mismatch.');
  });
});
