import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { normalizeShopDomain } from '../utils/normalizeShopDomain';
import { detectQuestionIntent, type QuestionIntent } from '../services/questionIntent';
import {
  getCurrentDeviceInfo,
  getDeviceDescription,
  getDeviceDisplay,
  getLocationFromIP,
  getRelativeTime as getDeviceRelativeTime,
  isCurrentDevice,
  parseUserAgent,
} from '../utils/deviceUtils';
import { isAppShellPath } from '../utils/routeChrome';
import {
  ensureMinHeight,
  ensureMinWidth,
  getElementDimension,
  getElementDimensions,
} from '../utils/dimensionUtils';
import {
  formatDate,
  formatDateShort,
  formatDateTime,
  getRelativeTime,
  isValidDate,
} from '../utils/dateUtils';

describe('Shopify domain normalization matrix', () => {
  const bareStores = Array.from({ length: 100 }, (_, index) => `merchant-${index}`);

  it.each(bareStores)('normalizes bare store name %s', (store) => {
    expect(normalizeShopDomain(store)).toBe(`${store}.myshopify.com`);
  });

  const urlStores = Array.from({ length: 25 }, (_, index) => `brand-${index}`).flatMap(
    (store) => [
      [`https://${store}.myshopify.com`, `${store}.myshopify.com`],
      [`http://${store}.myshopify.com/products/widget`, `${store}.myshopify.com`],
      [`https://www.${store}.myshopify.com/admin`, `${store}.myshopify.com`],
      [`  ${store}.MYSHOPIFY.COM  `, `${store}.myshopify.com`],
    ] as const[],
  );

  it.each(urlStores)('normalizes URL variant %s', (input, expected) => {
    expect(normalizeShopDomain(input)).toBe(expected);
  });

  const invalidStores = Array.from({ length: 25 }, (_, index) => [
    `-merchant${index}`,
    `merchant${index}-`,
    `merchant_${index}`,
    `merchant.${index}`,
  ]).flat();

  it.each(invalidStores)('rejects invalid store identifier %s', (input) => {
    expect(normalizeShopDomain(input)).toBeNull();
  });

  it.each(['', '   ', '/', 'https://', 'https://www./path'])(
    'rejects empty normalized domain %s',
    (input) => {
      expect(normalizeShopDomain(input)).toBeNull();
    },
  );
});

describe('merchant question intent matrix', () => {
  const intentTerms: Record<Exclude<QuestionIntent, 'summary'>, string[]> = {
    costs: [
      'cost', 'costs', 'budget', 'spend', 'spending', 'expense', 'expenses', 'roi',
      'subscription', 'monitoring cost', 'monitoring budget', 'monthly budget',
      'tool expense', 'annual costs', 'provider spend', 'scraping budget',
      'monitoring expense', 'subscription cost', 'current roi', 'total spending',
    ],
    competitors: [
      'competitor', 'competitors', 'competition', 'competitive', 'rival', 'rivals',
      'versus', 'vs', 'compare', 'comparison', 'overpriced', 'underpriced',
      'undercut', 'cheaper than', 'price gap', 'price difference', 'market position',
      'market share', 'market price', 'market pricing', 'pricing strategy',
      'who is out of stock', "who's out of stock", 'out of stock', 'current price',
    ],
    revenue: [
      'revenue', 'sales', 'sell', 'selling', 'earning', 'earnings', 'income', 'trend',
      'trends', 'trending', 'growth', 'growing', 'performance', 'performing',
      'revenue growth', 'sales trend', 'income trend', 'store performance',
      'earnings growth', 'selling performance',
    ],
    products: [
      'product', 'products', 'inventory', 'stock', 'restock', 'catalog', 'bestseller',
      'bestsellers', 'item', 'items', 'sku', 'skus', 'product catalog',
      'inventory item', 'restock catalog',
    ],
    orders: [
      'order', 'orders', 'cart', 'carts', 'checkout', 'conversion', 'abandoned',
      'abandonment', 'fulfillment', 'customer', 'customers', 'abandoned carts',
      'checkout conversion', 'order fulfillment', 'customer conversion',
    ],
    recommendations: [
      'recommend', 'recommendation', 'recommendations', 'should I', 'advice',
      'suggest', 'suggestion', 'suggestions', 'focus next', 'next step', 'next steps',
      'what to do', 'how do I proceed', 'how can I proceed', 'optimize everything',
    ],
  };

  const cases = Object.entries(intentTerms).flatMap(([intent, terms]) =>
    terms.map((term) => [intent as QuestionIntent, `Please explain ${term} for my store`] as const),
  );

  it.each(cases)('classifies %s intent: %s', (expected, question) => {
    expect(detectQuestionIntent(question).intent).toBe(expected);
  });

  const neutralQuestions = Array.from(
    { length: 20 },
    (_, index) => `Give me a general store overview number ${index}`,
  );

  it.each(neutralQuestions)('falls back to summary: %s', (question) => {
    expect(detectQuestionIntent(question).intent).toBe('summary');
  });
});

describe('browser and device parsing matrix', () => {
  const desktopCases = Array.from({ length: 20 }, (_, offset) => offset + 100).flatMap(
    (version) => [
      [`Mozilla/5.0 (Windows NT 10.0) Chrome/${version}.0.0.0 Safari/537.36`, 'Chrome', 'Windows', 'Windows PC', `${version}`],
      [`Mozilla/5.0 (X11; Linux x86_64) Firefox/${version}.0`, 'Firefox', 'Linux', 'Linux PC', `${version}`],
      [`Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) Version/${version}.0 Safari/605.1.15`, 'Safari', 'macOS', 'Mac', `${version}`],
      [`Mozilla/5.0 (Windows NT 10.0) Chrome/${version}.0 Edg/${version}.0`, 'Edge', 'Windows', 'Windows PC', `${version}`],
      [`Mozilla/5.0 (Windows NT 10.0) OPR/${version}.0`, 'Opera', 'Windows', 'Windows PC', `${version}`],
    ] as const[],
  );

  it.each(desktopCases)(
    'parses desktop UA %# as %s on %s',
    (userAgent, browser, os, device, version) => {
      const result = parseUserAgent(userAgent);
      expect(result).toMatchObject({
        browser,
        browserVersion: version,
        os,
        device,
        isDesktop: true,
        isMobile: false,
      });
    },
  );

  const mobileCases = Array.from({ length: 20 }, (_, offset) => offset + 15).flatMap(
    (version) => [
      [`Mozilla/5.0 (iPhone; CPU iPhone OS ${version}_0 like Mac OS X) Version/${version}.0 Mobile Safari/604.1`, 'iOS', 'iPhone', true, false],
      [`Mozilla/5.0 (Linux; Android ${version}; Pixel) Chrome/${version}.0 Mobile Safari/537.36`, 'Android', 'Android Phone', true, false],
      [`Mozilla/5.0 (iPad; CPU OS ${version}_0 like Mac OS X) Version/${version}.0 Safari/604.1`, 'iOS', 'iPad', false, true],
    ] as const[],
  );

  it.each(mobileCases)(
    'parses mobile UA %#',
    (userAgent, os, device, isMobile, isTablet) => {
      expect(parseUserAgent(userAgent)).toMatchObject({ os, device, isMobile, isTablet, isDesktop: false });
    },
  );
});

describe('application route matrix', () => {
  const roots = ['/dashboard', '/business-intelligence', '/competitors', '/profile'];
  const appRoutes = roots.flatMap((root) =>
    Array.from({ length: 10 }, (_, index) => (index === 0 ? root : `${root}/section-${index}`)),
  );
  const publicRoutes = Array.from({ length: 40 }, (_, index) => `/public-${index}`);

  it.each(appRoutes)('recognizes application route %s', (path) => {
    expect(isAppShellPath(path)).toBe(true);
  });

  it.each(publicRoutes)('rejects public route %s', (path) => {
    expect(isAppShellPath(path)).toBe(false);
  });
});

describe('dimension and date boundary matrix', () => {
  const dimensions = Array.from({ length: 30 }, (_, index) => index * 25 - 250);

  it.each(dimensions)('enforces minimum height for %i', (value) => {
    expect(ensureMinHeight(value)).toBe(Math.max(value, 200));
  });

  it.each(dimensions)('enforces minimum width for %i', (value) => {
    expect(ensureMinWidth(value)).toBe(Math.max(value, 200));
  });

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T12:00:00.000Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const minuteCases = Array.from({ length: 20 }, (_, index) => index + 1);
  it.each(minuteCases)('formats %i minutes ago', (minutes) => {
    const date = new Date(Date.now() - minutes * 60_000).toISOString();
    expect(getRelativeTime(date)).toBe(`${minutes} minutes ago`);
    expect(isValidDate(date)).toBe(true);
  });

  it('covers date formatting and invalid-date fallbacks', () => {
    const date = '2026-07-11T12:00:00.000Z';
    expect(formatDate(date, 'yyyy-MM-dd')).toBe('2026-07-11');
    expect(formatDateTime(date)).toContain('2026');
    expect(formatDateShort(date)).toContain('Jul');
    expect(formatDate(null)).toBe('--');
    expect(formatDate('not-a-date', 'yyyy', 'invalid')).toBe('invalid');
    expect(isValidDate(undefined)).toBe(false);
    expect(isValidDate('not-a-date')).toBe(false);
  });

  it.each([
    [0, 'Just now'],
    [2 * 60, '2 hours ago'],
    [3 * 24 * 60, '3 days ago'],
  ] as const)('formats relative offset %i minutes', (minutes, expected) => {
    const date = new Date(Date.now() - minutes * 60_000).toISOString();
    expect(getRelativeTime(date)).toBe(expected);
  });

  it('measures DOM dimensions and null fallbacks', () => {
    const element = document.createElement('div');
    Object.defineProperties(element, {
      offsetWidth: { value: 640 },
      offsetHeight: { value: 360 },
    });
    expect(getElementDimensions(element)).toEqual({ width: 640, height: 360 });
    expect(getElementDimension(null, 'width')).toBe(0);
    expect(getElementDimension(null, 'height')).toBe(0);
  });
});

describe('device presentation helpers', () => {
  const chromeWindows =
    'Mozilla/5.0 (Windows NT 10.0) Chrome/126.0.0.0 Safari/537.36';

  it('builds device descriptions and display metadata', () => {
    expect(getDeviceDescription(chromeWindows)).toBe('Windows PC • Chrome 126 • Windows');
    expect(getDeviceDisplay(chromeWindows)).toEqual({
      name: 'Windows PC',
      icon: '🖥️',
      subtitle: 'Chrome on Windows',
    });
  });

  it('recognizes private and unknown network locations', () => {
    expect(getLocationFromIP('192.168.1.2')).toBe('Local Network');
    expect(getLocationFromIP('10.0.0.2')).toBe('Local Network');
    expect(getLocationFromIP('172.16.0.2')).toBe('Local Network');
    expect(getLocationFromIP('8.8.8.8')).toBe('Unknown Location');
  });

  it('reads and compares the current browser identity', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: chromeWindows,
      configurable: true,
    });
    expect(getCurrentDeviceInfo().browser).toBe('Chrome');
    expect(isCurrentDevice(chromeWindows)).toBe(true);
    expect(isCurrentDevice('Mozilla/5.0 (X11; Linux x86_64) Firefox/126.0')).toBe(false);
  });

  it.each([
    [0, 'Just now'],
    [1, '1 minute ago'],
    [5, '5 minutes ago'],
    [60, '1 hour ago'],
    [180, '3 hours ago'],
    [1440, '1 day ago'],
    [4320, '3 days ago'],
  ] as const)('formats device activity offset %i', (minutes, expected) => {
    const date = new Date(Date.now() - minutes * 60_000).toISOString();
    expect(getDeviceRelativeTime(date)).toBe(expected);
  });
});
