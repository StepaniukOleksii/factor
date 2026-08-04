# Unsaved Record Changes Confirmation

* 2026-08-02

## 1. Goal

The Record form discards everything entered into it the moment the screen is left, silently and instantly, by
every route off it. A back press aimed at the keyboard, or the cross tapped in place of "Save Record", costs the
whole edit with no warning. Ask first: leaving a Record form that holds unsaved changes opens a confirmation
dialog.

This reverses the "Unsaved changes confirmation" that [Record Editing](../2-4-record-editing/spec.md) and
[Record Timestamp Editing](../2-5-record-timestamp-editing/spec.md) each put out of scope.

## 2. Requirements

* Leaving the Record form while its contents differ from what is stored opens a confirmation dialog instead of
  leaving. Every exit qualifies: the header back arrow, the cross button, the Android back button, and the
  system back gesture.
* Both routes are covered — an existing Record that was changed, and a new Record with anything entered into it.
* An edited timestamp counts as a change on equal terms with an edited Metric value.
* A change made and then undone leaves the form clean, so it leaves with no dialog just as an untouched one
  does.
* The dialog offers two choices. Discarding leaves by whichever route was taken and persists nothing; keeping
  the edit returns to the form with every entered value, validation error, and the timestamp exactly as they
  were.
* The Android back gesture dismisses the dialog and counts as keeping the edit — the screen is not left.
* Saving is unaffected: "Save Record" and "Add Record" persist and leave with no dialog.

## 3. Technical Design

Presentation only — no domain, application or storage change. Everything lands in `RecordFormScreen`.

### 3.1 Deciding the form is dirty

The screen already holds the loaded `record` and never mutates it, so it *is* the baseline; there is no snapshot
to take or keep in sync. Dirty is derived on each render:

* **Values.** `values` is keyed by metric id with a cleared Metric's key *absent*, so the comparison spans both
  key sets: dirty when a key is present on one side only, or when a shared key's values differ by `!==` —
  strict equality suffices, since every stored value is a number, a string or a boolean. A Numeric Metric's
  field holds the text that was typed rather than the number it parses to, so the form's values are compared
  after the parse they already go through at save, and `7.20` typed over a stored `7.2` is not a change.
* **Timestamp.** Dirty when `timestamp.getTime()` differs from `record.timestamp.getTime()`.
* **Create mode** has no `record` and renders no Date/Time fields: its baseline is the empty value set, and it
  is dirty as soon as any Metric holds a value.

One consequence to expect rather than treat as a bug: confirming the time picker without moving it truncates the
timestamp's seconds (`withTime` zeroes them), so a Record stored with seconds becomes dirty. That is correct —
saving would write that value — and not worth a minute-precision comparison to paper over.

### 3.2 Intercepting the exit

One `beforeRemove` listener, registered on the `navigation` prop in an effect and removed through its returned
unsubscribe. Every exit from this screen is a route removal, the header arrow and Android's back press alike
([Back to Unzoom Trend Chart](../../3-observation-visualization/3-10-back-to-unzoom-trend-chart/spec.md) §3.2),
so one listener covers all four with nothing wired per control. That spec rejected this event for the
mirror-image reason — it needed the header arrow to keep leaving — and anticipated this feature making a shared
hook worth extracting. It doesn't: the two catch different events for opposite purposes and share no logic.

Taken from the `navigation` prop rather than the `usePreventRemove` or `useNavigation` hooks, both of which
need a navigator above them: `RecordFormScreen.test.tsx` renders this screen bare, with a fake navigation
object.

On a clean form the listener does nothing. On a dirty one it calls `preventDefault()`, holds the event's removal
action in state, and opens the dialog; discarding dispatches the held action, so the user arrives wherever they
were headed rather than at a hardcoded destination.

Saving removes the route too — `onSaved` calls `popTo` — and the form is still dirty against the loaded Record
at that moment, so that removal has to pass. A ref set immediately before `onSaved()` stands the listener down
for it; a ref rather than state, because the listener has to see it within the same tick. Only the success path
sets it, so a save that throws leaves the guard armed.

### 3.3 The dialog

A `Modal` in `RecordFormScreen`, styled after the Observation Details screen's confirmation dialogs exactly as
[Metric Description](../2-7-metric-description/spec.md) §3.4 specifies for `FieldHelpButton`, and for the same
reason — the shared modal component that would replace all of them is
[a backlog refactor](../../../backlog/backlog-ref.md). *(Superseded: that refactor landed. This is now a
`Dialog`, with the wording, actions and behaviour below unchanged.)*

* Headed "Discard changes?", with a body stating the edit will be lost.
* Two actions: "Keep editing", which closes the dialog and drops the held action, and "Discard", destructive in
  `COLORS.error` like the delete dialogs' confirm, which dispatches it. Accessibility labels name the outcome
  ("Keep editing this record", "Discard unsaved changes"), matching the existing "Cancel deletion" /
  "Confirm deletion" pair.
* `onRequestClose` behaves as "Keep editing".
* The form keeps its state throughout, so returning to it restores nothing.

## 4. Verification

### Seed Data

No additions — `no numeric` carries the shortest Record form in the fixture set, and its Records sit at the top
of the Observation Details screen with no TRENDS section above them
([testing-data.md](../../../../testing-data.md)).

### Manual Verification

Reseed test data first. Open `no numeric` and long-press its most recent Record, then **Edit Record**.

1. Leave straight away by each of the four routes in turn — header arrow, cross button, Android back button,
   system back gesture: no dialog, back on Observation Details every time.
2. Reopen, change `mood`, and tap the cross: the dialog appears. **Keep editing** returns the form with the
   changed value still in the field.
3. Tap the header arrow, then **Discard**: back on Observation Details, the Record still showing its stored
   value.
4. Reopen, change `mood`, and try the Android back button and then the back gesture: each opens the dialog
   rather than leaving.
5. With the dialog open, press the Android back button: the dialog closes, the form stays, and the screen is not
   left.
6. Reopen, change `mood`, change it back to its stored value, and tap the cross: no dialog.
7. Reopen, change only the Date field, and tap the cross: the dialog appears; discard, and the Record keeps its
   stored timestamp.
8. Reopen, change `mood`, and tap **Save Record**: no dialog, and Observation Details shows the new value.
9. From Observation Details tap **Add Record**, enter nothing, and press back: no dialog. Repeat with a value
   entered: the dialog appears, and discarding creates no Record.
10. With TalkBack, focus each dialog action: each announces what it does.

### Automated Tests

* **Screen — `RecordFormScreen`:** the harness's fake navigation object needs an `addListener` recording the
  `beforeRemove` listener, so a test can invoke it with a fake event carrying `preventDefault` and a
  `data.action`. Cases: a clean edit form, a clean create form and one still loading pass the event through with
  no dialog; a changed value, a cleared value, a changed timestamp, and any value entered in create mode each
  prevent it and open the dialog; a value changed and changed back stays clean; **Keep editing** closes the
  dialog, dispatches nothing and leaves entered values in place; **Discard** dispatches exactly the action the
  event carried; a successful save navigates without opening the dialog, and a failed one leaves the next exit
  still intercepted.
* **Existing flows:** `.maestro/2-4-record-editing.yaml` and `.maestro/2-5-record-timestamp-editing.yaml`
  abandon a dirty edit through "Cancel editing", and `.maestro/2-6-boolean-metric-input.yaml` backs out of a
  create form with a segment chosen — all three now meet the dialog and need a **Discard** tap.
  `.maestro/3-3-tap-to-record-detail.yaml` and `.maestro/2-2-record-actions-presentation.yaml` leave clean forms
  and are unaffected.
* **E2E:** `.maestro/2-8-unsaved-record-changes-confirmation.yaml`, on the `seed` fixture — editing a Record,
  meeting the dialog at the cross button, keeping the edit, then discarding it.
