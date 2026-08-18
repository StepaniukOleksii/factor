import * as Crypto from 'expo-crypto';
import {Observation} from '../domain/Observation';
import {Metric} from '../domain/Metric';
import {Record} from '../domain/Record';

/**
 * Dev/QA-only fixture data, reached only through `devSeed.ts` and its dev-menu
 * command (see App.tsx) - never from a production code path.
 *
 * testing-data.md at the repo root is the reference for what each Observation
 * covers and how to verify it. Names here are short and all-lowercase so seeded
 * data is instantly distinguishable from anything entered by hand.
 *
 * Each Observation states when it was created, earlier than its own oldest
 * Record. All four are built in one pass, so defaulted times would share a
 * millisecond and leave the list's newest-first order to break the tie.
 */

/**
 * Fixes the *shape* of the data - same values, same offsets from "now" - but not
 * absolute timestamps, since Records have to land inside whichever chart window
 * is selected whenever you reseed. Change it for a different but still
 * reproducible dataset.
 */
const SEED = 42;

/**
 * Which of `hourly`'s daily days carries its extra sub-day cluster. Any day but
 * today would do - today's own Records are hour-spaced already, and a cluster
 * there would change what the shortest window shows.
 */
const CLUSTER_DAY = 3;

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

function daysAgo(n: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
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

/** record timestamp -> note. */
type TimestampNotes = Map<number, string>;

function setValueAt(timestampValues: TimestampValues, at: Date, metricId: string, value: any): void {
  const timestamp = at.getTime();
  if (!timestampValues.has(timestamp)) {
    timestampValues.set(timestamp, new Map());
  }
  timestampValues.get(timestamp)!.set(metricId, value);
}

function buildRecords(
  observation: Observation,
  timestampValues: TimestampValues,
  notes: TimestampNotes = new Map()
): Record[] {
  return Array.from(timestampValues.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([timestamp, values]) =>
      observation.createRecord(Crypto.randomUUID(), new Date(timestamp), values, notes.get(timestamp) ?? null)
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

  // "mixed metrics" - one observation carrying every chart/metric scenario that isn't
  // observation-level (see testing-data.md): trends at each time range's resolution, a
  // gappy trend, a trend with too few points to draw a line, Enum and Boolean metrics
  // charting as swimlanes among them, and a Text metric that never charts sharing records
  // with the rest to prove multi-type records render correctly.
  {
    // Four of the eight carry a description and four deliberately don't, so one
    // Record form shows every state of the info button at once. The four bound
    // shapes are spread the same way: a closed range on `dense` and `hourly`, a
    // floor on `yearly`, a ceiling on `insufficient`, and none on `sparse`.
    const denseMetric = new Metric(Crypto.randomUUID(), 'dense', 'Numeric', {min: 0, max: 100},
      'One point per day for 45 days — the densely-populated trend chart.');
    const sparseMetric = new Metric(Crypto.randomUUID(), 'sparse', 'Numeric');
    // Several lines, so the dialog has line breaks to preserve.
    const hourlyMetric = new Metric(Crypto.randomUUID(), 'hourly', 'Numeric', {min: 0, max: 100},
      'Every 3 hours over the last 21, then one point per day for 12 days.\n' +
      'At 1D the only metric dense enough to fill the hour-bucketed window.\n' +
      'At 1W and 1M still populated, at day resolution.\n' +
      'The day 3 back also carries a 09:30 and a 15:00 — the only hour anywhere holding two records.');
    // Near METRIC_DESCRIPTION_MAX_LENGTH, so the dialog's longest body is on the form.
    const yearlyMetric = new Metric(Crypto.randomUUID(), 'yearly', 'Numeric', {min: 0},
      "One point every 14 days across 350 days, so the 1Y window's 30-day buckets have about a dozen " +
      'points to draw instead of one clump against the right-hand edge. The same records read as a ' +
      'nearly-empty chart at 1M, where only three of them fall inside the window — the same metric, two ' +
      'very different charts, without a single record having moved. This text runs close to the ' +
      '500-character limit deliberately, so the longest body the dialog can show is on the form every ' +
      'time the fixtures are reseeded.');
    const insufficientMetric = new Metric(Crypto.randomUUID(), 'insufficient', 'Numeric', {max: 100});
    // The only described non-Numeric Metric, covering the SegmentedField path.
    const flagMetric = new Metric(Crypto.randomUUID(), 'flag', 'Boolean', null,
      'Boolean, so it charts as two lanes — and the segmented control this button sits in.');
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
    ], 'Covers every per-metric chart scenario in one place: daily, hourly and year-long trends, a sparse trend with gaps, a metric with too few points to chart, and non-numeric metrics that share records instead of charting.',
      daysAgo(365));

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
    // One of those days carries a cluster of its own: a second Record half an hour
    // after that day's, sharing its clock hour, and a third in the afternoon. A
    // chart zoomed down to this day is bucketed by the hour, so the first two stay
    // folded into one aggregated point while the third gives the chart a second
    // point to draw - the one shape zoom cannot resolve any further, since an hour
    // is as fine as a day-wide window is ever bucketed. Both extra Records share
    // the day of an existing one, so every window's point count is what it was.
    setValueAt(recordValues, daysAgo(CLUSTER_DAY, 9, 30), hourlyMetric.id, bounded(60 + randRange(-5, 5)));
    setValueAt(recordValues, daysAgo(CLUSTER_DAY, 15), hourlyMetric.id, bounded(70 + randRange(-5, 5)));

    // yearly: a point every two weeks for most of a year => the longest window's 30-day
    // buckets have ~12 points to draw instead of one clump against its right edge.
    let yearlyValue = 120;
    for (let i = 350; i >= 0; i -= 14) {
      yearlyValue += randRange(-9, 10);
      setValueAt(recordValues, daysAgo(i), yearlyMetric.id, bounded(yearlyValue, 0, Infinity));
    }

    // insufficient: exactly one point => "not enough data yet" at the shortest window,
    // which this point falls outside of, and a lone dot at every wider one.
    setValueAt(recordValues, daysAgo(5), insufficientMetric.id, bounded(randRange(10, 90)));

    // flag/category/note: every other day over 20 days, sharing a record => `flag` and
    // `category` each draw a swimlane after the numeric cards while `note` still draws
    // nothing, and one record can carry several value types at once.
    const categories = ['a', 'b', 'c'];
    for (let i = 18; i >= 0; i -= 2) {
      setValueAt(recordValues, daysAgo(i), flagMetric.id, rand() > 0.5);
      setValueAt(recordValues, daysAgo(i), categoryMetric.id, categories[Math.floor(rand() * categories.length)]);
      setValueAt(recordValues, daysAgo(i), noteMetric.id, `note ${i}`);
    }

    // RECENT RECORDS shows the three most recent records, and which those are
    // shifts with the hour the seed runs: hoursAgo(3) moves with the clock while
    // daysAgo(0) is pinned at 09:00, so noting both puts one noted and one
    // un-noted record on that list at any time of day. The daysAgo(0) one also
    // carries the `note` metric's own value, so both appear on one expanded card.
    const recordNotes: TimestampNotes = new Map([
      [hoursAgo(3).getTime(), 'The most recent sub-day record: a short note on one line.'],
      [daysAgo(0).getTime(),
        "Today's shared record: dense, flag, category and note all write to it.\n" +
        'Its note carries a line break and runs close to the limit.'],
    ]);

    entries.push({observation, records: buildRecords(observation, recordValues, recordNotes)});
  }

  // "no numeric" - no Numeric metric at all, so its TRENDS section is two swimlane cards:
  // the Enum `mood` and the Boolean `done` below it.
  {
    const moodMetric = new Metric(Crypto.randomUUID(), 'mood', 'Enum', {allowedValues: ['low', 'ok', 'high']});
    const doneMetric = new Metric(Crypto.randomUUID(), 'done', 'Boolean');
    const observation = new Observation(
      Crypto.randomUUID(),
      'no numeric',
      [moodMetric, doneMetric],
      'Has no Numeric metric at all, so its charts come entirely from an Enum one and the Boolean beside it — a swimlane each.',
      daysAgo(30)
    );

    const recordValues: TimestampValues = new Map();
    const moods = ['low', 'ok', 'high'];
    for (let i = 8; i >= 0; i -= 2) {
      setValueAt(recordValues, daysAgo(i), moodMetric.id, moods[Math.floor(rand() * moods.length)]);
      setValueAt(recordValues, daysAgo(i), doneMetric.id, rand() > 0.5);
    }

    entries.push({observation, records: buildRecords(observation, recordValues)});
  }

  // "stale records" - records only 40-60 days ago => "not enough data yet" (0 points in
  // the 30-day window) alongside a stale "last record" date at the list/details level.
  {
    const valueMetric = new Metric(Crypto.randomUUID(), 'value', 'Numeric', {min: 0});
    const observation = new Observation(
      Crypto.randomUUID(),
      'stale records',
      [valueMetric],
      'All four records are 40-60 days old — outside the 30-day trend window, so the chart reads empty while the last record date is stale, not missing.',
      daysAgo(90)
    );

    // These four also make the zoom ladder: one 30-day bucket at 1Y, three days
    // inside the window that opens, and one of those days holding a second Record
    // in the same clock hour (see testing-data.md). The values are fixed rather
    // than drawn from `rand` because a tap only reaches the middle day while its
    // value sits between the other two.
    const recordValues: TimestampValues = new Map();
    setValueAt(recordValues, daysAgo(58), valueMetric.id, 20);
    setValueAt(recordValues, daysAgo(50), valueMetric.id, 52);
    setValueAt(recordValues, daysAgo(50, 9, 30), valueMetric.id, 58);
    setValueAt(recordValues, daysAgo(42), valueMetric.id, 85);

    entries.push({observation, records: buildRecords(observation, recordValues)});
  }

  // "no records" - no records at all => "No records yet" in both the list and details screens.
  {
    const valueMetric = new Metric(Crypto.randomUUID(), 'value', 'Numeric', {min: 0});
    const observation = new Observation(Crypto.randomUUID(), 'no records', [valueMetric], null, daysAgo(0));
    entries.push({observation, records: []});
  }

  return entries;
}
