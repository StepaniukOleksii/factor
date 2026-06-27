import {describe, expect, it, vi} from 'vitest';
import {GetObservationByIdUseCase} from './GetObservationByIdUseCase';
import {ObservationRepository} from './ObservationRepository';
import {Observation} from '../domain/Observation';

describe('GetObservationByIdUseCase', () => {
  it('returns the observation if found', async () => {
    const observation1 = new Observation('obs-1', 'Sleep');
    const observation2 = new Observation('obs-2', 'Mood');

    const mockRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([observation1, observation2]),
      delete: vi.fn(),
    };

    const useCase = new GetObservationByIdUseCase(mockRepo);
    const result = await useCase.execute('obs-2');

    expect(result).toBe(observation2);
  });

  it('returns null if observation is not found', async () => {
    const mockRepo: ObservationRepository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    };

    const useCase = new GetObservationByIdUseCase(mockRepo);
    const result = await useCase.execute('obs-3');

    expect(result).toBeNull();
  });
});
