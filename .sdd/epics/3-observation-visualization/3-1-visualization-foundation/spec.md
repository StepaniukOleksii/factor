# Feature Spec: Visualization Foundation

* Date: 2026-07-11

## 1. Goal
Introduce the Skia-based rendering foundation chosen in [ADR-1](../../../adr/1-visualization-rendering-foundation.md), plus the build and test tooling it requires, so subsequent Observation Visualization slices can add real charts without repeating this setup. This slice intentionally ships no visible UI or user-facing behavior change — it is a deliberate exception to vertical slicing, justified because the dependency and dev-workflow migration is substantial enough to verify on its own before any chart is built on top of it.

## 2. Requirements
* [ ] `@shopify/react-native-skia` is added as a project dependency.
* [ ] Local development moves to an Expo custom dev client (`expo prebuild` and a dev client build), since `@shopify/react-native-skia` requires native code that Expo Go cannot run.
* [ ] All existing app functionality continues to work unchanged when run via the dev client.
* [ ] A Vitest mock for `@shopify/react-native-skia` is added so the existing test suite continues to run under Node without native bindings.
* [ ] A metric data-shaping utility exists, unit-tested, that turns a Metric's Records into a chart-ready series for a given time range and aggregation strategy. It is not wired into any screen yet.
* [ ] An empty chart-renderer registry exists, keyed by `MetricValueType`, with no renderers registered yet.
* [ ] No new screens, navigation entries, or user-facing behavior are introduced.

## 3. Technical Design

### 3.1 Dependencies & Build Tooling
* Add `@shopify/react-native-skia` to `package.json`.
* Run `expo prebuild` to generate the native `ios`/`android` projects, and switch the local run workflow from Expo Go to a dev client (`expo run:ios` / `expo run:android`, or an EAS dev build for anyone without a local native toolchain).
* No app code outside this feature's own files should need to change as a result of the migration — this is verified manually (see Verification Plan).

### 3.2 Testing Infrastructure
* Add a Vitest mock for `@shopify/react-native-skia` (e.g. via `vi.mock` or a `__mocks__` module) covering the primitives later slices will use (`Canvas`, `Path`, `Skia.Path.Make`, etc.), so importing a chart component under test doesn't hit native bindings.
* Run the existing test suite against the mock to confirm no regressions.

### 3.3 Application Layer — Metric Series Utility
* New use case `GetMetricSeriesUseCase` in `src/application/`, following the existing use-case convention (`GetRecentRecordsUseCase`, `GetRecordByIdUseCase`).
  * **Input:** `records: Record[]`, `metric: Metric`, `timeRange: TimeRange`, `aggregation: AggregationStrategy`.
  * **Output:** `MetricSeriesPoint[]`, where `MetricSeriesPoint = { x: number; y: number; recordId: string }`.
  * **Behavior:** Filters `records` to those within `timeRange`, buckets them per `aggregation`, and reduces each bucket to a single point per the metric's `MetricValueType` (e.g. mean for Numeric). Only the Numeric reduction needs a real implementation in this slice — Boolean/Enum/Text reductions can throw `not implemented` until their own slices land, since nothing calls this utility with those types yet.
* New types `TimeRange` and `AggregationStrategy` co-located with the use case, not added to `src/domain/`, since they describe a query over Records rather than an intrinsic domain rule.
* Unit tests cover: Numeric mean aggregation, bucket boundaries, and empty-input behavior.

### 3.4 Chart Renderer Registry
* New module `src/presentation/charts/rendererRegistry.ts` exporting a typed, empty map from `MetricValueType` to a renderer interface (shape TBD by the slice that adds the first entry — this slice only needs the map to exist and be typed so later slices register into it rather than inventing their own lookup).

### 3.5 User Interface
* None. No new screens, components, or navigation changes.

## 4. Verification Plan

### Manual Verification
1. Run `expo prebuild`, then launch the app via the dev client on both an iOS simulator/device and an Android emulator/device.
2. Exercise the existing screens (Observation List, Observation Details, Record Creation, Record Editing, Record deletion) and confirm behavior is unchanged from the current Expo Go-based workflow.
3. Confirm the app can no longer be run through plain Expo Go (expected, per ADR-1) and that the dev client is the documented replacement.

### Automated Tests
* Unit tests for `GetMetricSeriesUseCase`: Numeric mean aggregation across buckets, correct bucketing for a representative `TimeRange`, and empty-records behavior.
* Full existing Vitest suite passes unchanged with the new `@shopify/react-native-skia` mock in place.
* A smoke test confirming `rendererRegistry` imports and initializes without error.
