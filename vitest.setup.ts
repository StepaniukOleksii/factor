import {vi} from 'vitest';

// Skia's native bindings can't load under Node (see ADR-1), so route every
// import of `@shopify/react-native-skia` to the stub in `__mocks__/`. Applied
// globally here so any chart component pulled into a test stays in pure JS.
vi.mock('@shopify/react-native-skia');
