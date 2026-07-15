import { describe, expect, it } from 'vitest';
import { getStoreIdentity } from '../storeIdentity';

describe('getStoreIdentity', () => {
  it('uses the readable shop name while preserving the full Shopify domain', () => {
    expect(getStoreIdentity('https://storesight.myshopify.com/admin')).toEqual({
      domain: 'storesight.myshopify.com',
      name: 'storesight',
      initial: 'S',
    });
  });

  it('keeps non-Shopify fallback labels readable', () => {
    expect(getStoreIdentity('Connected store')).toEqual({
      domain: 'Connected store',
      name: 'Connected store',
      initial: 'C',
    });
  });
});
