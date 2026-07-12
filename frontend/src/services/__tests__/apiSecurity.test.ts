import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCorrelationId,
  fetchWithAuth,
  retryWithBackoff,
  setApiAuthState,
} from '../../api';

describe('API request security', () => {
  beforeEach(() => {
    clearCorrelationId();
    setApiAuthState(true, 'merchant.myshopify.com');
    document.cookie = 'XSRF-TOKEN=csrf%20token; Path=/';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/';
  });

  it('sends credentials, CSRF protection, and a correlation ID', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await fetchWithAuth('/api/competitors', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/product' }),
    });

    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(options?.credentials).toBe('include');
    expect(headers['X-XSRF-TOKEN']).toBe('csrf token');
    expect(headers['X-Correlation-ID']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('retries transient failures and returns the successful result', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue('ok');

    const resultPromise = retryWithBackoff(operation, 2, 10);
    await vi.advanceTimersByTimeAsync(10);

    await expect(resultPromise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
