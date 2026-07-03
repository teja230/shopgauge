const APP_SHELL_PATHS = [
  '/dashboard',
  '/business-intelligence',
  '/competitors',
  '/profile',
];

export const isAppShellPath = (pathname: string): boolean =>
  APP_SHELL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
