# Backlog — Tests

This is an informal idea/issue capture list — not a specification. It exists to hold loose testing
notes until they're ready to become a real spec.

- `.maestro/2-10-numeric-metric-boundaries.yaml`, on the `seed` fixture — entering an out-of-range value on
  `dense`, seeing the message, correcting it, and saving. Placeholder and message are both platform text, so a
  flow can assert them. Named by
  [Numeric Metric Boundaries](../epics/2-record-management/2-10-numeric-metric-boundaries/spec.md) §4, whose
  implementation is otherwise complete.
- `.maestro/2-11-enum-metric-input.yaml`, on the `seed` fixture — opening `no numeric`'s Record form, opening
  `mood`, tapping `high`, saving, and seeing it on the Record. `no numeric` rather than `mixed metrics`
  because its values are words Maestro can match on, where `category`'s single letters would collide with
  other text on screen. Named by
  [Enum Metric Input](../epics/2-record-management/2-11-enum-metric-input/spec.md) §4, whose implementation is
  otherwise complete.
