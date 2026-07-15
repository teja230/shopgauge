import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithAuth } from '../index';

describe('fetchWithAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves a successful JSON response body available to the caller', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ enabled: true, configured: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await fetchWithAuth('/api/competitors/discovery/config');

    await expect(response.json()).resolves.toEqual({
      enabled: true,
      configured: true,
    });
  });

  it('still exposes an API error message for unsuccessful JSON responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Discovery unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      fetchWithAuth('/api/competitors/discovery/config'),
    ).rejects.toThrow('Discovery unavailable');
  });
});
