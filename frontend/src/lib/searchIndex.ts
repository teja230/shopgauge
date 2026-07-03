export interface SearchItem {
  name: string;
  keywords?: string;
  action: string; // route path or special action key
}

// You can extend this list with dynamic entities (shops, settings, etc.) by reading from API at runtime.
export const searchIndex: SearchItem[] = [
  { name: 'Home', keywords: 'home landing start', action: '/' },
  { name: 'Dashboard', keywords: 'dashboard analytics revenue orders overview', action: '/dashboard' },
  { name: 'Market Intelligence', keywords: 'competitor competitors discovery prices market', action: '/competitors' },
  { name: 'ShopGPT', keywords: 'ai assistant chat insights business intelligence shopgpt', action: '/business-intelligence' },
  { name: 'Profile & Settings', keywords: 'profile user settings store connection privacy', action: '/profile' },
  { name: 'Admin', keywords: 'admin audit logs health', action: '/admin' },
  { name: 'Privacy Policy', keywords: 'privacy legal policy', action: '/privacy-policy' },
  { name: 'Logout', keywords: 'logout sign out', action: '!logout' },
];
