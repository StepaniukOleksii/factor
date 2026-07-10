# Observation Deletion

## Goal

Allow users to permanently delete an Observation from the Observation Details screen.

Deletion is an intentional, destructive action and therefore requires explicit user confirmation before any data is removed.

---

## Requirements

### Observation Menu

A kebab (three dots) menu is displayed in the Observation Details screen header.

The menu is positioned on the far right side of the Observation title.

When the user taps the menu, a dropdown menu is displayed.

### Menu Items

Initially, the menu contains a single action:

* Delete

The Delete menu item:

* Displays a bin icon.
* Uses red text to indicate a destructive action.

The menu closes after the user selects an action.

### Delete Confirmation

When the user selects **Delete**, a confirmation modal is displayed.

The modal asks the user to confirm deletion of the Observation.

The modal provides two actions:

* Cancel
* Delete

### Cancel Deletion

When the user selects **Cancel**:

* The modal closes.
* No data is modified.
* The user remains on the Observation Details screen.

### Confirm Deletion

When the user selects **Delete** in the confirmation modal:

* The Observation is permanently deleted.
* All associated Records are deleted.
* The user is navigated back to the Observation List screen.
* The deleted Observation is no longer displayed in the Observation List.

---

## Out of Scope

This feature does not include:

* Undo functionality.
* Soft deletion.
* Deleting individual Records.
* Deleting Metrics independently.
* Multiple menu actions.
* Multi-selection.
* Bulk deletion.

---

## Technical Design

### Navigation

Deletion is initiated from the Observation Details screen.

After successful deletion, the Observation Details screen is removed from the navigation stack and the user returns to the Observation List screen.

### Data Deletion

Deleting an Observation removes:

* The Observation.
* All Records belonging to the Observation.

Shared Metric definitions must not be deleted if they are referenced by other Observations.

Deletion should be executed as a single atomic operation to prevent partial data removal.

### User Interface

The kebab menu and confirmation modal should match the mobile design defined in `./design/design.html`.

**Make sure to use the mobile version**.

---

## Verification Plan

### Manual Verification

Verify that:

1. The kebab menu is displayed on the right side of the Observation title.
2. Tapping the menu opens the action list.
3. The Delete action displays a bin icon.
4. The Delete action uses red text.
5. Selecting Delete opens the confirmation modal.
6. Selecting Cancel closes the modal without deleting the Observation.
7. Selecting Delete removes the Observation.
8. Associated Records are removed.
9. The user is returned to the Observation List screen.
10. The deleted Observation no longer appears in the list.

### Automated Tests

Add tests covering:

* Display of the kebab menu.
* Display of the Delete menu item.
* Confirmation modal visibility.
* Cancellation flow.
* Successful Observation deletion.
* Cascading deletion of associated Records.
* Preservation of Metrics that are still referenced by other Observations.
* Navigation back to the Observation List screen after deletion.
