import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: false,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/test/**', '**/*.test.{ts,tsx}'],
        thresholds: {
          'src/domain/math/**': {
            lines: 100,
            branches: 100,
            functions: 100,
            statements: 100,
          },
        },
      },
    },
  }),
);
