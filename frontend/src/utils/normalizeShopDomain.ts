export function normalizeShopDomain(input: string): string | null {
  if (!input) return null;

  // Trim whitespace and convert to lowercase
  let domain = input.trim().toLowerCase();

  // Remove protocol and common sub-domain prefixes
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');

  // Strip everything after the first forward-slash (path/query fragments are not allowed)
  const slashIndex = domain.indexOf('/');
  if (slashIndex !== -1) {
    domain = domain.substring(0, slashIndex);
  }

  // Early exit if nothing left
  if (!domain) return null;

  // If the user already included the full Shopify domain
  if (domain.endsWith('.myshopify.com')) {
    const storeName = domain.replace('.myshopify.com', '');
    // Validate store name part only contains allowed characters
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(storeName)) {
      return null;
    }
    return `${storeName}.myshopify.com`;
  }

  // Otherwise the user entered only the store name, validate it
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(domain)) {
    return null;
  }

  return `${domain}.myshopify.com`;
} 