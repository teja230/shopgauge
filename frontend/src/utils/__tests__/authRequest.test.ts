import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '../authRequest';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns a response when the request completes before the deadline', async () => {
    const response = new Response(JSON.stringify({ authenticated: true }), { status: 200 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(fetchWithTimeout('/api/auth/shopify/me', {}, 1_000)).resolves.toBe(response);
  });

  it('aborts a request that does not complete before the deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted', 'AbortError'));
      });
    })));

    const request = fetchWithTimeout('/api/auth/shopify/me', {}, 1_000);
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1_000);

    await rejection;
  });
});
