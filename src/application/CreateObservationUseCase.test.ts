import {beforeEach, describe, expect, it, vi} from 'vitest';
import {CreateObservationUseCase} from './CreateObservationUseCase';
import {ObservationRepository} from './ObservationRepository';
import {Observation} from '../domain/Observation';

// Mock expo-crypto
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
});
