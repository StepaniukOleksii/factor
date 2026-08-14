<!-- =========================================================================
     EXAMPLE DOCUMENT — NOT A FACTOR FEATURE. Fictional app, fictional
     entities, fictional file paths. Nothing here is implemented or planned.
     ========================================================================= -->

> **If you arrived here from a repo-wide search, stop: nothing in this file describes Factor.**
>
> This is the worked example belonging to the `feature-writing` skill. It describes a capability of
> *Bookshelf*, a fictional reading-list app invented for this skill and `spec-creating`'s `example-spec.md`,
> which specifies this very capability before it shipped. Reading the two together shows a slice at both ends
> of its life: a spec that argues and instructs, and the feature file left behind once the spec is deleted. No
> `Book` exists in this repository, and none should.
>
> Copy its **shape** — section structure, depth, voice, and what it leaves out — and nothing else. Real
> examples of Factor's own behaviour are the files in `.sdd/features/`. Everything below the rule is
> exactly what a real feature file contains.

---

# Book Rating

## Goal

A shelf of a hundred finished Books says nothing about which of them were worth the time. Rating one records
that judgement while it is still fresh, in a single tap, so the shelf itself can answer the question later.

## Behaviour

A finished Book carries a rating of one to five stars, applied from the Book's own screen.

**Applying it.** Tapping a star applies that rating on the tap — it is stored immediately, so leaving the
screen keeps it, and there is a save action nowhere in the flow. Tapping the star already applied clears the
rating back to unrated: the same gesture both sets and undoes, which is what makes a mis-tap cheap.

**When the control appears.** Rating is for a Book that has been read, so the stars appear once a Book reaches
the finished state that [Reading Status](reading-status.md) governs. A Book moved back out of finished keeps
the rating it was given, ready for its return.

**Where the rating travels.** A rating belongs to the Book rather than to the screen that set it, so it is
available anywhere the Book is shown; [the shelf](book-listing.md) sets out how it reads there.

**Announcing it.** A screen reader reports the rating currently applied, and each star reports the value it
would set, so the control is workable from the announcement alone.

## Usage

Open a Book you have finished, from [the shelf](book-listing.md) or from a search result. Below the title sit
five stars, filled as far as whatever you last gave it.

Tap the star that matches what you made of it, and the fill moves there. Tap that same star a second time to
clear the rating — worth knowing when a re-reading changes your mind.

You stay on the Book throughout. Rating is done in passing, on the way to somewhere else.
