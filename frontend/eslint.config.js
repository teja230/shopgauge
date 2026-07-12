import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      parser: tsParser,
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Context and diagnostics modules intentionally co-locate hooks/helpers
      // with their providers. This development-only Fast Refresh constraint
      // does not affect runtime correctness.
      'react-refresh/only-export-components': 'off',
      // TypeScript performs identifier resolution. The base rules misclassify
      // type-only names such as RequestInit and NodeJS as runtime globals.
      'no-unused-vars': 'off',
      'no-undef': 'off',
      // Large UI modules still contain staged component variants. TypeScript
      // build validation remains authoritative until those modules are split.
      '@typescript-eslint/no-unused-vars': 'off',
      // The legacy dashboard contains deliberately event-triggered effects.
      // Keep rules-of-hooks enforcement, but do not apply dependency autofixes
      // that can turn those effects into render loops.
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      parser: tsParser,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
