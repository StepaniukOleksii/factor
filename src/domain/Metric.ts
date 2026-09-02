import {Entity} from './Entity';

export type MetricValueType = 'Numeric' | 'Boolean' | 'Enum' | 'Text';

export interface NumericConstraint {
  min?: number;
  max?: number;
}

export interface EnumConstraint {
  allowedValues: string[];
}

export type MetricConstraint = NumericConstraint | EnumConstraint | null;

export class Metric extends Entity<string> {
  public name: string;
  public readonly type: MetricValueType;
  public constraint: MetricConstraint;
  /**
   * Optional prose explaining what this Metric means and what its values stand
   * for - guidance for the person entering a value, so deliberately no part of
   * `validateValue`: it never constrains the value itself.
   */
  public description: string | null;
  /**
   * What this Metric's numbers count, shown after its name wherever the Metric
   * is named. Beside `description` in being no part of `validateValue`: it says
   * what a number means, never what it may be.
   */
  public unit: string | null;

  constructor(
    id: string,
    name: string,
    type: MetricValueType,
    constraint: MetricConstraint = null,
    description: string | null = null,
    unit: string | null = null
  ) {
    super(id);
    this.name = name;
    this.type = type;
    this.constraint = constraint;
    this.description = description;
    this.unit = unit;
  }

  public normalizeValue(value: any): any {
    return this.type === 'Text' && typeof value === 'string' ? value.trim() : value;
  }

  public validateValue(value: any): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    switch (this.type) {
      case 'Numeric':
        if (typeof value !== 'number') return false;
        const numConstraint = this.constraint as NumericConstraint | null;
        if (numConstraint) {
          if (numConstraint.min !== undefined && value < numConstraint.min) return false;
          if (numConstraint.max !== undefined && value > numConstraint.max) return false;
        }
        return true;

      case 'Boolean':
        return typeof value === 'boolean';

      case 'Enum':
        const enumConstraint = this.constraint as EnumConstraint | null;
        if (!enumConstraint || !enumConstraint.allowedValues) return false;
        return typeof value === 'string' && enumConstraint.allowedValues.includes(value);

      case 'Text':
        return typeof value === 'string';

      default:
        return false;
    }
  }
}
