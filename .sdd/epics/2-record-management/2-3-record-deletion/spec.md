# Record Deletion

## Goal

Allow users to permanently delete a Record after confirming the action.

This feature implements the deletion behavior initiated from the Record Actions contextual menu.

---

## Requirements

### Record Deletion

When the user confirms deletion by selecting **Delete** in the confirmation modal:

* The selected Record is permanently deleted from local storage.
* The confirmation modal closes.
* The Observation Details screen remains visible.
* The displayed Records are refreshed.

### Record List Refresh

After deletion:

* The Observation Details screen continues to display the three most recent Records.
* If additional older Records exist, they are loaded to maintain a maximum of three displayed Records.
* Records remain ordered from newest to oldest.

### Empty State

If the deleted Record was the final Record belonging to the Observation:

* The existing empty state is displayed on the Observation Details screen.

### Error Handling

If Record deletion fails:

* The Record is not removed.
* The Observation Details screen remains unchanged.
* A meaningful error message is displayed to the user.

---

## Out of Scope

This feature does not include:

* Record editing
* Undo functionality
* Soft deletion
* Bulk deletion
* Record recovery
* Changes to the deletion confirmation UI

---

## Technical Design

### Deletion

Record deletion permanently removes the selected Record from the local database.

### Refresh

After successful deletion, the Observation Details screen reloads its Record list from the data source to ensure the displayed Records reflect the current state.

---

## Verification Plan

### Manual Verification

Verify that:

1. Confirming deletion permanently deletes the selected Record.
2. The confirmation modal closes after successful deletion.
3. The Observation Details screen remains open.
4. The Record list refreshes automatically.
5. The screen displays up to three most recent Records after refresh.
6. If additional older Records exist, they replace deleted Records in the displayed list.
7. Records remain ordered from newest to oldest.
8. The empty state is displayed when the final Record is deleted.
9. If deletion fails, no Record is removed and an error message is displayed.

### Automated Tests

Add tests covering:

* Successful Record deletion.
* Removal of the deleted Record from persistence.
* Refresh of the Observation Details screen.
* Loading of additional Records after deletion.
* Empty state after deleting the final Record.
* Error handling when deletion fails.
