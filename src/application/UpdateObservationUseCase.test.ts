import {beforeEach, describe, expect, it, vi} from 'vitest';
import {UpdateObservationUseCase} from './UpdateObservationUseCase';
import {ObservationRepository} from './ObservationRepository';
import {Metric} from '../domain/Metric';
import {Observation} from '../domain/Observation';
import {OBSERVATION_NAME_MAX_LENGTH} from '../domain/validationLimits';

// Reached through the shared `toStoredText`, whose module builds ids for
// creation; Node cannot parse what the real one imports.
vi.mock('expo-crypto', () => ({randomUUID: () => 'unused'}));

/**
 * The subject and a second Observation to collide against. The subject carries
 * Metrics and a description, so a write that disturbed either would show.
 */
function storedObservations(): Observation[] {
  return [
    new Observation(
      'obs-1',
      'Sleep',
      [new Metric('metric-1', 'Hours', 'Numeric'), new Metric('metric-2', 'Quality', 'Text')],
      'How I slept',
    ),
    new Observation('obs-2', 'Mood', [new Metric('metric-3', 'Level', 'Numeric')]),
  ];
}

describe('UpdateObservationUseCase', () => {
  let stored: Observation[];
  let repository: ObservationRepository;
  let useCase: UpdateObservationUseCase;

  beforeEach(() => {
    stored = storedObservations();
    repository = {
      save: vi.fn(),
      findAll: vi.fn().mockResolvedValue(stored),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    };
    useCase = new UpdateObservationUseCase(repository);
  });

  /** The Observation handed to `update` by the one call the use case made. */
  function updated(): Observation {
    return (repository.update as any).mock.calls[0][0] as Observation;
  }

  it('writes a new name and description', async () => {
    await useCase.execute({observationId: 'obs-1', name: 'Rest', description: 'How I rested'});

    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(updated().name).toBe('Rest');
    expect(updated().description).toBe('How I rested');
  });

  it('trims the name and the description', async () => {
    await useCase.execute({observationId: 'obs-1', name: '  Rest  ', description: '  How I rested  '});

    expect(updated().name).toBe('Rest');
    expect(updated().description).toBe('How I rested');
  });

  it.each([['an empty string', ''], ['whitespace', '   '], ['nothing at all', undefined]])(
    'stores a description of %s as null',
    async (_kind, description) => {
      await useCase.execute({observationId: 'obs-1', name: 'Sleep', description});

      expect(updated().description).toBeNull();
    },
  );

  it('keeps the Observation and its Metrics, writing only what it was given', async () => {
    await useCase.execute({observationId: 'obs-1', name: 'Rest'});

    expect(updated().id).toBe('obs-1');
    expect(updated().metrics.map(metric => metric.id)).toEqual(['metric-1', 'metric-2']);
  });

  it.each([['unchanged', 'Sleep'], ['cased differently', 'SLEEP']])(
    'accepts the subject\'s own name %s',
    async (_kind, name) => {
      await useCase.execute({observationId: 'obs-1', name});

      expect(updated().name).toBe(name);
    },
  );

  it('refuses a name another Observation holds', async () => {
    await expect(useCase.execute({observationId: 'obs-1', name: 'mood'}))
      .rejects.toThrow('An observation with this name already exists');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuses an empty name', async () => {
    await expect(useCase.execute({observationId: 'obs-1', name: '   '}))
      .rejects.toThrow('Observation name cannot be empty');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuses an over-long name', async () => {
    const name = 'a'.repeat(OBSERVATION_NAME_MAX_LENGTH + 1);

    await expect(useCase.execute({observationId: 'obs-1', name}))
      .rejects.toThrow('Observation name cannot exceed 30 characters');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('throws for an observationId no Observation holds', async () => {
    await expect(useCase.execute({observationId: 'obs-404', name: 'Rest'}))
      .rejects.toThrow('Observation not found');
    expect(repository.update).not.toHaveBeenCalled();
  });
});
