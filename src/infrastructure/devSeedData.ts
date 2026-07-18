import * as Crypto from 'expo-crypto';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';
import {Record} from '../domain/Record';

/**
 * Dev/QA-only fixture data for exercising Factor's observation, record, and
 * chart features (dense trend charts, gapped trend charts, every time range
 * preset, "not enough data yet", "no records yet", stale vs. recent "last
 * record" states) without manual data entry.
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
 * constant below (same metric values, same relative offsets from "now") —
 * not frozen absolute timestamps, since the whole point is for records to
 * land within whichever chart window is selected whenever you reseed.
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

/**
 * Sub-day granularity, for metrics that need several points inside one day. The
 * shortest chart window buckets by the hour, so a once-a-day metric can never
 * fill it. Anchored to the current hour rather than a fixed one so these always
 * land inside the last 24 hours whenever the seed is run.
 */
function hoursAgo(n: number): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() - n);
  return d;
}

/** record timestamp -> metricId -> value. Lets several metrics on the same observation share a record wherever their points coincide. */
type TimestampValues = Map<number, Map<string, any>>;

function setValueAt(timestampValues: TimestampValues, at: Date, metricId: string, value: any): void {
  const timestamp = at.getTime();
  if (!timestampValues.has(timestamp)) {
    timestampValues.set(timestamp, new Map());
  }
  timestampValues.get(timestamp)!.set(metricId, value);
}

function buildRecords(observation: Observation, timestampValues: TimestampValues): Record[] {
  return Array.from(timestampValues.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([timestamp, values]) =>
      observation.createRecord(Crypto.randomUUID(), new Date(timestamp), values)
    );
}

function bounded(value: number, min = 0, max = 100): number {
  return Number(Math.max(min, Math.min(max, value)).toFixed(1));
}

export interface SeedEntry {
  observation: Observation;
  records: Record[];
}

export function buildSeedData(): SeedEntry[] {
  const entries: SeedEntry[] = [];

  // "mixed metrics" — one observation carrying every chart/metric scenario that isn't
  // observation-level (see testing-data.md): trends at each time range's resolution, a
  // gappy trend, a trend with too few points, and non-numeric metrics (which never
  // chart) sharing records with the numeric ones to prove multi-type records render
  // correctly.
  {
    const denseMetric = new Metric(Crypto.randomUUID(), 'dense', 'Numeric', {min: 0, max: 100});
    const sparseMetric = new Metric(Crypto.randomUUID(), 'sparse', 'Numeric', {min: 0});
    const hourlyMetric = new Metric(Crypto.randomUUID(), 'hourly', 'Numeric', {min: 0, max: 100});
    const yearlyMetric = new Metric(Crypto.randomUUID(), 'yearly', 'Numeric', {min: 0});
    const insufficientMetric = new Metric(Crypto.randomUUID(), 'insufficient', 'Numeric', {min: 0, max: 100});
    const flagMetric = new Metric(Crypto.randomUUID(), 'flag', 'Boolean');
    const categoryMetric = new Metric(Crypto.randomUUID(), 'category', 'Enum', {allowedValues: ['a', 'b', 'c']});
    const noteMetric = new Metric(Crypto.randomUUID(), 'note', 'Text');
    const observation = new Observation(Crypto.randomUUID(), 'mixed metrics', [
      denseMetric,
      sparseMetric,
      hourlyMetric,
      yearlyMetric,
      insufficientMetric,
      flagMetric,
      categoryMetric,
      noteMetric,
    ], 'Covers every per-metric chart scenario in one place: daily, hourly and year-long trends, a sparse trend with gaps, a metric with too few points to chart, and non-numeric metrics that share records instead of charting.');

    const recordValues: TimestampValues = new Map();

    // dense: one point per day for 45 days => a rich, populated trend chart.
    for (let i = 44; i >= 0; i--) {
      setValueAt(recordValues, daysAgo(i), denseMetric.id, bounded(50 + Math.sin(i / 6) * 15 + randRange(-8, 8)));
    }

    // sparse: one point every 3 days over 60 days => a trend chart with visible gaps.
    let sparseValue = 40;
    for (let i = 60; i >= 0; i -= 3) {
      sparseValue += randRange(-1.5, 0.7);
      setValueAt(recordValues, daysAgo(i), sparseMetric.id, bounded(sparseValue, 0, Infinity));
    }

    // hourly: several points inside the last day, then one per day for a fortnight =>
    // the only metric dense enough to fill the hour-bucketed shortest window, and still
    // populated at the day-bucketed ones.
    for (let h = 21; h >= 3; h -= 3) {
      setValueAt(recordValues, hoursAgo(h), hourlyMetric.id, bounded(60 + Math.sin(h / 4) * 20 + randRange(-5, 5)));
    }
    for (let i = 1; i <= 12; i++) {
      setValueAt(recordValues, daysAgo(i), hourlyMetric.id, bounded(60 + Math.cos(i / 3) * 18 + randRange(-5, 5)));
    }

    // yearly: a point every two weeks for most of a year => the longest window's 30-day
    // buckets have ~12 points to draw instead of one clump against its right edge.
    let yearlyValue = 120;
    for (let i = 350; i >= 0; i -= 14) {
      yearlyValue += randRange(-9, 10);
      setValueAt(recordValues, daysAgo(i), yearlyMetric.id, bounded(yearlyValue, 0, Infinity));
    }

    // insufficient: exactly one point => "not enough data yet" despite a recent last record.
    setValueAt(recordValues, daysAgo(5), insufficientMetric.id, bounded(randRange(10, 90)));

    // flag/category/note: every other day over 20 days, sharing a record => non-numeric
    // metrics never chart, and one record can carry several value types at once.
    const categories = ['a', 'b', 'c'];
    for (let i = 18; i >= 0; i -= 2) {
      setValueAt(recordValues, daysAgo(i), flagMetric.id, rand() > 0.5);
      setValueAt(recordValues, daysAgo(i), categoryMetric.id, categories[Math.floor(rand() * categories.length)]);
      setValueAt(recordValues, daysAgo(i), noteMetric.id, `note ${i}`);
    }

    entries.push({observation, records: buildRecords(observation, recordValues)});
  }

  // "no numeric" — non-numeric metrics only => the details screen renders neither the
  // TRENDS section nor the time range selector that sits inside it, since there is
  // nothing chartable to scope.
  {
    const moodMetric = new Metric(Crypto.randomUUID(), 'mood', 'Enum', {allowedValues: ['low', 'ok', 'high']});
    const doneMetric = new Metric(Crypto.randomUUID(), 'done', 'Boolean');
    const observation = new Observation(
      Crypto.randomUUID(),
      'no numeric',
      [moodMetric, doneMetric],
      'Has no Numeric metrics at all, so its details screen shows neither the TRENDS section nor the time range selector inside it — only RECENT RECORDS.'
    );

    const recordValues: TimestampValues = new Map();
    const moods = ['low', 'ok', 'high'];
    for (let i = 8; i >= 0; i -= 2) {
      setValueAt(recordValues, daysAgo(i), moodMetric.id, moods[Math.floor(rand() * moods.length)]);
      setValueAt(recordValues, daysAgo(i), doneMetric.id, rand() > 0.5);
    }

    entries.push({observation, records: buildRecords(observation, recordValues)});
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
        new Map([[valueMetric.id, bounded(randRange(10, 90))]])
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
