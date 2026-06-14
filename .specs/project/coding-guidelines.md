# Coding Guidelines

## General

* Prefer simple solutions.
* Follow existing patterns.
* Refactor instead of duplicating.
* Remove dead code.

---

## TypeScript

* Use strict typing.
* Avoid `any`.
* Prefer explicit types for public APIs.

---

## Error Handling

* Fail fast.
* Never silently ignore errors.
* Surface meaningful error messages.

---

## Testing

* Always write unit tests for new features, domain models, and business logic.
* Colocate test files next to the source files they test (e.g., `MyClass.test.ts` next to `MyClass.ts`).
* Test business-critical behavior.
* Add tests for bug fixes.
* Keep tests readable and maintainable.

---

## Documentation

* Prefer self-explanatory code over comments.
* Document intent, not implementation.
* Update specifications and ADRs when behavior or decisions change.

---

## AI-Assisted Development

* Implement only specified functionality.
* Reuse existing patterns before introducing new ones.
* Do not introduce dependencies without justification.
* Do not introduce new architectural patterns without an ADR.
* When requirements are unclear, update the specification before implementing.
