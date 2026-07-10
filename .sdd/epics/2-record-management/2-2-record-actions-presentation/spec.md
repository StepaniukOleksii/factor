# Record Actions

## Goal

Provide a contextual menu for Records on the Observation Details screen, establishing the user interface for future
Record actions.

This feature introduces the presentation layer only. Record editing and deletion behavior will be implemented in
subsequent features.

The visual design for this screen is provided separately in `.design/record-actions.html`.

---

## Requirements

### Contextual Menu

A user can long-press any Record card on the Observation Details screen.

Long-pressing a Record opens a contextual menu associated with the selected Record.

The contextual menu displays:

* Title "Record actions"
* Record timestamp
* Edit action
* Delete action

The menu can be dismissed by tapping outside the bottom sheet or using the standard dismissal gesture.

### Edit Action

Selecting **Edit** closes the contextual menu.

No further behavior is implemented in this feature.

### Delete Action

Selecting **Delete** closes the contextual menu and opens a confirmation modal.

### Delete Confirmation Modal

The confirmation modal asks the user to confirm Record deletion.

The modal contains two actions:

* Delete
* Cancel

Selecting either action closes the confirmation modal.

No Record is deleted in this feature.

---

## Out of Scope

This feature does not include:

* Record editing
* Record deletion
* Persistence changes
* Business logic
* Navigation
* Undo functionality
* Additional contextual menu actions

---

## Verification Plan

### Manual Verification

Verify that:

1. Long-pressing a Record opens the contextual menu.
2. The contextual menu displays the selected Record title.
3. The contextual menu displays the selected Record timestamp.
4. The contextual menu displays Edit and Delete actions.
5. Selecting Edit closes the contextual menu.
6. Selecting Delete opens the confirmation modal.
7. The confirmation modal displays Delete and Cancel buttons.
8. Selecting either button closes the confirmation modal.
9. No Record is modified or deleted.

### Automated Tests

Add tests covering:

* Long-press interaction.
* Contextual menu rendering.
* Display of the selected Record information.
* Opening and closing of the confirmation modal.
* Edit and Delete UI interactions.
