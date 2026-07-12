import * as Crypto from 'expo-crypto';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';
import {Record} from '../domain/Record';

/**
 * Dev/QA-only fixture data for exercising Factor's observation, record, and
 * chart features (dense trend charts, gapped trend charts, "not enough data
 * yet", "no records yet", stale vs. recent "last record" states) without
 * manual data entry.
 *
 * Never imported by production code paths — only pulled in by `devSeed.ts`,
 * which is wired to a dev-menu-only command (see App.tsx). See
 * testing-data.md at the repo root for what observations exist and why, and
 * a manual verification checklist per observation.
 *
 * Observation and metric names are short, all-lowercase summaries of the
 * scenario they cover (not realistic tracker names) so seeded data is
 * instantly distinguishable from anything entered by hand.
 *
 * "Deterministic" here means the *shape* of the data is fixed by the SEED
 * constant below (same metric values, same relative day-offsets from
 * "now") — not frozen absolute timestamps, since the whole point is for
 * records to land within the last-30-days chart window whenever you reseed.
 * Change SEED to get a different-but-still-reproducible dataset.
 */
const SEED = 42;

function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

function randRange(min: number, max: number): number {
  return min + rand() * (max - min);
}

function daysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/** dayOffset ("N days ago") -> metricId -> value. Lets several metrics on the same observation share a record on days they coincide. */
type DayValues = Map<number, Map<string, any>>;

function setDayValue(dayValues: DayValues, dayOffset: number, metricId: string, value: any): void {
  if (!dayValues.has(dayOffset)) {
    dayValues.set(dayOffset, new Map());
  }
  dayValues.get(dayOffset)!.set(metricId, value);
}

function buildRecords(observation: Observation, dayValues: DayValues): Record[] {
  return Array.from(dayValues.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([dayOffset, values]) => observation.createRecord(Crypto.randomUUID(), daysAgo(dayOffset), values));
}

export interface SeedEntry {
  observation: Observation;
  records: Record[];
}

export function buildSeedData(): SeedEntry[] {
  const entries: SeedEntry[] = [];

  // "mixed metrics" — one observation carrying every chart/metric scenario that isn't
  // observation-level (see testing-data.md): a rich daily trend, a gappy trend, a
  // trend with too few points, and non-numeric metrics (which never chart) sharing
  // records with the numeric ones to prove multi-type records render correctly.
  {
    const denseMetric = new Metric(Crypto.randomUUID(), 'dense', 'Numeric', {min: 0, max: 100});
    const sparseMetric = new Metric(Crypto.randomUUID(), 'sparse', 'Numeric', {min: 0});
    const insufficientMetric = new Metric(Crypto.randomUUID(), 'insufficient', 'Numeric', {min: 0, max: 100});
    const flagMetric = new Metric(Crypto.randomUUID(), 'flag', 'Boolean');
    const categoryMetric = new Metric(Crypto.randomUUID(), 'category', 'Enum', {allowedValues: ['a', 'b', 'c']});
    const noteMetric = new Metric(Crypto.randomUUID(), 'note', 'Text');
    const observation = new Observation(Crypto.randomUUID(), 'mixed metrics', [
      denseMetric,
      sparseMetric,
      insufficientMetric,
      flagMetric,
      categoryMetric,
      noteMetric,
    ], 'Covers every per-metric chart scenario in one place: a dense daily trend, a sparse trend with gaps, a metric with too few points to chart, and non-numeric metrics that share records with the numeric ones instead of charting.');

    const dayValues: DayValues = new Map();

    // dense: one point per day for 45 days => a rich, populated trend chart.
    for (let i = 44; i >= 0; i--) {
      const raw = 50 + Math.sin(i / 6) * 15 + randRange(-8, 8);
      setDayValue(dayValues, i, denseMetric.id, Number(Math.max(0, Math.min(100, raw)).toFixed(1)));
    }

    // sparse: one point every 3 days over 60 days => a trend chart with visible gaps.
    let sparseValue = 40;
    for (let i = 60; i >= 0; i -= 3) {
      sparseValue += randRange(-1.5, 0.7);
      setDayValue(dayValues, i, sparseMetric.id, Number(Math.max(0, sparseValue).toFixed(1)));
    }

    // insufficient: exactly one point => "not enough data yet" despite a recent last record.
    setDayValue(dayValues, 5, insufficientMetric.id, Number(randRange(10, 90).toFixed(1)));

    // flag/category/note: every other day over 20 days, sharing a record => non-numeric
    // metrics never chart, and one record can carry several value types at once.
    const categories = ['a', 'b', 'c'];
    for (let i = 18; i >= 0; i -= 2) {
      setDayValue(dayValues, i, flagMetric.id, rand() > 0.5);
      setDayValue(dayValues, i, categoryMetric.id, categories[Math.floor(rand() * categories.length)]);
      setDayValue(dayValues, i, noteMetric.id, `note ${i}`);
    }

    entries.push({observation, records: buildRecords(observation, dayValues)});
  }

  // "stale records" — records only 40-60 days ago => "not enough data yet" (0 points in
  // the 30-day window) alongside a stale "last record" date at the list/details level.
  {
    const valueMetric = new Metric(Crypto.randomUUID(), 'value', 'Numeric', {min: 0});
    const observation = new Observation(
      Crypto.randomUUID(),
      'stale records',
      [valueMetric],
      'All three records are 40-60 days old, outside the 30-day trend window — the chart shows "not enough data yet" even though the last record date is stale rather than missing.'
    );
    const records: Record[] = [42, 51, 58].map(i =>
      observation.createRecord(
        Crypto.randomUUID(),
        daysAgo(i),
        new Map([[valueMetric.id, Number(randRange(10, 90).toFixed(1))]])
      )
    );
    entries.push({observation, records});
  }

  // "no records" — no records at all => "No records yet" in both the list and details screens.
  {
    const valueMetric = new Metric(Crypto.randomUUID(), 'value', 'Numeric', {min: 0});
    const observation = new Observation(Crypto.randomUUID(), 'no records', [valueMetric]);
    entries.push({observation, records: []});
  }

  return entries;
}
