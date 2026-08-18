# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

1. E2E: Observation editing (from the Observation Editing slice). A new flow,
   `flows/observation-editing/observation-editing.yaml` — this is the capability's first slice, so the folder
   does not exist yet.

   * **Fixture:** `seed`.
   * **Covers:** open `no records` from the list, ⋮ → Edit, replace the name, **Save Observation**, and assert
     the Observation's header carries the new name and the list row does too. Then ⋮ → Edit again, type
     `stale records` over it, save, and assert the collision is marked with the form still up — the one refusal
     worth an emulator, since it is the only rule whose input comes from outside the screen.
   * **Handles:** none outstanding. The menu's Edit item carries `accessibilityLabel` `Edit observation`,
     matching the Delete item's, and the implementation ships it. Everything else on the path is reachable by
     visible text: the button labels (`Save Observation`), the header (`Edit Observation`), and the pre-filled
     name field, which is tapped by the text it holds.
