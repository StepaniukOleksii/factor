import {defineConfig} from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {find: '@presentation', replacement: path.resolve(__dirname, 'src/presentation')},
      {find: '@domain', replacement: path.resolve(__dirname, 'src/domain')},
      {find: '@application', replacement: path.resolve(__dirname, 'src/application')},
      {find: '@infrastructure', replacement: path.resolve(__dirname, 'src/infrastructure')},
      {find: '@shared', replacement: path.resolve(__dirname, 'src/shared')},
      // Metro bundles a font file as an opaque asset handle; Node would try to
      // parse it as JavaScript. Redirect every font import to a stub so charts
      // that bundle their own typeface stay importable under Vitest.
      {find: /^.+\.ttf$/, replacement: path.resolve(__dirname, '__mocks__/fontAsset.ts')},
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        // React Navigation ships ESM with extensionless relative imports, which
        // Node's own loader cannot resolve. Inlining hands these packages to
        // Vite, which resolves them the way Metro does on device - and brings
        // them under the per-test `react-native` mock, since only modules Vitest
        // processes itself go through its mock registry.
        inline: [/@react-navigation\//],
      },
    },
  },
});
