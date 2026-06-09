# Domain Overview

This document describes the core domain concepts and their relationships.

## Observation

An Observation represents something that can be tracked over time.

An Observation defines:

* Metrics
* Records

Examples:

* Sleep Quality
* Mood
* Energy
* Basketball Practice
* Weather

---

## Metric

A Metric defines a measurable property of an Observation.

Metrics provide structure and consistency for Records.

Examples:

* Duration
* Intensity
* Quality
* Temperature

Metrics may be reused across multiple Observations.

---

## Record

A Record represents data captured for an Observation at a specific point in time.

A Record contains values for one or more Metrics defined by its Observation.

---

## Group

A Group represents a user-defined collection of Observations.

An Observation may belong to multiple Groups.

Groups are used to organize Observations for analysis.

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

---
