# Architecture

## Purpose

This document describes the high-level architecture and architectural principles of Factor.

Detailed technical decisions should be captured in ADRs.

---

## Overview

Factor is a mobile-first, domain-driven application for collecting observations, analyzing relationships between them, and generating insights.

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

The domain model is documented separately and will evolve over time.

This document intentionally does not define domain entities.

---

## Architectural Decisions

Significant architectural decisions must be documented using ADRs.

Examples include:

* Storage technology
* State management
* Dependency injection
* Analysis engine design
* Synchronization strategy
