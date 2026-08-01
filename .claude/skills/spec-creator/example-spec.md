<!-- =========================================================================
     EXAMPLE DOCUMENT — NOT A FACTOR SPEC. Fictional app, fictional entities,
     fictional file paths. Nothing here is implemented or planned.
     ========================================================================= -->

> **If you arrived here from a repo-wide search, stop: nothing in this file describes Factor.**
>
> This is the worked example belonging to the `spec-creator` skill. It specifies a feature of *Bookshelf*, a
> fictional reading-list app invented for this file alone, which happens to share Factor's stack (React Native,
> Expo, SQLite) and layering so its shape transfers. No `Book` entity, `SQLiteBookRepository`, or
> `StarRatingInput` exists in this repository, and none should. Do not implement it, do not cite it as
> precedent for how Factor behaves, and do not carry its subject matter into a real spec.
>
> Copy its **shape** — section structure, depth, voice, and what it leaves out — and nothing else. Everything
> below the rule is exactly what a real `spec.md` contains.

---

# Book Rating

* 2026-01-15

## 1. Goal

A finished Book keeps no record of what the reader made of it, so a shelf of a hundred titles gives no way to
tell one worth pressing on a friend from one endured to the last page. Give each finished Book an optional 1-5
star rating.

## 2. Requirements

* A `Book` carries an optional whole-star rating of 1 to 5. Never rated and rated 1 star are distinct
  states.
* The rating control appears on the Book Details screen only for a Book whose status is `finished`; an
  unread or in-progress Book shows nothing in its place.
* Tapping a star applies that rating immediately — there is no separate save action. Tapping the star
  already applied clears the rating.
* The Book List shows a rated Book's stars beside its title and leaves no gap for an unrated one; rows keep
  the same height either way.
* A screen reader announces the applied rating, and what each star would set.
* Sorting or filtering the list by rating is out of scope — this feature records and displays a rating,
  nothing more.

## 3. Technical Design

### 3.1 Domain

`Book` (`src/domain/Book.ts`) gains `rating: number | null`, defaulting to `null` and declared after `status`
so existing call sites keep working. `bookLimits.ts` gains `BOOK_RATING_MIN = 1` and `BOOK_RATING_MAX = 5`.

A plain mutable field like `title`, guarded by `Book.validateRating(value)` — accepts `null` or a whole number
within those bounds, throws otherwise, in the style of the existing `validateTitle`. Whether a Book *may* be
rated is a screen concern, not a domain one: the domain deliberately does not couple `rating` to `status`, so
a Book moved back out of `finished` keeps its rating rather than silently losing it.

### 3.2 Application

`RateBookUseCase` — input `bookId: string` and `rating: number | null`. Loads the Book through
`BookRepository.findById`, validates, assigns, saves. Throws `Error('Book not found')` for an unknown id,
matching how `DeleteBookUseCase` reports the same case.

`BookRepository` gains no methods; `findById` and `save` already move whole entities.

### 3.3 Infrastructure

Add a nullable `rating INTEGER` column to the `books` table in `BookDatabase.ts` and carry it through
`SQLiteBookRepository`: the `INSERT`, `BookRow`, the `SELECT`, and the `Book` constructor call.

No migration runner is added, and a database created before this change must be wiped rather than upgraded —
the same decision, for the same reasons, as [Reading Status](../1-3-reading-status/spec.md) §3.3.

### 3.4 Presentation

**New shared component — `StarRatingInput`** (`src/presentation/components`, exported from its `index.ts`):
five tappable stars, filled up to the applied value and outlined beyond it. Props: `value: number | null`,
`onChange(value: number | null)`, and `testID`. Stateless — the screen owns the value, because the screen is
what persists it.

* Tapping star *n* calls `onChange(n)`, except when `value === n`, which calls `onChange(null)`.
* Each star is its own touch target, at least 44x44 with `hitSlop`, since the glyph is smaller than that.

**`BookDetailsScreen`** — renders `StarRatingInput` under the title, only when the Book's status is `finished`.
`onChange` runs `RateBookUseCase` and updates local state, so the stars reflect the new value without a reload.
A failure surfaces through the screen's existing error banner.

**`BookListScreen`** — a rated Book's row shows its stars after the title, read-only and smaller; an unrated one
renders nothing there. Row height comes from the title line either way, so nothing shifts.

## 4. Verification

### Seed Data

`seedBooks.ts`: give `finished-classic` 5 stars and `finished-abandoned` 1, and leave `finished-plain` unrated,
so one list carries every display state. `reading-now` and `unread-stack` stay unrated and unratable.

### Manual Verification

Reseed test data first. If a database predating this change exists on the device, clear the app's storage so it
is recreated fresh — there is no in-place upgrade.

1. Open the Book List: `finished-classic` shows five filled stars, `finished-abandoned` one, `finished-plain`
   none, and all three rows stand the same height.
2. Open `finished-plain` and tap the third star: three stars fill immediately, with no save action. Go back —
   its list row shows three.
3. Reopen it and tap the third star again: the rating clears, on both screens.
4. Open `reading-now`: no rating control, and no gap where one would be.
5. Reload the app: every rating set above survives.
6. With a screen reader, focus the control: it announces the applied rating, and each star announces the value
   it would apply.

### Automated Tests

* **Unit:** `Book` defaults `rating` to `null`; `validateRating` accepts `null` and 1 through 5 and rejects 0,
  6, and a fractional value. `RateBookUseCase` saves a valid rating, clears with `null`, rejects an
  out-of-range one, and throws for an unknown `bookId`.
* **Integration:** `SQLiteBookRepository` round-trips `rating` including `null`, and a cleared rating
  overwrites a stored one.
* **Component:** `StarRatingInput` renders the applied value; tapping star *n* emits `n`; tapping the applied
  star emits `null`; each star exposes its target value to accessibility.
* **Screen:** `BookDetailsScreen` shows the control for a finished Book and not for an unread one;
  `BookListScreen` renders stars only for a rated Book.
* **E2E:** `.maestro/2-4-book-rating.yaml`, on the `seed` fixture — open `finished-plain`, tap the third
  star, go back, and confirm its list row shows three.
