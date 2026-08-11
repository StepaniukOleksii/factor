// The one definition of name identity, for every rule in the app that compares
// one name to another (ADR-4).

export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Every position in `names` holding a name an earlier position already holds -
 * positions, so a caller can mark the field at fault, and never the first of a
 * group, which is the one being kept. A blank is skipped, having the empty-name
 * rule to answer to instead.
 */
export function collidingNamePositions(names: readonly string[]): number[] {
  const seen = new Set<string>();
  const collisions: number[] = [];

  names.forEach((name, position) => {
    const key = nameKey(name);
    if (key === '') {
      return;
    }
    if (seen.has(key)) {
      collisions.push(position);
    } else {
      seen.add(key);
    }
  });

  return collisions;
}
