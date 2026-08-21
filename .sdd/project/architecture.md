# Architecture

## Purpose

This document describes the high-level architecture and architectural principles of Factor.

Detailed technical decisions live in ADRs — see [Architectural Decisions](#architectural-decisions) for what earns one.

---

## Overview

Factor is a mobile-first, domain-driven application for collecting observations, analyzing relationships between them,
and generating insights.

The application is designed around the following principles:

* Domain-first design
* Insight-centric functionality
* User-defined flexibility
* Offline-first operation

---

## Architectural Style

Factor follows Domain-Driven Design (DDD).

The application is organized into the following layers:

* Presentation
* Application
* Domain
* Infrastructure

Dependencies should flow inward toward the domain.

The domain layer must not depend on presentation, storage, or platform-specific concerns.

---

## Storage

All data is stored locally on the device.

The storage layer should support:

* Historical data retention
* Efficient querying
* Flexible domain evolution

Storage technology selection is documented through ADRs.

---

## Domain Model

The domain model is [domain-overview.md](domain-overview.md)'s, and it evolves as the app does.

This document intentionally does not define domain entities.

---

## Architectural Decisions

An ADR records a technical decision together with the alternatives it beat, so that a later change cannot quietly undo
the reasoning without having seen it.

Two kinds of decision qualify:

* **Significant and hard to reverse** — storage technology, state management, dependency injection, analysis engine
  design, synchronization strategy.
* **Narrow, but a later change would get it wrong without knowing.** Which layer enforces a rule, why one API was chosen
  over the obvious one. [ADR-4](../adr/4-name-uniqueness-rule-placement.md) is this kind: it settles where a
  name-uniqueness rule belongs, and its reasoning would otherwise have died with the spec that carried it.

An alternative having been rejected is not enough on its own — every decision has a road not taken. Any **yes** below
means no ADR:

* **Does a type, a test, or the shape of the code already stop the wrong choice being made?** Then the code is the
  record, and a comment on it is the most that is warranted.
* **Will a feature file state this once the slice ships?** Behaviour is the feature file's, and an ADR restating it is a
  second copy to drift.
* **Was the rejected alternative actually in contention**, or produced to fill the template's section?
* **Can you name the later change that gets this wrong, and what breaks when it does?** "Someone might" is not a
  consequence.

**An ADR cites only what outlives it.** It is permanent, so a reference to a spec or its mockups becomes a dead pointer
the moment that slice retires. Name the durable artifact instead — a feature file, another ADR, a `.sdd/project/`
document. Where the slice is worth naming at all, name what it delivered rather than the folder it was specified in.
