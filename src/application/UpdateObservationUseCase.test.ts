import {beforeEach, describe, expect, it, vi} from 'vitest';
import {UpdateObservationInput, UpdateMetricInput, UpdateObservationUseCase} from './UpdateObservationUseCase';
import {ObservationRepository} from './ObservationRepository';
import {Metric, NumericConstraint} from '../domain/Metric';
import {Observation} from '../domain/Observation';
import {METRIC_NAME_MAX_LENGTH, OBSERVATION_NAME_MAX_LENGTH} from '../domain/validationLimits';

vi.mock('expo-crypto', () => ({randomUUID: () => 'metric-new'}));

/**
 * The subject and a second Observation to collide against. The subject's first
 * Metric is bounded and described, so a write past the two fields an edit
 * reaches would show.
 */
function storedObservations(): Observation[] {
  return [
    new Observation(
      'obs-1',
      'Sleep',
      [
        new Metric('metric-1', 'Hours', 'Numeric', {min: 0, max: 24}, 'Time asleep'),
        new Metric('metric-2', 'Quality', 'Text'),
      ],
      'How I slept',
    ),
    new Observation('obs-2', 'Mood', [new Metric('metric-3', 'Level', 'Numeric')]),
  ];
}

/** The subject's Metrics as the form submits them back unchanged. */
function storedMetricInputs(): UpdateMetricInput[] {
  return [
    {id: 'metric-1', name: 'Hours', type: 'Numeric', description: 'Time asleep', min: '0', max: '24'},
    {id: 'metric-2', name: 'Quality', type: 'Text'},
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

  function edit(overrides: Partial<UpdateObservationInput> = {}): UpdateObservationInput {
    return {observationId: 'obs-1', name: 'Sleep', metrics: storedMetricInputs(), ...overrides};
  }

  function updated(): Observation {
    return (repository.update as any).mock.calls[0][0] as Observation;
  }

  function updatedMetric(id: string): Metric {
    return updated().metrics.find(metric => metric.id === id)!;
  }

  it('writes a new name and description', async () => {
    await useCase.execute(edit({name: 'Rest', description: 'How I rested'}));

    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(updated().name).toBe('Rest');
    expect(updated().description).toBe('How I rested');
  });

  it('trims the name and the description', async () => {
    await useCase.execute(edit({name: '  Rest  ', description: '  How I rested  '}));

    expect(updated().name).toBe('Rest');
    expect(updated().description).toBe('How I rested');
  });

  it.each([['an empty string', ''], ['whitespace', '   '], ['nothing at all', undefined]])(
    'stores a description of %s as null',
    async (_kind, description) => {
      await useCase.execute(edit({description}));

      expect(updated().description).toBeNull();
    },
  );

  it('keeps the Observation it was given, and the time it was created', async () => {
    await useCase.execute(edit({name: 'Rest'}));

    expect(updated().id).toBe('obs-1');
    expect(updated().createdAt).toEqual(stored[0].createdAt);
  });

  it.each([['unchanged', 'Sleep'], ['cased differently', 'SLEEP']])(
    'accepts the subject\'s own name %s',
    async (_kind, name) => {
      await useCase.execute(edit({name}));

      expect(updated().name).toBe(name);
    },
  );

  it('refuses a name another Observation holds', async () => {
    await expect(useCase.execute(edit({name: 'mood'})))
      .rejects.toThrow('An observation with this name already exists');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuses an empty name', async () => {
    await expect(useCase.execute(edit({name: '   '})))
      .rejects.toThrow('Observation name cannot be empty');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuses an over-long name', async () => {
    const name = 'a'.repeat(OBSERVATION_NAME_MAX_LENGTH + 1);

    await expect(useCase.execute(edit({name})))
      .rejects.toThrow('Observation name cannot exceed 30 characters');
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('throws for an observationId no Observation holds', async () => {
    await expect(useCase.execute(edit({observationId: 'obs-404'})))
      .rejects.toThrow('Observation not found');
    expect(repository.update).not.toHaveBeenCalled();
  });

  describe('a stored Metric', () => {
    it('is renamed and redescribed under the id it already has', async () => {
      const metrics = storedMetricInputs();
      metrics[0] = {...metrics[0], name: ' Duration ', description: ' Hours in bed '};

      await useCase.execute(edit({metrics}));

      expect(updatedMetric('metric-1').name).toBe('Duration');
      expect(updatedMetric('metric-1').description).toBe('Hours in bed');
    });

    it('keeps its type and its constraint whatever was submitted beside them', async () => {
      const metrics = storedMetricInputs();
      metrics[0] = {...metrics[0], name: 'Duration', type: 'Text', min: '5', max: '9', values: ['a', 'b']};

      await useCase.execute(edit({metrics}));

      expect(updatedMetric('metric-1').type).toBe('Numeric');
      expect(updatedMetric('metric-1').constraint).toEqual({min: 0, max: 24});
    });

    it('keeps its position among the others', async () => {
      const metrics = storedMetricInputs();
      metrics[0] = {...metrics[0], name: 'Duration'};

      await useCase.execute(edit({metrics}));

      expect(updated().metrics.map(metric => metric.id)).toEqual(['metric-1', 'metric-2']);
    });

    it('has its description cleared by an emptied field', async () => {
      const metrics = storedMetricInputs();
      metrics[0] = {...metrics[0], description: '   '};

      await useCase.execute(edit({metrics}));

      expect(updatedMetric('metric-1').description).toBeNull();
    });

    it('may exchange names with another, which no single-Metric write could allow', async () => {
      await useCase.execute(edit({
        metrics: [
          {id: 'metric-1', name: 'Quality', type: 'Numeric'},
          {id: 'metric-2', name: 'Hours', type: 'Text'},
        ],
      }));

      expect(updatedMetric('metric-1').name).toBe('Quality');
      expect(updatedMetric('metric-2').name).toBe('Hours');
    });

    it('is removed by being left off the submission', async () => {
      await useCase.execute(edit({metrics: [storedMetricInputs()[0]]}));

      expect(updated().metrics.map(metric => metric.id)).toEqual(['metric-1']);
    });

    it('cannot be the last one, leaving the Observation with none', async () => {
      await expect(useCase.execute(edit({metrics: []})))
        .rejects.toThrow('At least one metric is required');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('is refused under an id the Observation does not hold', async () => {
      const metrics = [...storedMetricInputs(), {id: 'metric-404', name: 'Ghost', type: 'Text'}];

      await expect(useCase.execute(edit({metrics}))).rejects.toThrow('Metric not found');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('is removed alongside a rename and an addition taking its name', async () => {
      await useCase.execute(edit({
        metrics: [
          {id: 'metric-1', name: 'Duration', type: 'Numeric'},
          {name: 'Quality', type: 'Text'},
        ],
      }));

      expect(repository.update).toHaveBeenCalledTimes(1);
      expect(updated().metrics.map(metric => [metric.id, metric.name]))
        .toEqual([['metric-1', 'Duration'], ['metric-new', 'Quality']]);
    });
  });

  describe('a Metric being added', () => {
    const added: UpdateMetricInput = {name: ' Caffeine ', type: 'Numeric', min: '0', description: ' Cups '};

    it('is appended under a fresh id, after every stored Metric', async () => {
      await useCase.execute(edit({metrics: [...storedMetricInputs(), added]}));

      expect(updated().metrics.map(metric => metric.id))
        .toEqual(['metric-1', 'metric-2', 'metric-new']);
    });

    it('carries the name, description and constraint its type declares', async () => {
      await useCase.execute(edit({metrics: [...storedMetricInputs(), added]}));

      expect(updatedMetric('metric-new').name).toBe('Caffeine');
      expect(updatedMetric('metric-new').description).toBe('Cups');
      expect(updatedMetric('metric-new').type).toBe('Numeric');
      expect(updatedMetric('metric-new').constraint as NumericConstraint).toEqual({min: 0});
    });

    it('is built with the values a Choice declares', async () => {
      const choice: UpdateMetricInput = {name: 'Weather', type: 'Enum', values: ['sunny', 'rainy']};

      await useCase.execute(edit({metrics: [...storedMetricInputs(), choice]}));

      expect(updatedMetric('metric-new').constraint).toEqual({allowedValues: ['sunny', 'rainy']});
    });

    it('is refused an over-long name', async () => {
      const name = 'a'.repeat(METRIC_NAME_MAX_LENGTH + 1);

      await expect(useCase.execute(edit({metrics: [...storedMetricInputs(), {...added, name}]})))
        .rejects.toThrow('Metric name cannot exceed 15 characters');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('is refused a name a stored Metric already holds', async () => {
      await expect(useCase.execute(edit({metrics: [...storedMetricInputs(), {...added, name: 'hours'}]})))
        .rejects.toThrow('Metric names must be unique');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('is refused an incoherent range, which a stored Metric is never judged on', async () => {
      await expect(useCase.execute(edit({
        metrics: [...storedMetricInputs(), {...added, min: '9', max: '5'}],
      }))).rejects.toThrow('Metric minimum cannot exceed its maximum');
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});
