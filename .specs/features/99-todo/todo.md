[SPEC]

- On failure, the record isn't removed, the modal stays open, and an error is surfaced via alert(...) (same pattern
  already used in CreateRecordScreen), with a deletingRecord loading state disabling the buttons meanwhile.
- When a user is editing existing Record and cancels the action by clicking the cancel or back buttons, and he already
  adjusted some metrics, a confirmation modal window should be displayed
- A user should be able to edit the Record's timestamp
- implement record notes
- on the ObservationListScreen should an observation be removed/edited via long press button like it is done on the
  ObservationDetailsScreen for the Records?

[BUG]

- long press action on a Record tile on the Observation Details screen only works at the top of the tile, but should be
  applicable for the whole tile
- do not use dismiss animation for modals

[REF]

- make a reusable component for modals
