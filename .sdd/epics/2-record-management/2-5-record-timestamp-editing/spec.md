# Record Timestamp Editing

## Goal

Allow users to change a Record's timestamp while editing it, reversing the constraint
[Record Editing](../2-4-record-editing/spec.md) established: "The Record timestamp is not editable." The
existing Record form already displays the timestamp in edit mode as static text; this feature turns it into a
Date field and a Time field the user can change, saved together with any Metric value edits through the same
"Save Record" action.

---

## Requirements

### Timestamp Fields Replace the Static Display

In edit mode, the Record form's centered timestamp text is replaced by two tappable fields, labeled "Date"
and "Time", positioned where the static text is today.

### Editing the Date

Tapping the Date field opens the platform's native date picker, pre-filled with the Record's current date.
Picking a new date replaces only the date portion of the timestamp; the time-of-day is unchanged.

### Editing the Time

Tapping the Time field opens the platform's native time picker, pre-filled with the Record's current
time-of-day. Picking a new time replaces only the time-of-day; the date portion is unchanged.

### No Future Dates

The Date field's picker cannot select a day later than today; there is no lower bound. This mirrors the
existing constraint on the Custom Time Range selector's End date
([Custom Time Range Input](../../3-observation-visualization/3-5-custom-time-range-input/spec.md)). The Time
field has no constraint of its own.

### Saving

The edited timestamp is saved together with any Metric value changes when the user presses "Save Record" —
there is no separate confirmation step for the timestamp alone.

### Cancel

If the user leaves the screen without saving (back arrow or the cross/close button), the edited timestamp is
discarded exactly as edited Metric values already are today — no changes are persisted.

### Create Mode Unaffected

The Record Creation flow is unaffected: a new Record still always takes the current timestamp automatically,
with no Date/Time fields shown. This feature only changes edit mode.

---

## Out of Scope

This feature does not include:

* Editing a Record's timestamp from anywhere other than the Record form (e.g. no inline timestamp edit from
  the Record Actions contextual menu).
* Setting a custom timestamp during Record *creation* — creation continues to always use the current moment.
* Unsaved changes confirmation on cancel (tracked separately in the backlog).
* Any change to how or where Records are displayed elsewhere in the app as a result of a changed timestamp —
  the Observation Details Record list picks up the new value through its existing refresh-on-save behavior,
  not new logic.

---

## Technical Design

### Domain Layer

No new entities. `Record.timestamp` is already a plain mutable field with no existing invariant; it continues
to be set directly by the Application layer. This mirrors how the entity already treats its two mutable
pieces of state differently: `updateValues` enforces an invariant (values must match the Observation's
Metrics) and so is encapsulated behind a method, while `timestamp` has no equivalent structural constraint to
enforce and remains a plain field.

### Application Layer

`UpdateRecordCommand` gains a required `timestamp: Date` field, alongside the existing `recordId`,
`observationId`, and `values`.

`UpdateRecordUseCase.execute` assigns the command's `timestamp` onto the loaded `Record` before calling
`recordRepository.update`, in addition to its existing call to `record.updateValues(...)`.

### Storage Layer

`SQLiteRecordRepository.update` currently only replaces a Record's `record_values` rows — it never writes to
the `timestamp` column on `records`, so a changed timestamp would silently fail to persist. `update` must
also write the Record's timestamp to the `records` table for the given `id`, within the same transaction as
the `record_values` replacement.

### User Interface

The Record form's edit mode:

* Gains a `timestamp` piece of state, initialized from the loaded Record's `timestamp` alongside its existing
  Metric-value initialization.
* Replaces its current static timestamp text with two labeled, tappable fields side by side — "Date" and
  "Time" — styled after the labeled-field-opens-a-picker pattern already established by
  `CustomTimeRangeModal`'s Start/End fields: a label above a bordered value row showing the current value and
  an icon, opening a native picker on tap.
* Tapping the Date field opens a date-mode picker pre-filled with the current timestamp, its latest
  selectable day capped at today. Picking a date replaces the year/month/day of the stored timestamp,
  keeping its existing time-of-day.
* Tapping the Time field opens a time-mode picker pre-filled with the current timestamp, with no
  minimum/maximum constraint. Picking a time replaces the hours/minutes of the stored timestamp, keeping its
  existing date.
* Only one picker is open at a time, mirroring `CustomTimeRangeModal`'s single-open-picker behavior.
* The Date field displays its value in the same short-date style already used elsewhere in the app (e.g.
  "Jul 15"); the Time field displays its value in the same style the form's existing relative-timestamp text
  already renders time in (e.g. "8:15 AM").
* Saving includes the edited `timestamp` in the update call; the Record Creation path is unaffected and never
  reads or sends a `timestamp`.
* Create mode renders no Date/Time fields, matching today's behavior where nothing timestamp-related is shown
  until a Record exists.

---

## Verification Plan

### Manual Verification

Verify that:

1. Opening an existing Record for editing shows two tappable fields, Date and Time, in place of the
   previously static timestamp text.
2. Tapping the Date field opens a native date picker pre-filled with the Record's current date, and that no
   day after today is selectable.
3. Picking an earlier date updates the Date field and leaves the Time field's value unchanged.
4. Tapping the Time field opens a native time picker pre-filled with the Record's current time.
5. Picking a different time updates the Time field and leaves the Date field's value unchanged.
6. Editing the timestamp together with a Metric value, then saving, returns to the Observation Details
   screen with the Record's displayed date/time reflecting the change.
7. Re-opening the same Record afterward shows the new timestamp persisted.
8. Editing the timestamp and then leaving via the back arrow or the cross/close button discards the change —
   re-opening the Record shows the original timestamp.
9. Opening the Record Creation flow (not edit) shows no Date/Time fields, and a newly created Record still
   receives the current timestamp automatically.

### Automated Tests

Add tests covering:

* `UpdateRecordUseCase`: `execute` sets the loaded Record's timestamp to the command's `timestamp` and
  persists it via `recordRepository.update`, alongside its existing value-update behavior.
* `SQLiteRecordRepository`: `update` persists a changed timestamp to the `records` table — fetching the
  Record afterward returns the new timestamp, not the original one (regression guard for the storage gap
  this feature fixes).
* Record form, edit mode:
  * Renders Date and Time fields, pre-filled from the loaded Record's timestamp, in place of the old static
    text.
  * Picking a new date updates only the date portion of the saved timestamp; picking a new time updates only
    the time-of-day.
  * Saving sends the edited timestamp alongside the edited values.
  * Canceling does not persist the edited timestamp.
* Record form, create mode: no Date/Time fields are rendered, and creating a Record does not send a
  `timestamp`.
