import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SQLiteObservationRepository} from './SQLiteObservationRepository';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';

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
      'INSERT INTO metrics (id, observationId, position, name, type, constraintJson, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      'metric-1',
      'obs-1',
      0,
      'Temperature',
      'Numeric',
      null,
      null
    );

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      3,
      'INSERT INTO metrics (id, observationId, position, name, type, constraintJson, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      'metric-2',
      'obs-1',
      1,
      'Condition',
      'Text',
      null,
      null
    );
  });

  it('should persist each metric description, including null and one with newlines', async () => {
    const metrics = [
      new Metric('metric-1', 'Temperature', 'Numeric', null, 'Degrees Celsius, outdoors.'),
      new Metric('metric-2', 'Condition', 'Text', null, 'One of:\nclear\nrain\nsnow'),
      new Metric('metric-3', 'Windy', 'Boolean')
    ];
    const observation = new Observation('obs-1', 'Weather', metrics);

    await repository.save(observation);

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      2, expect.any(String), 'metric-1', 'obs-1', 0, 'Temperature', 'Numeric', null,
      'Degrees Celsius, outdoors.'
    );
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      3, expect.any(String), 'metric-2', 'obs-1', 1, 'Condition', 'Text', null,
      'One of:\nclear\nrain\nsnow'
    );
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      4, expect.any(String), 'metric-3', 'obs-1', 2, 'Windy', 'Boolean', null, null
    );
  });

  it('should persist each bound shape as JSON carrying exactly the bounds set', async () => {
    const metrics = [
      new Metric('metric-1', 'Level', 'Numeric', {min: 1, max: 5}),
      new Metric('metric-2', 'Floor', 'Numeric', {min: -40}),
      new Metric('metric-3', 'Ceiling', 'Numeric', {max: 0.5}),
      new Metric('metric-4', 'Free', 'Numeric')
    ];
    const observation = new Observation('obs-1', 'Mood', metrics);

    await repository.save(observation);

    expect(mockRunAsync).toHaveBeenNthCalledWith(
      2, expect.any(String), 'metric-1', 'obs-1', 0, 'Level', 'Numeric', '{"min":1,"max":5}', null
    );
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      3, expect.any(String), 'metric-2', 'obs-1', 1, 'Floor', 'Numeric', '{"min":-40}', null
    );
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      4, expect.any(String), 'metric-3', 'obs-1', 2, 'Ceiling', 'Numeric', '{"max":0.5}', null
    );
    expect(mockRunAsync).toHaveBeenNthCalledWith(
      5, expect.any(String), 'metric-4', 'obs-1', 3, 'Free', 'Numeric', null, null
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

  describe('createdAt', () => {
    // A backdated one as well as a fresh one: the seed fixtures state when they
    // were created, and only a repository that stores what the entity carries
    // can keep that.
    it.each([
      ['the moment it was constructed', new Date()],
      ['a backdated one', new Date('2025-03-14T09:00:00.000Z')],
    ])('should write %s as the entity carries it', async (_kind, created) => {
      const observation = new Observation('obs-1', 'Weather', [], null, created);

      await repository.save(observation);

      expect(mockRunAsync).toHaveBeenNthCalledWith(
        1,
        'INSERT INTO observations (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
        'obs-1',
        'Weather',
        null,
        created.getTime()
      );
    });

    it('should read a stored createdAt back onto the observation', async () => {
      const created = new Date('2025-03-14T09:00:00.000Z');
      mockGetAllAsync
        .mockResolvedValueOnce([
          { id: 'obs-1', name: 'Weather', description: null, createdAt: created.getTime() }
        ])
        .mockResolvedValueOnce([]);

      const result = await repository.findAll();

      expect(result[0].createdAt).toEqual(created);
    });

    it('should leave the newest-created ordering to the query, and keep it', async () => {
      mockGetAllAsync
        .mockResolvedValueOnce([
          { id: 'obs-1', name: 'Newer', description: null, createdAt: 2000 },
          { id: 'obs-2', name: 'Older', description: null, createdAt: 1000 }
        ])
        .mockResolvedValueOnce([]);

      const result = await repository.findAll();

      expect(mockGetAllAsync).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('ORDER BY createdAt DESC')
      );
      expect(result.map(observation => observation.name)).toEqual(['Newer', 'Older']);
    });
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

    it('should read back a bound on its own, and no constraint at all', async () => {
      mockGetAllAsync
        .mockResolvedValueOnce([
          { id: 'obs-1', name: 'Mood', createdAt: 1000 }
        ])
        .mockResolvedValueOnce([
          {
            id: 'm-1', observationId: 'obs-1', name: 'Floor', type: 'Numeric',
            constraintJson: JSON.stringify({ min: 0 })
          },
          {
            id: 'm-2', observationId: 'obs-1', name: 'Ceiling', type: 'Numeric',
            constraintJson: JSON.stringify({ max: 100 })
          },
          {
            id: 'm-3', observationId: 'obs-1', name: 'Free', type: 'Numeric',
            constraintJson: null
          }
        ]);

      const result = await repository.findAll();

      expect(result[0].metrics[0].constraint).toEqual({ min: 0 });
      expect(result[0].metrics[1].constraint).toEqual({ max: 100 });
      expect(result[0].metrics[2].constraint).toBeNull();
    });

    // The one path a constraint takes end to end: what `save` wrote is exactly
    // what `findAll` is handed to parse back.
    it('should round-trip a choice metric\'s values in order, beside a bounded Numeric metric', async () => {
      const observation = new Observation('obs-1', 'Mood', [
        new Metric('m-1', 'level', 'Enum', {allowedValues: ['low', 'ok', 'high']}),
        new Metric('m-2', 'hours', 'Numeric', {min: 0, max: 12})
      ]);
      await repository.save(observation);
      const metricRows = mockRunAsync.mock.calls
        .slice(1)
        // The holes are the SQL and the written position, neither of which the
        // read selects.
        .map(([, id, observationId, , name, type, constraintJson, description]) =>
          ({id, observationId, name, type, constraintJson, description}));

      mockGetAllAsync
        .mockResolvedValueOnce([{ id: 'obs-1', name: 'Mood', description: null, createdAt: 1000 }])
        .mockResolvedValueOnce(metricRows);
      const result = await repository.findAll();

      expect(result[0].metrics[0].constraint).toEqual({ allowedValues: ['low', 'ok', 'high'] });
      expect(result[0].metrics[1].constraint).toEqual({ min: 0, max: 12 });
    });

    it('should round-trip each metric description, including null and one with newlines', async () => {
      mockGetAllAsync
        .mockResolvedValueOnce([
          { id: 'obs-1', name: 'Weather', description: null, createdAt: 1000 }
        ])
        .mockResolvedValueOnce([
          {
            id: 'm-1', observationId: 'obs-1', name: 'Degrees', type: 'Numeric',
            constraintJson: null, description: 'Degrees Celsius, outdoors.'
          },
          {
            id: 'm-2', observationId: 'obs-1', name: 'Condition', type: 'Text',
            constraintJson: null, description: 'One of:\nclear\nrain\nsnow'
          },
          {
            id: 'm-3', observationId: 'obs-1', name: 'Windy', type: 'Boolean',
            constraintJson: null, description: null
          }
        ]);

      const result = await repository.findAll();

      expect(mockGetAllAsync).toHaveBeenLastCalledWith(
        'SELECT id, observationId, name, type, constraintJson, description FROM metrics ORDER BY observationId, position'
      );
      expect(result[0].metrics[0].description).toBe('Degrees Celsius, outdoors.');
      expect(result[0].metrics[1].description).toBe('One of:\nclear\nrain\nsnow');
      expect(result[0].metrics[2].description).toBeNull();
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
