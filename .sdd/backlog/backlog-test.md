# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

1. E2E for [Unsaved Record Changes Confirmation](../epics/2-record-management/2-8-unsaved-record-changes-confirmation/spec.md).
   The screen and its Vitest suite are implemented; the Maestro side is outstanding.
   * Write `.maestro/2-8-unsaved-record-changes-confirmation.yaml` on the `seed` fixture — edit a Record,
     meet the dialog at the cross button, keep the edit, then discard it.
   * **Three existing flows are red as they stand** — they abandon a dirty form, so they now meet the dialog
     and stall on it, and each needs a **Discard** tap to pass again:
     `.maestro/2-4-record-editing.yaml` and `.maestro/2-5-record-timestamp-editing.yaml` (both leave through
     "Cancel editing"), and `.maestro/2-6-boolean-metric-input.yaml` (backs out of a create form with a
     segment chosen). Nothing is wrong with the app here: the flows encode the old
     leave-without-asking behaviour, which this feature deliberately reversed.
     `.maestro/3-3-tap-to-record-detail.yaml` and `.maestro/2-2-record-actions-presentation.yaml`
     leave clean forms and are unaffected.
