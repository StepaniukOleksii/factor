# Tech Stack

## Purpose

This document defines the approved technology stack for Factor.

Significant changes to the stack must be documented through ADRs.

---

## Guiding Principles

Technology choices should prioritize:

* Simplicity
* Maintainability
* Strong community support
* Long-term viability
* AI-assisted development friendliness
* Minimal operational complexity

Preference is given to widely adopted technologies with large ecosystems and extensive documentation.

---

## Application Framework

### React Native

React Native is used as the primary mobile application framework.

Rationale:

* Large ecosystem
* Strong community support
* Mature platform
* Excellent TypeScript support
* Strong AI tooling support
* Cross-platform mobile development

### Expo

Expo is used as the application platform and development environment.

Rationale:

* Simplified development workflow
* Simplified native integrations
* Faster iteration
* Reduced maintenance burden

---

## Programming Language

### TypeScript

TypeScript is the primary programming language used throughout the project.

Rationale:

* Strong typing
* Excellent developer experience
* Large ecosystem
* Consistency across application layers
* Strong AI support

---

## State Management

### Zustand

Zustand is used for application state management.

Rationale:

* Minimal boilerplate
* Easy to understand
* Lightweight
* Well-suited for small and medium-sized applications

---

## Data Storage

### SQLite

SQLite is used as the primary persistence layer.

Rationale:

* Mature and reliable
* Excellent support for structured queries
* Well-suited for analytical workloads
* Local-first architecture support
* No additional infrastructure requirements

The specific SQLite integration library is documented through ADRs.

---

## Testing

### Vitest

Vitest is used for unit testing.

### Testing Library

Testing Library is used for component and integration testing.

Rationale:

* Modern tooling
* Strong TypeScript support
* Large community adoption

---

## Deliberately Excluded

The initial version does not use:

- Backend services
- Cloud databases
- Redux
- Dependency injection frameworks
- AI/LLM integrations
- Synchronization services
- Charting and visualization libraries

These decisions may be revisited through ADRs.
