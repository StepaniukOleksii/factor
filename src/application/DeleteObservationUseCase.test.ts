import {beforeEach, describe, expect, it, vi} from 'vitest';
import {DeleteObservationUseCase} from './DeleteObservationUseCase';
import {ObservationRepository} from './ObservationRepository';
import {RecordRepository} from './RecordRepository';

describe('DeleteObservationUseCase', () => {
  let mockObservationRepository: ObservationRepository;
  let mockRecordRepository: RecordRepository;
  let useCase: DeleteObservationUseCase;

  beforeEach(() => {
    mockObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    mockRecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn(),
      getByObservationId: vi.fn(),
      deleteByObservationId: vi.fn().mockResolvedValue(undefined),
      deleteById: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
    };
    useCase = new DeleteObservationUseCase(mockObservationRepository, mockRecordRepository);
  });

  it('should delete records before deleting the observation', async () => {
    const callOrder: string[] = [];
    (mockRecordRepository.deleteByObservationId as any).mockImplementation(async () => {
      callOrder.push('deleteByObservationId');
    });
    (mockObservationRepository.delete as any).mockImplementation(async () => {
      callOrder.push('delete');
    });

    await useCase.execute('obs-1');

    expect(callOrder).toEqual(['deleteByObservationId', 'delete']);
  });

  it('should call deleteByObservationId with the correct observation ID', async () => {
    await useCase.execute('obs-42');

    expect(mockRecordRepository.deleteByObservationId).toHaveBeenCalledTimes(1);
    expect(mockRecordRepository.deleteByObservationId).toHaveBeenCalledWith('obs-42');
  });

  it('should call delete on the observation repository with the correct ID', async () => {
    await useCase.execute('obs-42');

    expect(mockObservationRepository.delete).toHaveBeenCalledTimes(1);
    expect(mockObservationRepository.delete).toHaveBeenCalledWith('obs-42');
  });

  it('should propagate errors from the record repository', async () => {
    const error = new Error('Record deletion failed');
    (mockRecordRepository.deleteByObservationId as any).mockRejectedValue(error);

    await expect(useCase.execute('obs-1')).rejects.toThrow('Record deletion failed');
    expect(mockObservationRepository.delete).not.toHaveBeenCalled();
  });

  it('should propagate errors from the observation repository', async () => {
    const error = new Error('Observation deletion failed');
    (mockObservationRepository.delete as any).mockRejectedValue(error);

    await expect(useCase.execute('obs-1')).rejects.toThrow('Observation deletion failed');
  });
});
