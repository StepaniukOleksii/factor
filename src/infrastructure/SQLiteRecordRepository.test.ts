import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SQLiteRecordRepository} from './SQLiteRecordRepository';
import {Record} from '../domain/Record';

const { mockRunAsync, mockWithTransactionAsync, mockGetAllAsync } = vi.hoisted(() => {
  return {
    mockRunAsync: vi.fn().mockResolvedValue(undefined),
    mockWithTransactionAsync: vi.fn().mockImplementation(async (callback) => {
      await callback();
    }),
    mockGetAllAsync: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('./Database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    withTransactionAsync: mockWithTransactionAsync,
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
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

  it('should query records by observation and half-open range, ordered ascending', async () => {
    const range = {
      start: new Date('2026-06-11T00:00:00.000Z'),
      end: new Date('2026-07-11T00:00:00.000Z'),
    };
    mockGetAllAsync
      .mockResolvedValueOnce([
        {id: 'record-1', timestamp: range.start.getTime()},
        {id: 'record-2', timestamp: range.start.getTime() + 1000},
      ])
      .mockResolvedValueOnce([{metricId: 'metric-1', valueJson: '7'}])
      .mockResolvedValueOnce([{metricId: 'metric-1', valueJson: '9'}]);

    const result = await repository.getByObservationId('obs-1', range);

    expect(mockGetAllAsync).toHaveBeenNthCalledWith(
      1,
      'SELECT id, timestamp FROM records WHERE observationId = ? AND timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC',
      'obs-1',
      range.start.getTime(),
      range.end.getTime()
    );

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('record-1');
    expect(result[0].observationId).toBe('obs-1');
    expect(result[0].getValue('metric-1')).toBe(7);
    expect(result[1].id).toBe('record-2');
    expect(result[1].getValue('metric-1')).toBe(9);
  });

  it('should return an empty array when no records fall within the range', async () => {
    mockGetAllAsync.mockResolvedValueOnce([]);

    const result = await repository.getByObservationId('obs-1', {
      start: new Date(0),
      end: new Date(1000),
    });

    expect(result).toEqual([]);
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

  it('should return null from getById when no record matches', async () => {
    mockGetAllAsync.mockResolvedValueOnce([]);

    const result = await repository.getById('missing-record');

    expect(result).toBeNull();
  });

  it('should return a fully-hydrated record from getById', async () => {
    const timestamp = new Date();
    mockGetAllAsync
      .mockResolvedValueOnce([{id: 'record-1', observationId: 'obs-1', timestamp: timestamp.getTime()}])
      .mockResolvedValueOnce([
        {metricId: 'metric-1', valueJson: '42'},
        {metricId: 'metric-2', valueJson: '"Good"'}
      ]);

    const result = await repository.getById('record-1');

    expect(mockGetAllAsync).toHaveBeenNthCalledWith(
      1,
      'SELECT id, observationId, timestamp FROM records WHERE id = ?',
      'record-1'
    );
    expect(mockGetAllAsync).toHaveBeenNthCalledWith(
      2,
      'SELECT metricId, valueJson FROM record_values WHERE recordId = ?',
      ['record-1']
    );

    expect(result).not.toBeNull();
    expect(result!.id).toBe('record-1');
    expect(result!.observationId).toBe('obs-1');
    expect(result!.timestamp).toEqual(timestamp);
    expect(result!.getValue('metric-1')).toBe(42);
    expect(result!.getValue('metric-2')).toBe('Good');
  });

  it('should update a record by replacing its values in a transaction', async () => {
    const values = new Map<string, any>([
      ['metric-1', 43],
      ['metric-2', 'Great']
    ]);
    const record = new Record('record-1', 'obs-1', new Date(), values);

    await repository.update(record);

    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      1,
      'DELETE FROM record_values WHERE recordId = ?',
      ['record-1']
    );
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO record_values (recordId, metricId, valueJson) VALUES (?, ?, ?)',
      ['record-1', 'metric-1', '43']
    );
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      3,
      'INSERT INTO record_values (recordId, metricId, valueJson) VALUES (?, ?, ?)',
      ['record-1', 'metric-2', '"Great"']
    );

    expect(mockRunAsync).toHaveBeenCalledTimes(3);
  });
});

