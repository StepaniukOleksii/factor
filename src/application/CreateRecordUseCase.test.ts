import {describe, expect, it, vi} from 'vitest';
import {CreateRecordCommand, CreateRecordUseCase} from './CreateRecordUseCase';
import {RecordRepository} from './RecordRepository';
import {ObservationRepository} from './ObservationRepository';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';
import {Record} from '../domain/Record';
import {RECORD_NOTE_MAX_LENGTH} from '../domain/validationLimits';

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

  describe('note', () => {
    const metric = new Metric('metric-1', 'Duration', 'Numeric');
    const observation = new Observation('obs-1', 'Sleep', [metric]);

    function createUseCase() {
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
      return new CreateRecordUseCase(mockRecordRepo, mockObservationRepo);
    }

    it('stores a trimmed note', async () => {
      const result = await createUseCase().execute({
        observationId: 'obs-1',
        values: [],
        note: '  slept in a hotel bed  ',
      });

      expect(result.note).toBe('slept in a hotel bed');
    });

    it('defaults the note to null when the command omits it', async () => {
      const result = await createUseCase().execute({observationId: 'obs-1', values: []});

      expect(result.note).toBeNull();
    });

    it('rejects a note over the length limit', async () => {
      await expect(createUseCase().execute({
        observationId: 'obs-1',
        values: [],
        note: 'x'.repeat(RECORD_NOTE_MAX_LENGTH + 1),
      })).rejects.toThrow('Record note cannot exceed 150 characters');
    });
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

    const command: CreateRecordCommand = {
      observationId: 'obs-1',
      values: [{metricId: 'metric-1', value: 'eight'}],
    };

    await expect(useCase.execute(command)).rejects.toThrow('Invalid value for metric Duration');
  });
});
