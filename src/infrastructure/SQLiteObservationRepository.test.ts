import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SQLiteObservationRepository} from './SQLiteObservationRepository';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';

// Use vi.hoisted for variables used inside vi.mock
const { mockRunAsync, mockWithTransactionAsync } = vi.hoisted(() => {
  return {
    mockRunAsync: vi.fn().mockResolvedValue(undefined),
    mockWithTransactionAsync: vi.fn().mockImplementation(async (callback) => {
      await callback();
    })
  };
});

vi.mock('./Database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    withTransactionAsync: mockWithTransactionAsync,
    runAsync: mockRunAsync
  })
}));

describe('SQLiteObservationRepository', () => {
  let repository: SQLiteObservationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SQLiteObservationRepository();
  });

  it('should save observation and its metrics', async () => {
    const metrics = [
      new Metric('metric-1', 'Temperature', 'Numeric'),
      new Metric('metric-2', 'Condition', 'Text')
    ];
    const observation = new Observation('obs-1', 'Weather', metrics);

    await repository.save(observation);

    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
    
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      1,
      'INSERT INTO observations (id, name, createdAt) VALUES (?, ?, ?)',
      expect.arrayContaining(['obs-1', 'Weather', expect.any(Number)])
    );

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO metrics (id, observationId, name, type, constraintJson) VALUES (?, ?, ?, ?, ?)',
      ['metric-1', 'obs-1', 'Temperature', 'Numeric', null]
    );

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      3,
      'INSERT INTO metrics (id, observationId, name, type, constraintJson) VALUES (?, ?, ?, ?, ?)',
      ['metric-2', 'obs-1', 'Condition', 'Text', null]
    );
  });
});
