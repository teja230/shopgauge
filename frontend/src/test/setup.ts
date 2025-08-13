import '@testing-library/jest-dom';
import { afterEach as vitestAfterEach, vi as vitestVi } from 'vitest';
import { cleanup } from '@testing-library/react';

vitestAfterEach(() => {
  cleanup();
});

// Provide NodeJS types to satisfy references in code under test
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _NodeJS = typeof import('node');

// Alias jest -> vi for tests that still reference jest globals
// @ts-ignore
globalThis.jest = vitestVi;

// Auto-wrap RTL render with unified providers
vitestVi.mock('@testing-library/react', async () => {
  const actual = await vi.importActual<any>('@testing-library/react');
  const harness = await import('./setupTestHarness');
  const TestHarness = harness.TestHarness;
  return {
    ...actual,
    render: (ui: any, options?: any) => actual.render(ui, { wrapper: TestHarness, ...options }),
  };
});

// Minimal Network Information API stub to prevent runtime errors in tests
// https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation
Object.defineProperty(globalThis.navigator, 'connection', {
  value: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    saveData: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  configurable: true,
});
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock MutationObserver
global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock focus method
HTMLElement.prototype.focus = vi.fn();

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON: vi.fn(),
}));