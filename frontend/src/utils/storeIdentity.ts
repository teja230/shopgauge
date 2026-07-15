export interface StoreIdentity {
  domain: string;
  name: string;
  initial: string;
}

export const getStoreIdentity = (storeDomain: string): StoreIdentity => {
  const domain = storeDomain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  const name = domain.replace(/\.myshopify\.com$/i, '') || domain;

  return {
    domain,
    name,
    initial: name.charAt(0).toUpperCase() || 'S',
  };
};
