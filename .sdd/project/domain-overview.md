# Domain Overview

This document describes the core domain concepts, their relationships, and the rules that hold wherever they
are used. It says what each concept *is*; how a user reaches or works with one is a feature's business, not
this document's.

## Observation

An Observation represents something that can be tracked over time.

An Observation carries:

* A name of at most 30 characters, which is how it is told apart from the others.
* An optional description of at most 150 characters — what it is for and why it is tracked, beyond what a
  short name can say.
* One or more Metrics.
* The Records made against it.

Examples:

* Sleep Quality
* Mood
* Energy
* Basketball Practice
* Weather

An Observation's name is unique among Observations, compared under the name identity rule below. Nothing
reserves a name beyond the Observations that exist, so deleting one frees its name.

An Observation owns its Metrics and its Records: both are removed with it, and neither exists apart from it.

---

## Metric

A Metric defines a measurable property of an Observation.

Metrics provide structure and consistency for Records.

Examples:

* Duration
* Intensity
* Quality
* Temperature

A Metric is never shared: one defined on another Observation is a different Metric, whatever it is called.

A Metric's name is at most 15 characters and unique within its Observation, compared under the name identity
rule below.

A Metric carries an optional description of at most 500 characters: prose explaining what it means and what
its values stand for, kept with the line breaks it was written with so a per-value legend reads as a list. It
guides whoever is entering a value and never constrains one — a value is judged by the Metric's type and
constraint alone.

### Metric types

A Metric's type is fixed when the Metric is defined, and decides what a value for it may be:

* **Numeric** — a number. The Metric may declare a minimum, a maximum, both, or neither. Both bounds are
  inclusive, and a minimum may not exceed its maximum.
* **Text** — any text, under no constraint.
* **Yes/No** — one of two answers, the pair being fixed by the type.
* **Choice** — one of a fixed set of values the Metric declares, offered in the order declared. Between 2 and
  4 of them, each at most 12 characters, no two the same under name identity; fewer than two would leave
  nothing to choose between.

The domain's own names for the last two are `Boolean` and `Enum`; `Yes/No` and `Choice` are how they are put
to a user, since the domain names describe data types rather than what they offer.

---

## Name identity

The single definition of "the same name", used by both uniqueness rules above.

Two names are the same when they match after trimming the whitespace around them and ignoring case: `No
Records` is the name `no records`. Anything beyond that distinguishes them — interior spacing and accented
characters included. A name is stored as the user typed it, less the whitespace around it, so the comparison
never rewrites what is kept.

---

## Record

A Record represents data captured for an Observation at a specific point in time.

A Record carries:

* A timestamp — when the thing being recorded happened, which is not necessarily when it was entered.
* Values for the Metrics its Observation defines.
* An optional note of at most 150 characters.

A Record is valid holding values for any subset of its Observation's Metrics, including none at all — one
carrying a timestamp and nothing else records that the occasion happened.

Absence is stored as absence, never as a substitute value: an unanswered Metric has no value on the Record
rather than a zero, a blank, or a negative answer standing in for one. Every reader of a Record therefore
tolerates one holding no value for a Metric, or no values at all.

A value that is present must satisfy its Metric's type and constraint. Changing a Record's values replaces
the set rather than merging into it, so a value cleared is a value removed.

An empty Record is inert to analysis: it belongs to no series and appears in no chart, while remaining
visible wherever Records are listed.

The note is free text about that one occasion — the hotel bed behind a bad night's sleep, the illness behind
a fortnight's dip. It is deliberately not a Metric: a Metric is a standing property of every Record on the
Observation, asking to be answered every time, where an aside about one occasion is neither. It takes no part
in any series or chart.

---

## Group

A Group represents a user-defined collection of Observations.

An Observation may belong to multiple Groups.

Groups are used to organize Observations for analysis.

Modelled but unreachable: nothing creates a Group or shows one.

---

## Event

An Event represents a meaningful occurrence that may influence Observations.

Events are independent from Observations and may occur multiple times.

Each Event maintains the timestamps at which it occurred.

Examples:

* Vacation
* Illness
* New Job
* Emotional Upsurge

Like Groups, Events are modelled and unreachable — a Record carrying a timestamp and no values is the closest
thing a user can express today.

---
