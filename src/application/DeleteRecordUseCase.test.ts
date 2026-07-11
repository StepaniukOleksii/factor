import {beforeEach, describe, expect, it, vi} from 'vitest';
import {DeleteRecordUseCase} from './DeleteRecordUseCase';
import {RecordRepository} from './RecordRepository';

describe('DeleteRecordUseCase', () => {
  let mockRecordRepository: RecordRepository;
  let useCase: DeleteRecordUseCase;

  beforeEach(() => {
    mockRecordRepository = {
      save: vi.fn(),
      getLastRecordTimestamps: vi.fn(),
      getRecentRecords: vi.fn(),
      getByObservationId: vi.fn(),
      deleteByObservationId: vi.fn(),
      deleteById: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn(),
      update: vi.fn(),
    };
    useCase = new DeleteRecordUseCase(mockRecordRepository);
  });

  it('should call deleteById with the correct record ID', async () => {
    await useCase.execute('record-42');

    expect(mockRecordRepository.deleteById).toHaveBeenCalledTimes(1);
    expect(mockRecordRepository.deleteById).toHaveBeenCalledWith('record-42');
  });

  it('should propagate errors from the record repository', async () => {
    const error = new Error('Record deletion failed');
    (mockRecordRepository.deleteById as any).mockRejectedValue(error);

    await expect(useCase.execute('record-1')).rejects.toThrow('Record deletion failed');
  });
});
