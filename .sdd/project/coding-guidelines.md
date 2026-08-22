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

## Comments

Default to no comment. The code says what it does, and every sentence beside it is one more thing that has to stay true
as the code moves.

* **Comment what forced the code's shape, never what the code does.** A platform limit, a library defect, a race, an API
  that works only one way — a reader cannot recover any of those by reading, and whoever hit them is the only one who
  can write them down. A choice that could have gone another way gets no comment: justifying it implies a significance
  it does not have.
* **Write the shortest sentence that carries the reason.** Where justifying one line takes a paragraph, the reasoning
  might be an ADR's and the comment is a pointer to it.
* **State the present rule, never the change.** A comment phrased as a delta is unreadable to anyone who never saw the
  previous version. Git holds the history.
* **Put the fact where it binds.** Document an interface's fields rather than the interface, and put a file-level note
  at the top of the file — JSDoc otherwise claims to describe whichever declaration follows it.
* **Cite only what outlives the comment.** An ADR, a feature file, a `.sdd/project/` document. A spec is deleted when
  its slice retires, and a comment pointing at one points at nothing.
