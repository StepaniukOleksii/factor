import {defineConfig} from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@presentation': path.resolve(__dirname, 'src/presentation'),
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@application': path.resolve(__dirname, 'src/application'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
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
