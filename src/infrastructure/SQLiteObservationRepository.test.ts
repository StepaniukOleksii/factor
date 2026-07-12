import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SQLiteObservationRepository} from './SQLiteObservationRepository';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';

// Use vi.hoisted for variables used inside vi.mock
const { mockRunAsync, mockWithTransactionAsync, mockGetAllAsync } = vi.hoisted(() => {
  return {
    mockRunAsync: vi.fn().mockResolvedValue(undefined),
    mockWithTransactionAsync: vi.fn().mockImplementation(async (callback) => {
      await callback();
    }),
    mockGetAllAsync: vi.fn().mockResolvedValue([])
  };
});

vi.mock('./Database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    withTransactionAsync: mockWithTransactionAsync,
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync
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
    const observation = new Observation('obs-1', 'Weather', metrics, 'Daily weather log');

    await repository.save(observation);

    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      1,
      'INSERT INTO observations (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
      'obs-1',
      'Weather',
      'Daily weather log',
      expect.any(Number)
    );

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO metrics (id, observationId, name, type, constraintJson) VALUES (?, ?, ?, ?, ?)',
      'metric-1',
      'obs-1',
      'Temperature',
      'Numeric',
      null
    );

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      3,
      'INSERT INTO metrics (id, observationId, name, type, constraintJson) VALUES (?, ?, ?, ?, ?)',
      'metric-2',
      'obs-1',
      'Condition',
      'Text',
      null
    );
  });

  it('should persist a null description', async () => {
    const observation = new Observation('obs-1', 'Weather', []);

    await repository.save(observation);

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      1,
      'INSERT INTO observations (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
      'obs-1',
      'Weather',
      null,
      expect.any(Number)
    );
  });

  describe('findAll', () => {
    it('should return an empty array when no observations exist', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT id, name, description, createdAt FROM observations ORDER BY createdAt DESC'
      );
    });

    it('should round-trip the observation description, including null', async () => {
      mockGetAllAsync
        .mockResolvedValueOnce([
          { id: 'obs-1', name: 'Sleep Quality', description: 'Nightly sleep tracking', createdAt: 1000 },
          { id: 'obs-2', name: 'Mood', description: null, createdAt: 900 }
        ])
        .mockResolvedValueOnce([]);

      const result = await repository.findAll();

      expect(result[0].description).toBe('Nightly sleep tracking');
      expect(result[1].description).toBeNull();
    });

    it('should return observations with their associated metrics', async () => {
      mockGetAllAsync
        .mockResolvedValueOnce([
          { id: 'obs-1', name: 'Sleep Quality', createdAt: 1000 },
          { id: 'obs-2', name: 'Mood', createdAt: 900 }
        ])
        .mockResolvedValueOnce([
          { id: 'm-1', observationId: 'obs-1', name: 'Duration', type: 'Numeric', constraintJson: null },
          { id: 'm-2', observationId: 'obs-1', name: 'Quality', type: 'Numeric', constraintJson: null },
          { id: 'm-3', observationId: 'obs-2', name: 'Intensity', type: 'Numeric', constraintJson: null }
        ]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);

      expect(result[0].id).toBe('obs-1');
      expect(result[0].name).toBe('Sleep Quality');
      expect(result[0].metrics).toHaveLength(2);
      expect(result[0].metrics[0].name).toBe('Duration');
      expect(result[0].metrics[1].name).toBe('Quality');

      expect(result[1].id).toBe('obs-2');
      expect(result[1].name).toBe('Mood');
      expect(result[1].metrics).toHaveLength(1);
      expect(result[1].metrics[0].name).toBe('Intensity');
    });

    it('should handle observations with no metrics', async () => {
      mockGetAllAsync
        .mockResolvedValueOnce([
          { id: 'obs-1', name: 'Weather', createdAt: 1000 }
        ])
        .mockResolvedValueOnce([]);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('obs-1');
      expect(result[0].name).toBe('Weather');
      expect(result[0].metrics).toHaveLength(0);
    });

    it('should reconstruct metric constraints from JSON', async () => {
      mockGetAllAsync
        .mockResolvedValueOnce([
          { id: 'obs-1', name: 'Temperature', createdAt: 1000 }
        ])
        .mockResolvedValueOnce([
          {
            id: 'm-1',
            observationId: 'obs-1',
            name: 'Degrees',
            type: 'Numeric',
            constraintJson: JSON.stringify({ min: -40, max: 60 })
          }
        ]);

      const result = await repository.findAll();

      expect(result[0].metrics[0].constraint).toEqual({ min: -40, max: 60 });
    });
  });

  describe('delete', () => {
    it('should delete an observation by ID', async () => {
      await repository.delete('obs-1');

      expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
      expect(mockRunAsync).toHaveBeenCalledWith(
        'DELETE FROM observations WHERE id = ?',
        'obs-1'
      );
    });
  });
});
