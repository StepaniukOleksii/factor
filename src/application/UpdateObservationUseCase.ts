import {ObservationRepository} from './ObservationRepository';
import {toStoredText} from './CreateObservationUseCase';
import {firstErrorMessage, validateObservationIdentity} from './validateCreateObservation';

export interface UpdateObservationInput {
  observationId: string;
  name: string;
  description?: string;
}

export class UpdateObservationUseCase {
  constructor(private readonly observationRepository: ObservationRepository) {}

  public async execute(input: UpdateObservationInput): Promise<void> {
    const stored = await this.observationRepository.findAll();
    const observation = stored.find(candidate => candidate.id === input.observationId);
    if (!observation) {
      throw new Error('Observation not found');
    }

    // Excluded by id rather than by name, so a correction to the subject's own
    // casing is not refused against the spelling it replaces.
    const takenNames = stored
      .filter(candidate => candidate.id !== input.observationId)
      .map(candidate => candidate.name);

    const message = firstErrorMessage(
      validateObservationIdentity(input.name, input.description, takenNames)
    );
    if (message !== undefined) {
      throw new Error(message);
    }

    observation.name = input.name.trim();
    observation.description = toStoredText(input.description);

    await this.observationRepository.update(observation);
  }
}
