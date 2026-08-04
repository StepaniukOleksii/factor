# Record Note

* 2026-08-03

## 1. Goal

A Record holds values for the Metrics its Observation defines and nothing else, so the circumstance that
explains a reading — the hotel bed behind a bad night's sleep, the illness behind a fortnight's dip — has
nowhere to go. A Text Metric approximates one badly: a Metric is a standing property of every Record on the
Observation, defined once at creation and asking to be answered every time, where an aside about one
particular occasion is neither. Give each Record an optional free-text note, written on the Record form.

## 2. Requirements

* A `Record` carries an optional note of up to 150 characters, enforced both in the input and by the use
  cases. Line breaks the user types are preserved and displayed.
* The note is entered at the bottom of the Record form, below every Metric field, on both routes — creating a
  Record and editing one. Editing pre-populates it, and clearing it removes it.
* The note is set apart from the Metric fields so neither can be mistaken for the other, including on an
  Observation that defines a Metric named `note`.
* The note is not a Metric: it is not offered on the Create Observation screen, appears in no Metric list, and
  produces no series or chart point.
* A Record carrying a note and no Metric values is valid, per
  [ADR-3](../../../adr/3-record-metric-value-requirements.md).
* On the Observation Details screen, an expanded Record shows its note below its Metric values, and a
  collapsed one carries a marker when it has a note and nothing where it does not; rows keep the same height
  either way.
* Leaving the Record form with an edited note raises the unsaved-changes confirmation; leaving one whose empty
  note was never touched does not.
* A screen reader announces both that a Record has a note and the note itself.
* The note is not shown on the Observation List.
* Searching, filtering or charting by note is out of scope — this feature records and displays a note,
  nothing more.

## 3. Technical Design

### 3.1 Domain

`Record` (`src/domain/Record.ts`) gains `note: string | null`, declared after `values` in the constructor and
defaulting to `null` so existing call sites keep working. A plain mutable field like `timestamp`, and no part
of `Observation.validateValues` — that method enforces a Metric's contract, and has nothing to say about prose
attached to the Record itself.

`Observation.createRecord` gains the same trailing parameter and passes it through, keeping the documented
entry point the one way a fully-formed Record is produced. The dev seed builder reaches Records through it
too, so seeded Records can carry notes without going around it.

`Record.normalizeNote(value: string | null | undefined): string | null` — static. Trims, maps empty and
whitespace-only to `null`, and throws `Error('Record note cannot exceed 150 characters')` beyond the limit,
matching the manual-`throw` style `CreateObservationUseCase` already uses for the Observation description.
`trim()` leaves interior newlines intact, so preserving them needs no special handling, and the length check
counts newline characters as the input's own `maxLength` does. Static rather than enforced in the constructor:
the repository rebuilds stored Records through that constructor and must return what is stored rather than
reject or rewrite it. Both write paths call the normalizer, so the rule is stated once instead of once per use
case.

`validationLimits.ts` gains `RECORD_NOTE_MAX_LENGTH = 150`. Its own constant even though it equals
`OBSERVATION_DESCRIPTION_MAX_LENGTH` today — the two fields are unrelated, and sharing one would silently move
the other whenever either is retuned.

### 3.2 Application

`CreateRecordCommand` gains `note?: string`; `CreateRecordUseCase` normalizes it and passes the result into
`observation.createRecord`.

`UpdateRecordCommand` gains `note?: string | null`; `UpdateRecordUseCase` assigns the normalized value to
`record.note`. Replacing rather than merging, so a note cleared in the form is removed — the rule
`updateValues` already follows for values under ADR-3.

`RecordRepository` gains no methods: `save`, `update` and every read already move whole entities.
`GetMetricSeriesUseCase` is untouched — a note belongs to no Metric and yields no point.

### 3.3 Storage

Add a nullable `note TEXT` column to the `records` table in `Database.ts` — on the Record's own row, not in
`record_values`, which is keyed by `(recordId, metricId)` with a foreign key into `metrics`. A note has no
Metric to point at, and inventing a synthetic one to hold it would rebuild the phantom-Metric problem this
feature exists to avoid, one layer down.

Carry the column through `SQLiteRecordRepository`: the `INSERT` in `save()`, the `UPDATE` in `update()`
alongside `timestamp` (its value delete-and-reinsert is unaffected), and the three methods that reconstruct a
`Record` — `getRecentRecords`, `getByObservationId` and `getById` — each extending its row type and `SELECT`
and passing the value to the constructor. `getLastRecordTimestamps` aggregates timestamps only and is
unchanged. SQLite stores the text verbatim, so newlines round-trip without escaping.

No migration runner is added, and a database created before this change must be wiped rather than upgraded —
the same decision, for the same reasons and with the same reseeding caveat, as
[Observation Description](../../1-observation-management/1-5-observation-description/spec.md) §3.3.

### 3.4 Presentation

**`RecordFormScreen`** — below `metricsList` and inside the same `ScrollView`, a note section: a hairline
`COLORS.outlineVariant` rule with generous space above it, then a `LabeledTextField` labeled "NOTE",
`multiline`, ~3 lines tall, `maxLength={RECORD_NOTE_MAX_LENGTH}`, `showCounter`, and a placeholder naming what
it is — along the lines of "Optional — about this record, not a metric".

The distinction this feature turns on is carried by layout rather than by explanation: every Metric field sits
in a bordered `inputContainer` card, and the note field deliberately does not. A Metric named `note` is one
card among the others; the Record's note is the single field standing outside them all, last, under a rule.
No info button — that is exactly the affordance a *described* Metric carries
([Metric Description](../2-7-metric-description/spec.md) §3.4), so putting one here would make the note look
more like a Metric rather than less.

The screen holds the note in its own `useState('')`, initialized from the loaded Record's `note ?? ''` in edit
mode, and passes it through `handleSave` to whichever use case runs.

`isDirty` gains a note comparison, normalized on both sides: the form holds `''` for an empty field where a
Record holds `null`, so a bare `!==` would call an untouched Record dirty the moment the form loaded and
offer to discard changes nobody made.

**`ObservationDetailsScreen`** — an expanded Record's note renders below the Metric-value strip and its
scrollbar row: full width, wrapping, muted `onSurfaceVariant` body text at the size the Observation
description above it uses, preceded by a small `MaterialIcons` note glyph. Deliberately uncaptioned and
outside the horizontal scroller — the Metric values are fixed-width labeled chips in a strip, so a wrapping
paragraph beneath them already reads as a different kind of thing, and captioning it "NOTE" would put that
word on screen twice for an Observation whose Metric is called `note`.

The collapsed row carries the same glyph after its timestamp, inside `recordHeaderLeft`, with an
`accessibilityLabel` stating the Record has a note. A Record without one renders nothing there, and row height
comes from the timestamp either way. One glyph in both places, so the marker and what it reveals read as the
same thing.

**Unchanged:** `ObservationListScreen`, `CreateObservationScreen`, and every trend card — a note is neither a
Metric to define nor a series to plot, and the list stays tuned for scanning many Observations at a glance.

## 4. Verification

### Seed Data

`devSeedData.ts`: two of `mixed metrics`' Records carry a note — the most recent `hourly` sub-day Record
(`hoursAgo(3)`) and today's shared Record at `daysAgo(0)`, the one `dense`, `flag`, `category` and `note` all
write to.

Those two because RECENT RECORDS shows the three most recent Records, and which Records those are shifts with
the hour the seed is run: `hoursAgo(3)` moves with the clock while `daysAgo(0)` is pinned at 09:00, so noting
both guarantees at least one Record with a note and one without on that list at any time of day. The
`daysAgo(0)` one doubles as the collision fixture — its expanded card shows the `note` Metric's own labeled
chip and the Record's note together.

Give `hoursAgo(3)` a short single-line note and `daysAgo(0)` one close to the 150-character limit containing a
line break, so wrapping and newline preservation are both on screen. Wording follows the convention
`testing-data.md` sets: each says what its Record covers, rather than imitating a realistic journal entry.

Notes reach `buildRecords` beside the values — a timestamp-keyed note map alongside `TimestampValues`, passed
into `observation.createRecord`'s new parameter. This data never passes through a use case, so nothing
enforces the limit on it; a fixture test guards that instead (below).

**`testing-data.md`** needs updating alongside: record which two Records carry a note and what each covers,
and add the note states to the `mixed metrics` manual verification checklist.

### Manual Verification

Run **Reseed test data** first (see [testing-data.md](../../../../testing-data.md)).

1. Open `mixed metrics`. Under RECENT RECORDS at least one row shows a note glyph beside its time and at least
   one shows none, with no gap in its place and no difference in row height.
2. Expand the noted row that also holds a value for the `note` Metric: that Metric's `NOTE` chip sits in the
   horizontal strip carrying its own value, while the Record's note reads as a wrapping paragraph below the
   strip. Nothing about the two invites confusion.
3. That note runs close to 150 characters and contains a line break: it wraps in full, is not truncated, and
   its line break shows as a line break.
4. Expand an un-noted row: no paragraph, and nothing left where one would be.
5. Tap **Add Record**. Every Metric renders in its card as before, the Text Metric `note` among them; the NOTE
   field is last, below a rule and outside any card, showing its placeholder.
6. Type past 150 characters — the input stops and the counter reads "150/150".
7. Enter a note, leave every Metric empty, and save (ADR-3 permits it). The new Record appears at the top of
   RECENT RECORDS carrying the glyph; expanded, it shows `-` for every Metric and the note below them.
8. Long-press it and choose **Edit Record**: the note is pre-populated. Clear it and save — glyph and
   paragraph are both gone.
9. Edit it again, type into the note and nothing else, and press back: **Discard changes?** appears. Keep
   editing — the typed note is still there.
10. Open a Record with no note in edit mode and press back immediately: no dialog.
11. Reload the app: every note set above survives, and Records without one still have none.
12. With TalkBack: a noted row announces that it has a note, the note is read when the card is expanded, and
    the form field announces as "Note".
13. If a database predating this change exists on the device, clear the app's storage so it is recreated
    fresh — there is no in-place upgrade.

### Automated Tests

* **Unit:** `Record` defaults `note` to `null`, and `Observation.createRecord` passes one through.
  `normalizeNote` trims, maps empty and whitespace-only to `null`, keeps interior newlines, accepts 150
  characters and rejects 151 with the expected message. `CreateRecordUseCase` stores a note, defaults to
  `null` when omitted, and rejects an over-long one; `UpdateRecordUseCase` replaces a note, clears it given an
  empty string and given `null`, and leaves its existing value and timestamp behaviour untouched.
* **Integration:** `SQLiteRecordRepository` round-trips `note` — including `null` and one containing
  newlines — through `save`/`getById`, `getRecentRecords` and `getByObservationId`, and `update` both
  overwrites a stored note and clears one.
* **Fixtures:** `devSeedData` — exactly the two intended Records of `mixed metrics` carry a note and every
  other seeded Record is `null`, the longer one contains a newline, and no seeded note exceeds
  `RECORD_NOTE_MAX_LENGTH`, which nothing else would catch since the seed never runs a use case. Keeps
  `testing-data.md`'s claims true, as the existing point-count assertions do.
* **Screen:** `RecordFormScreen` — the note field renders after every Metric field, pre-populates on the edit
  route, is submitted to the create and the update use case, marks the form dirty when changed, and leaves an
  untouched empty note clean. `ObservationDetailsScreen` — the glyph appears on a noted Record's row and not
  on an un-noted one, and the note paragraph appears only when that Record is expanded.
* **E2E:** `.maestro/2-9-record-note.yaml`, on the `seed` fixture — adding a Record to `mixed metrics` with a
  note and reading it back on its expanded row.
