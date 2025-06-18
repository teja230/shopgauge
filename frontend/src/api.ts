export interface Insight {
  conversionRate: number;
  conversionRateDelta: number;
  topSellingProducts: Array<{
    title: string;
    sales: number;
    delta: number;
  }>;
  abandonedCartCount: number;
  insightText: string;
}

export interface Competitor {
  id: string;
  url: string;
  price: number;
  inStock: boolean;
  percentDiff: number;
  lastChecked: string;
}

const defaultOptions = {
  credentials: 'include' as const,
  headers: {
    'Content-Type': 'application/json',
  },
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      // Clear any stale auth state
      document.cookie = 'shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      throw new Error('Please log in to continue');
    }
    const error = await response.text();
    throw new Error(error || 'Request failed');
  }
  return response.json();
}

export async function getInsights(): Promise<Insight> {
  const res = await fetch('/api/insights', defaultOptions);
  return handleResponse<Insight>(res);
}

export async function getCompetitors(): Promise<Competitor[]> {
  const res = await fetch('/api/competitors', defaultOptions);
  return handleResponse<Competitor[]>(res);
}

export async function addCompetitor(url: string, productId: string): Promise<Competitor> {
  const res = await fetch('/api/competitors', {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ url, productId }),
  });
  return handleResponse<Competitor>(res);
}

export async function deleteCompetitor(id: string): Promise<void> {
  const res = await fetch(`/api/competitors/${id}`, {
    ...defaultOptions,
    method: 'DELETE',
  });
  return handleResponse<void>(res);
}

export async function getAuthShop(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/shopify/me', defaultOptions);
    if (res.ok) {
      const shop = await res.text();
      return shop || null;
    }
    return null;
  } catch (error) {
    console.error('Auth check failed:', error);
    return null;
  }
}

export function logoutShop() {
  // Clear the shop cookie by setting it to expire
  document.cookie = 'shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  // Redirect to home page
  window.location.href = '/';
} 