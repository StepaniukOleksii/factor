import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CreateObservationUseCase} from './CreateObservationUseCase';
import {ObservationRepository} from './ObservationRepository';
import {Observation} from '../domain/Observation';

vi.mock('expo-crypto', () => ({
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 11)
}));

describe('CreateObservationUseCase', () => {
  let mockRepository: ObservationRepository;
  let useCase: CreateObservationUseCase;

  beforeEach(() => {
    mockRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findAll: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new CreateObservationUseCase(mockRepository);
  });

  it('should successfully create an observation with metrics', async () => {
    const input = {
      name: 'Coffee',
      metrics: [
        {name: 'Cups', type: 'Numeric'},
        {name: 'Roast', type: 'Text'}
      ]
    };

    await useCase.execute(input);

    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    const savedObservation = (mockRepository.save as any).mock.calls[0][0] as Observation;
    
    expect(savedObservation.name).toBe('Coffee');
    expect(savedObservation.metrics).toHaveLength(2);
    expect(savedObservation.metrics[0].name).toBe('Cups');
    expect(savedObservation.metrics[0].type).toBe('Numeric');
    expect(savedObservation.metrics[1].name).toBe('Roast');
    expect(savedObservation.metrics[1].type).toBe('Text');
  });

  it('should throw error if observation name is empty', async () => {
    const input = {
      name: '   ',
      metrics: [{name: 'Cups', type: 'Numeric'}]
    };

    await expect(useCase.execute(input)).rejects.toThrow('Observation name cannot be empty');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should accept an observation name of exactly 30 characters', async () => {
    const name = 'a'.repeat(30);
    const input = {
      name,
      metrics: [{name: 'Cups', type: 'Numeric'}]
    };

    await useCase.execute(input);

    const savedObservation = (mockRepository.save as any).mock.calls[0][0] as Observation;
    expect(savedObservation.name).toBe(name);
  });

  it('should throw error if observation name exceeds 30 characters', async () => {
    const input = {
      name: 'a'.repeat(31),
      metrics: [{name: 'Cups', type: 'Numeric'}]
    };

    await expect(useCase.execute(input)).rejects.toThrow('Observation name cannot exceed 30 characters');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should throw error if metrics are empty', async () => {
    const input = {
      name: 'Coffee',
      metrics: []
    };

    await expect(useCase.execute(input)).rejects.toThrow('At least one metric is required');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
  
  it('should throw error if metric name is empty', async () => {
    const input = {
      name: 'Coffee',
      metrics: [{name: '   ', type: 'Numeric'}]
    };

    await expect(useCase.execute(input)).rejects.toThrow('Metric name cannot be empty');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should accept a metric name of exactly 15 characters', async () => {
    const metricName = 'a'.repeat(15);
    const input = {
      name: 'Coffee',
      metrics: [{name: metricName, type: 'Numeric'}]
    };

    await useCase.execute(input);

    const savedObservation = (mockRepository.save as any).mock.calls[0][0] as Observation;
    expect(savedObservation.metrics[0].name).toBe(metricName);
  });

  it('should throw error if metric name exceeds 15 characters', async () => {
    const input = {
      name: 'Coffee',
      metrics: [{name: 'a'.repeat(16), type: 'Numeric'}]
    };

    await expect(useCase.execute(input)).rejects.toThrow('Metric name cannot exceed 15 characters');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should accept and trim a valid description', async () => {
    const input = {
      name: 'Coffee',
      description: '  Track my daily coffee intake  ',
      metrics: [{name: 'Cups', type: 'Numeric'}]
    };

    await useCase.execute(input);

    const savedObservation = (mockRepository.save as any).mock.calls[0][0] as Observation;
    expect(savedObservation.description).toBe('Track my daily coffee intake');
  });

  it('should accept a description of exactly 150 characters', async () => {
    const description = 'a'.repeat(150);
    const input = {
      name: 'Coffee',
      description,
      metrics: [{name: 'Cups', type: 'Numeric'}]
    };

    await useCase.execute(input);

    const savedObservation = (mockRepository.save as any).mock.calls[0][0] as Observation;
    expect(savedObservation.description).toBe(description);
  });

  it('should reject a description longer than 150 characters', async () => {
    const input = {
      name: 'Coffee',
      description: 'a'.repeat(151),
      metrics: [{name: 'Cups', type: 'Numeric'}]
    };

    await expect(useCase.execute(input)).rejects.toThrow('Observation description cannot exceed 150 characters');
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should normalize a whitespace-only description to null', async () => {
    const input = {
      name: 'Coffee',
      description: '   ',
      metrics: [{name: 'Cups', type: 'Numeric'}]
    };

    await useCase.execute(input);

    const savedObservation = (mockRepository.save as any).mock.calls[0][0] as Observation;
    expect(savedObservation.description).toBeNull();
  });

  it('should default description to null when omitted', async () => {
    const input = {
      name: 'Coffee',
      metrics: [{name: 'Cups', type: 'Numeric'}]
    };

    await useCase.execute(input);

    const savedObservation = (mockRepository.save as any).mock.calls[0][0] as Observation;
    expect(savedObservation.description).toBeNull();
  });

  describe('metric descriptions', () => {
    const savedMetrics = () =>
      ((mockRepository.save as any).mock.calls[0][0] as Observation).metrics;

    it('should accept and trim a valid metric description', async () => {
      await useCase.execute({
        name: 'Coffee',
        metrics: [{name: 'Cups', type: 'Numeric', description: '  Mugs, not espresso shots.  '}]
      });

      expect(savedMetrics()[0].description).toBe('Mugs, not espresso shots.');
    });

    it('should accept a metric description of exactly 500 characters', async () => {
      const description = 'a'.repeat(500);

      await useCase.execute({
        name: 'Coffee',
        metrics: [{name: 'Cups', type: 'Numeric', description}]
      });

      expect(savedMetrics()[0].description).toBe(description);
    });

    it('should reject a metric description longer than 500 characters', async () => {
      const input = {
        name: 'Coffee',
        metrics: [{name: 'Cups', type: 'Numeric', description: 'a'.repeat(501)}]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Metric description cannot exceed 500 characters');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should normalize an empty or whitespace-only metric description to null', async () => {
      await useCase.execute({
        name: 'Coffee',
        metrics: [
          {name: 'Cups', type: 'Numeric', description: ''},
          {name: 'Roast', type: 'Text', description: '   '}
        ]
      });

      expect(savedMetrics()[0].description).toBeNull();
      expect(savedMetrics()[1].description).toBeNull();
    });

    it('should default a metric description to null when omitted', async () => {
      await useCase.execute({
        name: 'Coffee',
        metrics: [{name: 'Cups', type: 'Numeric'}]
      });

      expect(savedMetrics()[0].description).toBeNull();
    });

    // A per-value legend is only readable as a list if the line breaks survive.
    it('should trim the ends of a metric description while keeping interior newlines', async () => {
      await useCase.execute({
        name: 'Mood',
        metrics: [{name: 'Score', type: 'Numeric', description: '\n 1 = low\n3 = ok\n5 = great \n'}]
      });

      expect(savedMetrics()[0].description).toBe('1 = low\n3 = ok\n5 = great');
    });

    it('should validate each metric description independently', async () => {
      const input = {
        name: 'Coffee',
        metrics: [
          {name: 'Cups', type: 'Numeric', description: 'Fine.'},
          {name: 'Roast', type: 'Text', description: 'a'.repeat(501)}
        ]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Metric description cannot exceed 500 characters');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should keep each metric to its own description', async () => {
      await useCase.execute({
        name: 'Coffee',
        metrics: [
          {name: 'Cups', type: 'Numeric', description: 'Mugs, not espresso shots.'},
          {name: 'Roast', type: 'Text'}
        ]
      });

      expect(savedMetrics()[0].description).toBe('Mugs, not espresso shots.');
      expect(savedMetrics()[1].description).toBeNull();
    });
  });

  describe('metric bounds', () => {
    const savedMetrics = () =>
      ((mockRepository.save as any).mock.calls[0][0] as Observation).metrics;

    it('should accept both bounds', async () => {
      await useCase.execute({
        name: 'Mood',
        metrics: [{name: 'Level', type: 'Numeric', min: '1', max: '5'}]
      });

      expect(savedMetrics()[0].constraint).toEqual({min: 1, max: 5});
    });

    it('should accept a minimum alone', async () => {
      await useCase.execute({
        name: 'Mood',
        metrics: [{name: 'Level', type: 'Numeric', min: '1'}]
      });

      expect(savedMetrics()[0].constraint).toEqual({min: 1});
    });

    it('should accept a maximum alone', async () => {
      await useCase.execute({
        name: 'Mood',
        metrics: [{name: 'Level', type: 'Numeric', max: '5'}]
      });

      expect(savedMetrics()[0].constraint).toEqual({max: 5});
    });

    // `{}` would persist as a meaningless `"{}"` and read as "bounded" to
    // anything testing the field for presence.
    it('should leave a Metric given neither bound unconstrained rather than empty-constrained', async () => {
      await useCase.execute({
        name: 'Mood',
        metrics: [{name: 'Level', type: 'Numeric'}]
      });

      expect(savedMetrics()[0].constraint).toBeNull();
    });

    it.each([
      ['empty', ''],
      ['whitespace-only', '   '],
    ])('should treat an %s bound as unset', async (_kind, bound) => {
      await useCase.execute({
        name: 'Mood',
        metrics: [{name: 'Level', type: 'Numeric', min: bound, max: bound}]
      });

      expect(savedMetrics()[0].constraint).toBeNull();
    });

    it('should keep the bound that was given when the other is blank', async () => {
      await useCase.execute({
        name: 'Mood',
        metrics: [{name: 'Level', type: 'Numeric', min: '  ', max: '5'}]
      });

      expect(savedMetrics()[0].constraint).toEqual({max: 5});
    });

    it('should accept negative bounds', async () => {
      await useCase.execute({
        name: 'Weather',
        metrics: [{name: 'Degrees', type: 'Numeric', min: '-40', max: '-5'}]
      });

      expect(savedMetrics()[0].constraint).toEqual({min: -40, max: -5});
    });

    it('should accept fractional bounds', async () => {
      await useCase.execute({
        name: 'Sleep',
        metrics: [{name: 'Hours', type: 'Numeric', min: '0.5', max: '12.25'}]
      });

      expect(savedMetrics()[0].constraint).toEqual({min: 0.5, max: 12.25});
    });

    // The one-value range: a bound is inside the range it defines, so this
    // accepts exactly that value rather than nothing at all.
    it('should accept a minimum equal to its maximum', async () => {
      await useCase.execute({
        name: 'Mood',
        metrics: [{name: 'Level', type: 'Numeric', min: '3', max: '3'}]
      });

      expect(savedMetrics()[0].constraint).toEqual({min: 3, max: 3});
    });

    it.each([
      ['an unparseable', {min: 'low'}],
      ['a non-finite', {max: 'Infinity'}],
    ])('should reject %s bound', async (_kind, bounds) => {
      const input = {
        name: 'Mood',
        metrics: [{name: 'Level', type: 'Numeric', ...bounds}]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Metric bounds must be numbers');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should reject a minimum above its maximum', async () => {
      const input = {
        name: 'Mood',
        metrics: [{name: 'Level', type: 'Numeric', min: '5', max: '1'}]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Metric minimum cannot exceed its maximum');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it.each(['Text', 'Boolean', 'Enum'])('should reject a bound on a %s metric', async type => {
      const input = {
        name: 'Coffee',
        metrics: [{name: 'Roast', type, max: '5'}]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Only a Numeric metric can have bounds');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should leave a non-Numeric metric given no bounds alone', async () => {
      await useCase.execute({
        name: 'Coffee',
        metrics: [{name: 'Roast', type: 'Text', min: '', max: '   '}]
      });

      expect(savedMetrics()[0].constraint).toBeNull();
    });

    it('should validate each metric independently', async () => {
      const input = {
        name: 'Coffee',
        metrics: [
          {name: 'Cups', type: 'Numeric', min: '0', max: '10'},
          {name: 'Strength', type: 'Numeric', min: '10', max: '0'}
        ]
      };

      await expect(useCase.execute(input)).rejects.toThrow('Metric minimum cannot exceed its maximum');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should keep each metric to its own bounds', async () => {
      await useCase.execute({
        name: 'Coffee',
        metrics: [
          {name: 'Cups', type: 'Numeric', min: '0', max: '10'},
          {name: 'Strength', type: 'Numeric'},
          {name: 'Roast', type: 'Text'}
        ]
      });

      expect(savedMetrics()[0].constraint).toEqual({min: 0, max: 10});
      expect(savedMetrics()[1].constraint).toBeNull();
      expect(savedMetrics()[2].constraint).toBeNull();
    });
  });
});
