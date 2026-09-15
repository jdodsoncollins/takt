import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'src/domain/**/*.ts',
        'src/services/auth/**/*.ts',
        'src/services/ai/**/*.ts',
      ],
      thresholds: {
        lines: 55,
        statements: 55,
        functions: 50,
        branches: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/domain': path.resolve(__dirname, 'src/domain'),
      '@/services': path.resolve(__dirname, 'src/services'),
      '@/features': path.resolve(__dirname, 'src/features'),
      '@/design-system': path.resolve(__dirname, 'src/design-system'),
      '@/support': path.resolve(__dirname, 'src/support'),
    },
  },
});
