export interface SearchItem {
  name: string;
  keywords?: string;
  action: string; // route path or special action key
}

// You can extend this list with dynamic entities (shops, settings, etc.) by reading from API at runtime.
export const searchIndex: SearchItem[] = [
  { name: 'Dashboard', keywords: 'dashboard home analytics', action: '/dashboard' },
  { name: 'Competitors', keywords: 'competitor competitor discovery', action: '/competitors' },
  { name: 'Admin', keywords: 'admin audit logs health', action: '/admin' },
  { name: 'Profile', keywords: 'profile user settings', action: '/profile' },
  { name: 'Privacy Policy', keywords: 'privacy legal policy', action: '/privacy-policy' },
  { name: 'Logout', keywords: 'logout sign out', action: '!logout' },
]; 