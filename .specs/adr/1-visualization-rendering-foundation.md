# ADR-1: Visualization rendering foundation

* Date: 2026-07-08

## Context

Records visualization (trend charts over time) is a long-lived, heavily-iterated feature area, not a
single spec. Factor's core product thesis (see `product.md`) is discovering relationships *between*
Observations, so this area is expected to grow well beyond a single chart: multiple chart types per
`MetricValueType` (Numeric, Boolean, Enum, Text), time-range selection, per-metric visibility toggles,
tap-to-detail, and eventually cross-Observation overlay/comparison.

Feature specs in this area will ship as small, lean vertical slices, consistent with existing practice
(see `.specs/features/`). The rendering foundation, however, is a single upfront choice all of those
slices depend on — reversing it later would mean rewriting every chart built on top of it. It should be
decided once, before the first slice, rather than revisited per spec.

`tech-stack.md` currently lists "Charting and visualization libraries" under Deliberately Excluded,
noting the decision may be revisited through an ADR. This is that ADR.

## Alternatives

1. **Hand-rolled `react-native-svg` + `d3-shape`/`d3-scale`.** Full control, no extra native
   dependency. Requires building gesture-driven pan/zoom/scrub, hit-testing, and redraw performance from
   scratch — significant, ongoing engineering cost given how much iteration this area is expected to see.
2. **A monolithic RN charting library** (e.g. `react-native-gifted-charts`, `react-native-svg-charts`).
   Fastest initial velocity via ready-made line/bar/pie components. Poor fit for this domain's
   non-numeric chart types (Boolean ticks, Enum swimlanes, Text markers) and for future cross-Observation
   overlay — both would require fighting or forking the library's fixed API.
3. **Skia-based composable primitives** (`@shopify/react-native-skia`, optionally scaffolded via
   Victory Native XL). Canvas-level primitives with built-in gesture and animation handling; chart types
   are composed rather than picked from a fixed set.

## Decision

Adopt `@shopify/react-native-skia` as the rendering foundation for all Records visualization.

Confirmed compatible with the current stack (Expo ~54, React Native 0.81, new architecture default) —
no upgrade required.

Alongside the rendering choice, structure the feature around three seams so future vertical slices are
additive rather than rearchitecting:

* **Data-shaping decoupled from rendering** — a pure function `(records, metric, timeRange, aggregation)
  -> {x, y, recordId}[]`, keyed by metric rather than implicitly scoped to "the current Observation," so
  a future cross-Observation overlay is a composition of two calls rather than a new subsystem.
* **A per-`MetricValueType` renderer strategy** (line / tick / swimlane / marker), sharing one x-scale,
  one gesture controller, and one hit-test path to the existing record-detail view.
* **Shared time-range/view state** in a single Zustand store, rather than per-chart-card state.

## Trade-offs

Benefits:

* Composable primitives match the expected long tail of customization better than a fixed-API library.
* Modern, actively maintained, low abandonment risk; already the de facto standard for custom drawing
  in React Native.
* Same foundation supports non-numeric chart types and future cross-Observation overlay without a
  rewrite.

Costs:

* Adds a native dependency, which cuts against the "minimal operational complexity" principle in
  `tech-stack.md` — accepted here because it's a well-supported, Expo-compatible dependency, not a
  bespoke native module.
* No ready-made "LineChart" component — every chart type is written by hand against Skia primitives,
  which is more upfront code than a monolithic library would give for the first slice.
* Steeper learning curve for Skia's Canvas/Path API than in plain SVG.

## Consequences

* Expo Go can no longer be used for development or QA — `@shopify/react-native-skia` requires native
  code, so the project moves to Expo custom development builds (`expo prebuild` / EAS Build / a dev
  client) for anyone working on or testing this area.
* Native builds are required on both platforms going forward; CI and local build times increase
  accordingly, and iOS/Android build toolchains (Xcode, Android SDK) become a hard requirement rather
  than optional.
* App binary size increases due to the bundled Skia native binaries.
* Unit tests touching chart components need a mock for `@shopify/react-native-skia` under Vitest, since
  its native bindings don't run in a Node test environment.
