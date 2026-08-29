export interface MetricRemovalPrompt {
  title: string;
  message: string;
}

/**
 * Each name is wrapped in typographic double quotes: Metric names are
 * user-typed and routinely several lowercase words, so `hours slept will be
 * removed` reads as a sentence before it reads as a name.
 */
export function metricRemovalPrompt(
  names: readonly string[],
  valueCount: number
): MetricRemovalPrompt {
  const several = names.length > 1;
  const quoted = names.map(name => `“${name}”`);
  const subject = several
    ? `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`
    : quoted[0];

  const values = valueCount === 1 ? '1 recorded value' : `${valueCount} recorded values`;
  const message = valueCount === 0
    ? `${subject} will be removed. No record holds a value for ${several ? 'them' : 'it'}. `
      + 'This cannot be undone.'
    : `${subject} will be removed, along with ${values}. This cannot be undone.`;

  return {title: several ? 'Delete metrics?' : 'Delete metric?', message};
}
