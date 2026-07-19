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

## Data Visualization

### Skia

`@shopify/react-native-skia` is used as the rendering foundation for Observation visualization (trend
charts).

Rationale:

* Composable canvas primitives rather than a fixed set of chart components
* Built-in gesture and animation handling
* Actively maintained, de facto standard for custom drawing in React Native
* Compatible with the existing Expo / React Native New Architecture setup

Skia v2's native `<Canvas>` requires `react-native-reanimated` (and its `react-native-worklets`
runtime) even for static charts, so both are required companion dependencies of this choice. Install
the Expo-pinned versions; `babel-preset-expo` wires the reanimated Babel plugin automatically.

See [ADR-1](../adr/1-visualization-rendering-foundation.md) for the full rationale and alternatives
considered.

---

## Navigation

### React Navigation

`@react-navigation/native` with `@react-navigation/native-stack` provides navigation, as a single native
stack.

Rationale:

* De facto standard for React Native, supported first-class by Expo
* Stack semantics scope screen state structurally: a pushed screen leaves the one below mounted, popping
  returns to that same instance, and popping a screen off destroys it
* Handles the Android hardware back button and system back gesture
* Deep linking, tabs and drawers remain available without rearchitecting

Requires `react-native-screens` and `react-native-safe-area-context`, both of which ship native code, so
adding them requires rebuilding the dev client. Install the Expo-pinned versions.

The framework's native header is **not** used: `ScreenHeader` remains the app's header on every screen.

Because screens stay mounted while covered, two conventions apply:

* **A screen refreshes on focus**, via `useFocusEffect`, whenever it shows data a screen above it can
  change.
* **View state scoped to one screen's visit belongs in that screen's own state.** Zustand remains the
  approved choice for state that is genuinely application-wide.

See [ADR-2](../adr/2-navigation-foundation.md) for the full rationale and alternatives considered.

---

## Date Input

### DateTimePicker

`@react-native-community/datetimepicker` provides the platform's native date picker, used to enter a
custom time range for an Observation's trend charts.

Rationale:

* Each platform's own date UI, rather than a hand-built in-app calendar to maintain
* Expo-supported: installed with `npx expo install`, and its config plugin registers automatically
* Long-standing React Native Community package with wide adoption

Install the Expo-pinned version. It ships native code, so adding it requires rebuilding the dev client;
it has no web implementation, so the picker is unavailable under `expo start --web`.

---

## Deliberately Excluded

The initial version does not use:

- Backend services
- Cloud databases
- Redux
- Dependency injection frameworks
- AI/LLM integrations
- Synchronization services

These decisions may be revisited through ADRs.
