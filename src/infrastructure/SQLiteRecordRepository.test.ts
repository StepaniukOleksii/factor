import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SQLiteRecordRepository} from './SQLiteRecordRepository';
import {Record} from '../domain/Record';

const { mockRunAsync, mockWithTransactionAsync } = vi.hoisted(() => {
  return {
    mockRunAsync: vi.fn().mockResolvedValue(undefined),
    mockWithTransactionAsync: vi.fn().mockImplementation(async (callback) => {
      await callback();
    }),
  };
});

vi.mock('./Database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    withTransactionAsync: mockWithTransactionAsync,
    runAsync: mockRunAsync,
  })
}));

describe('SQLiteRecordRepository', () => {
  let repository: SQLiteRecordRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SQLiteRecordRepository();
  });

  it('should save a record and its values', async () => {
    const timestamp = new Date();
    const values = new Map<string, any>([
      ['metric-1', 42],
      ['metric-2', 'Good']
    ]);
    const record = new Record('record-1', 'obs-1', timestamp, values);

    await repository.save(record);

    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
    
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      1,
      'INSERT INTO records (id, observationId, timestamp) VALUES (?, ?, ?)',
      ['record-1', 'obs-1', timestamp.getTime()]
    );

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO record_values (recordId, metricId, valueJson) VALUES (?, ?, ?)',
      ['record-1', 'metric-1', '42']
    );

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      3,
      'INSERT INTO record_values (recordId, metricId, valueJson) VALUES (?, ?, ?)',
      ['record-1', 'metric-2', '"Good"']
    );
  });

  it('should delete all records for a given observation ID', async () => {
    await repository.deleteByObservationId('obs-1');

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    expect(mockRunAsync).toHaveBeenCalledWith(
      'DELETE FROM records WHERE observationId = ?',
      'obs-1'
    );
  });

  it('should delete a record by its ID', async () => {
    await repository.deleteById('record-1');

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    expect(mockRunAsync).toHaveBeenCalledWith(
      'DELETE FROM records WHERE id = ?',
      'record-1'
    );
  });
});

