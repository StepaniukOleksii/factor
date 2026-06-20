import {beforeEach, describe, expect, it, vi} from 'vitest';
import {GetObservationsUseCase} from './GetObservationsUseCase';
import {ObservationRepository} from './ObservationRepository';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';

describe('GetObservationsUseCase', () => {
  let mockRepository: ObservationRepository;
  let useCase: GetObservationsUseCase;

  beforeEach(() => {
    mockRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findAll: vi.fn().mockResolvedValue([])
    };
    useCase = new GetObservationsUseCase(mockRepository);
  });

  it('should return the list of observations from the repository', async () => {
    const observations = [
      new Observation('obs-1', 'Sleep Quality', [
        new Metric('m-1', 'Duration', 'Numeric'),
        new Metric('m-2', 'Quality', 'Numeric')
      ]),
      new Observation('obs-2', 'Mood', [
        new Metric('m-3', 'Intensity', 'Numeric')
      ])
    ];
    (mockRepository.findAll as ReturnType<typeof vi.fn>).mockResolvedValue(observations);

    const result = await useCase.execute();

    expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Sleep Quality');
    expect(result[0].metrics).toHaveLength(2);
    expect(result[1].name).toBe('Mood');
    expect(result[1].metrics).toHaveLength(1);
  });

  it('should return an empty array when no observations exist', async () => {
    const result = await useCase.execute();

    expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });
});
