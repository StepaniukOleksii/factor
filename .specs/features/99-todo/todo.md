- on the ObservationListScreen should an observation be removed/edited via long press button like it is done on the
  ObservationDetailsScreen for the Records?
- do not use dismiss animation for modals
- make a separate component for modals
- implement record editing
- implement record notes

[SPEC]

- On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
  already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.
- When a user is editing existing Record and cancels the action by clicking the cancel or back buttons, and he already
  adjusted some metrics, a confirmation modal window should be displayed
- A user should be able to edit the Record's timestamp