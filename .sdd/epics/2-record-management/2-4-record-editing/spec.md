# Record Editing

## Goal

Allow users to edit an existing Record.

This feature reuses the existing Record form introduced in the Record Creation feature, pre-populating it with the
selected Record's values.

---

## Requirements

### Navigation

Selecting **Edit** from the Record Actions contextual menu navigates the user to the Record form in edit mode.

The selected Record is loaded and its values are displayed in the corresponding input fields.

### Record Form

The edit form reuses the existing Record creation screen.

The screen displays:

* Observation title, back navigation button, cancel action cross button
* Record timestamp
* All Metrics defined by the Observation
* Existing values of the selected Record
* Save Record button

### Editing

The user can modify the values for all Metrics.

The existing validation rules from the Record Creation feature apply.

The Record timestamp is not editable.

### Saving

When the user saves the Record:

* The existing Record is updated.
* The Record identifier remains unchanged.
* The user is returned to the Observation Details screen.
* The displayed Records are refreshed to reflect the updated values.

### Cancel

If the user leaves the screen without saving:

* No changes are persisted.
* The user returns to the Observation Details screen.

---

## Out of Scope

This feature does not include:

* Editing the Record timestamp
* Unsaved changes confirmation
* Undo functionality
* Editing Observation or Metric definitions
* Changes to the Record creation UI beyond supporting edit mode

---

## Technical Design

### Screen Reuse

The existing Record creation screen supports two modes:

* Create
* Edit

The mode is determined by the navigation parameters.

### Data Loading

In edit mode, the screen loads the selected Record and populates the form with its existing values.

### Update

Saving updates the existing Record in local storage rather than creating a new Record.

---

## Verification Plan

### Manual Verification

Verify that:

1. Selecting **Edit** opens the Record form in edit mode.
2. The existing Record values are pre-populated.
3. The Observation title and Metrics are displayed.
4. Metric values can be modified.
5. Record creation validation rules are enforced.
6. The Record timestamp cannot be edited.
7. Saving updates the existing Record.
8. The Record identifier remains unchanged.
9. The user returns to the Observation Details screen after saving.
10. Updated values are displayed on the Observation Details screen.
11. Leaving the screen without saving does not modify the Record.

### Automated Tests

Add tests covering:

* Navigation to the Record form in edit mode.
* Loading existing Record values.
* Validation during editing.
* Updating an existing Record.
* Preserving the Record identifier.
* Returning to the Observation Details screen after saving.
* Cancelling without persisting changes.
