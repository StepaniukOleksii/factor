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

  constructor(
    id: string,
    name: string,
    type: MetricValueType,
    constraint: MetricConstraint = null
  ) {
    super(id);
    this.name = name;
    this.type = type;
    this.constraint = constraint;
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
