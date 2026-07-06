- on the ObservationListScreen should an observation be removed/edited via long press button like it is done on the
  ObservationDetailsScreen for the Records?
- do not use dismiss animation for modals
- make a separate component for modals
- implement record editing
- implement record notes

[SPEC]

- On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
  already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.