# Coding Guidelines

## General

* Prefer simple solutions.
* Prioritize code reuse
* Follow existing patterns.
* Refactor instead of duplicating.
* Remove dead code.
* Do not introduce dependencies without justification.

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

* Do not comment code that explains itself. Where the reason behind the code cannot be read from the code, state that
  reason and nothing else.
