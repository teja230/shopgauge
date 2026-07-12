/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      include: [
        'src/components/PricingValidationCard.tsx',
        'src/context/AdminNavigationContext.tsx',
        'src/hooks/useKeyboardNavigation.ts',
        'src/services/questionIntent.ts',
        'src/utils/dateUtils.ts',
        'src/utils/deviceUtils.ts',
        'src/utils/dimensionUtils.ts',
        'src/utils/normalizeShopDomain.ts',
        'src/utils/routeChrome.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        'src/**/__tests__/**',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
