import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
console.log('API: Using API URL:', API_URL);

const defaultOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

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

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Add axios interceptor for logging
api.interceptors.request.use(request => {
  console.log('API: Starting Request:', request.method?.toUpperCase(), request.url);
  return request;
});

api.interceptors.response.use(
  response => {
    console.log('API: Response:', response.status, response.config.url);
    return response;
  },
  error => {
    console.error('API: Error:', error.response?.status, error.config?.url, error.message);
    return Promise.reject(error);
  }
);

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const fullUrl = `${API_URL}${url}`;
  console.log('API: Fetching:', fullUrl);
  const response = await fetch(fullUrl, {
    ...options,
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  console.log('API: Response status:', response.status, fullUrl);
  return response;
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      console.log('API: Unauthorized, clearing auth state');
      // Clear any stale auth state
      document.cookie = 'shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      throw new Error('Please log in to continue');
    }
    const error = await response.text();
    console.error('API: Error response:', response.status, error);
    throw new Error(error || 'Request failed');
  }
  const data = await response.json();
  console.log('API: Success response:', response.status, data);
  return data;
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

export const getAuthShop = async () => {
  try {
    console.log('API: Fetching auth shop');
    const response = await fetchWithAuth('/api/auth/shopify/me');
    const data = await handleResponse<{ shop: string }>(response);
    console.log('API: Got auth shop:', data.shop);
    return data.shop;
  } catch (error) {
    console.error('API: Error getting auth shop:', error);
    if (error instanceof Error && error.message === 'Please log in to continue') {
      return null;
    }
    throw error;
  }
};

export const logoutShop = async () => {
  try {
    await api.post('/api/auth/shopify/profile/disconnect');
  } catch (error) {
    console.error('Error logging out:', error);
  }
};

export default api; 