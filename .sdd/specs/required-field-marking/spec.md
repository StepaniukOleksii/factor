# Required Field Marking

* 2026-09-05
* Feature: observation-creation.md
* [x] Implemented
* [x] E2E tested

## 1. Goal

The Observation form says nothing about which of its fields it will insist on until a save is refused, so the rules
reach the user as a refusal rather than as something readable beforehand. What requiredness can be inferred is inferred
backwards — from a placeholder *not* reading `Optional — …` — which leaves MIN, MAX and UNIT, all optional and carrying
no placeholder at all, reading exactly like the fields that are required. Mark every field a save requires with an
asterisk on its caption.

## 2. Requirements

* A caption carries `*` where what sits under it can be empty at a save and the save would refuse it for being empty.
  Every other caption is unmarked, whether what it captions may be left empty or could never have been empty at all. The
  rule holds across every form in the app, so an unmarked caption is one the user need do nothing about.
* On the Observation form, creating and editing alike, the marked captions are OBSERVATION NAME, each Metric card's
  METRIC NAME, and a Choice Metric's VALUES — the three a save is refused over. The descriptions, MIN, MAX and UNIT are
  unmarked because a save accepts them empty. TYPE and METRICS are unmarked for the other reason: neither can be empty
  to begin with, the picker always holding a type and the bin being offered only while the form carries more than one
  Metric card, so the last card cannot be taken off.
* A Choice Metric's value rows sit under a `VALUES` caption, and that caption carries the mark while the rows keep none
  of their own. What is required is two non-blank values across the set, which no single row is answerable for.
* A Metric already stored states its values rather than offering fields for them ([Observation
  Editing](../../features/observation-editing.md)), and the caption over a stated fact carries no mark.
* Neither the Record form nor the custom time range modal gains a mark.
* The mark reads in its caption's own colour rather than the error colour, and appears from the moment the form opens —
  it says what the form asks for, not that anything is yet wrong with it.
* What is validated, when it is validated, and what each refusal says are all exactly as they are today.

## 3. Technical Design

Presentation only. Requiredness is already settled by `validateCreateObservation`, and this slice does nothing but state
on screen what that function is going to refuse — so nothing about the domain, the application layer or storage is in
scope, and no rule is written down a second time.

### 3.1 The mark

A new `FieldCaption` component (`src/presentation/components`, exported from its `index.ts`) owns the caption and its
mark: props `label: string` and `required?: boolean`, rendering the label in `TYPOGRAPHY.fieldLabel` followed by ` *`
where required. It carries no spacing of its own — each call site keeps the margins it has, which differ — so what is
shared is the mark and its announcement rather than the layout around them.

The asterisk takes `TYPOGRAPHY.fieldLabel`'s own colour and not `COLORS.error`. A form that opens carrying red faults
the user for what they have not done yet, which is the reason [Observation
Creation](../../features/observation-creation.md) already gives for leaving the form unmarked until the first save
attempt; a required mark is a statement about the field, and an error colour would make it a statement about its
contents. Red stays what it is on this form: the border and the message a refusal puts there.

**Announcement.** The caption's own `accessibilityLabel` becomes `<label>, required`. It goes on the caption rather than
on the input for two reasons: a screen reader reaches the caption as its own node, and the input's props are what
Maestro selects on — `observation-creation.yaml` taps the name fields by placeholder (`e.g., Sleep Quality, Mood`), and
a `contentDescription` set on the input would shadow the placeholder that flow matches. No input's `accessibilityLabel`,
`placeholder` or `testID` changes in this slice.

### 3.2 The Observation form

`LabeledTextField` gains `required?: boolean`, passed straight to the `FieldCaption` that replaces the `Text` in its
label row. The row's other occupants are unaffected: `labelAccessory` stays pinned at the right, and `FieldHelpButton`
keeps taking the plain `label` as its dialog title, since a heading is not a field and has nothing to require.

`ObservationFormBody` marks OBSERVATION NAME. `MetricEditorCard` marks METRIC NAME, and leaves MIN, MAX, UNIT and
DESCRIPTION as they are.

**The VALUES caption** is new, and belongs only to the branch that offers value rows as fields. It sits above
`valueRows` as a `FieldCaption`, marked, spaced like `statedLabel` so that a Choice Metric's values read alike whether
they are being declared or stated. The `stored` branch already captions its stated values through `renderStated` and
keeps them unmarked — `renderStated` is left alone, being the one place a caption sits over something the user cannot
fill in. The caption brackets the group from above as `errors.values` already does from below, which is where the rule
was already judged to live.

It is the form's only marked group caption, and METRICS above it stays bare. The difference is not that one rule counts
to two and the other to one: it is that a value row can be blanked at any time, where the last Metric card has no bin to
take it off with.

### 3.3 The forms that gain nothing

Both other forms were audited against the rule and need no change, which is worth recording so that the next reader does
not take their bare captions for an oversight:

* **The Record form.** Every value it takes is optional and a form saved untouched still creates a Record ([Record Value
  Entry](../../features/record-value-entry.md)); the note is optional too. Date and Time render only when a Record is
  being edited, pre-filled from the one on screen and changed only through a picker, so neither is ever empty and
  neither has anything to ask for.
* **`CustomTimeRangeModal`.** Start and End are days chosen from a picker rather than typed, and neither is ever blank.

`SelectField` and `SegmentedField` get no `required` prop. Nothing either of them renders is required, and a prop no
caller passes is a promise a component would be keeping for nobody.

## 4. Verification

### Seed Data

None added. `mixed metrics` already carries the Enum `category`, which is what a stored Choice Metric's unmarked stated
caption is read against ([testing-data.md](../../../testing-data.md)).

### Manual Verification

Reseed test data first, for the editing steps.

1. From the Observation list, tap **+**: OBSERVATION NAME carries `*` and DESCRIPTION does not, before anything is typed
   and before anything is saved.
2. METRICS carries no mark, and neither does TYPE on the card below it — the form is never without either. On that card,
   which opens on Numeric: METRIC NAME carries `*`, and MIN, MAX, UNIT and DESCRIPTION carry none.
3. Change the type to Choice: a marked `VALUES` caption sits above the rows, and VALUE 1 and VALUE 2 carry none. **Add
   Value** appends VALUE 3, unmarked like the rest.
4. Change it to Text and back: no VALUES caption while the type is Text, and the marked one returns with the rows.
5. Tap **Create Observation** on the empty form: the refusals appear where they always have, and every mark is where it
   was before the tap — none moved, none changed colour.
6. Correct the name: its refusal clears and its `*` stays.
7. With a screen reader, focus the OBSERVATION NAME caption — it announces the field as required — then DESCRIPTION's,
   which does not.
8. Open `mixed metrics` → ⋮ → **Edit**: OBSERVATION NAME and every card's METRIC NAME are marked, and the `category`
   card's stated `VALUES` caption is not.
9. Open any Observation → **Add Record**: nothing on the form is marked, the note included.

### Automated Tests

* **Component:** `FieldCaption` renders the mark only when required, and announces the label with `required` only then.
  `LabeledTextField` forwards `required`, defaults to unmarked, leaves its placeholder, `testID` and any caller-supplied
  `accessibilityLabel` untouched either way, and gives its help dialog the unmarked label.
* **Component:** `MetricEditorCard` marks METRIC NAME and leaves MIN, MAX, UNIT and DESCRIPTION unmarked; a Choice card
  renders the marked VALUES caption over unmarked rows, and one more row after **Add Value** is unmarked too; a stored
  Choice card's stated VALUES caption carries no mark; a Numeric, Text or Yes/No card renders no VALUES caption at all.
* **Screen:** `CreateObservationScreen` and `EditObservationScreen` mark OBSERVATION NAME and leave METRICS unmarked;
  `RecordFormScreen` marks no caption it renders.

### E2E Flow

Extend `.maestro/flows/observation-creation/observation-creation.yaml`. The feature has a flow, and this is an addition
to a screen that flow already walks.

* **Fixture:** `reset`, which the flow already opens with.
* **Covers:** the marked OBSERVATION NAME caption, asserted after the existing `assertVisible: "New Observation"`; and
  the marked VALUES caption, asserted where the flow already sets the second card's type to Choice.
* **Handles:** none new — both captions are visible text.
* **Escape the asterisk.** Maestro matches a selector as a regular expression, so `"OBSERVATION NAME *"` reads as the
  caption followed by any number of spaces and would pass just as well against an unmarked one. Write `'OBSERVATION NAME
  \*'`, the way the flow already writes `'Hours \(h\)'`.
