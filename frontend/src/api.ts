import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
console.log('API: Using API URL:', API_BASE_URL);

// Global service error handler - will be set by the service status context
let globalServiceErrorHandler: ((error: any) => boolean) | null = null;

export const setGlobalServiceErrorHandler = (handler: (error: any) => boolean) => {
  globalServiceErrorHandler = handler;
};

const defaultOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
};

export const api = axios.create({
  baseURL: API_BASE_URL,
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
    
    // Check if this is a 502 or service unavailable error
    const is502Error = 
      error?.response?.status === 502 ||
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'NETWORK_ERROR' ||
      error?.message?.includes('502') ||
      error?.message?.includes('Bad Gateway') ||
      error?.message?.includes('Service Unavailable') ||
      (error?.response?.status >= 500 && error?.response?.status < 600);

    if (is502Error && globalServiceErrorHandler) {
      const handled = globalServiceErrorHandler(error);
      if (handled) {
        // Don't reject the promise if the error was handled by redirecting to 502 page
        return Promise.resolve({ data: null, status: 502, handled: true });
      }
    }
    
    return Promise.reject(error);
  }
);

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const fullUrl = `${API_BASE_URL}${url}`;
  console.log('API: Fetching:', fullUrl);
  
  try {
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
    
    // Handle 502 Bad Gateway or other 5xx errors
    if (response.status === 502 || (response.status >= 500 && response.status < 600)) {
      console.log('API: Service unavailable response detected:', response.status);
      const error = new Error(`Service Unavailable (${response.status})`);
      (error as any).status = response.status;
      (error as any).response = { status: response.status };
      
      // Let the global error handler deal with this
      if (globalServiceErrorHandler) {
        const handled = globalServiceErrorHandler(error);
        if (handled) {
          // Return a special response to indicate the error was handled
          return new Response(JSON.stringify({ handled: true }), { 
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      throw error;
    }
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      console.log('API: Unauthorized response detected');
      throw new Error('Authentication required');
    }
    
  return response;
  } catch (error: any) {
    console.error('API: Request failed for', fullUrl, ':', error);
    
    // Check if it's a network error that might indicate service unavailability
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.log('API: Network error detected, might be service unavailable');
      const networkError = new Error('Service Unavailable (Network Error)');
      (networkError as any).status = 502;
      (networkError as any).code = 'NETWORK_ERROR';
      
      if (globalServiceErrorHandler) {
        const handled = globalServiceErrorHandler(networkError);
        if (handled) {
          // Return a special response to indicate the error was handled
          return new Response(JSON.stringify({ handled: true }), { 
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
    
    throw error;
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
  name: string;
  website: string;
  status: 'active' | 'inactive';
  lastChecked: string;
  metrics?: {
    revenue?: number;
    products?: number;
    traffic?: number;
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      console.log('API: Unauthorized, clearing auth state');
      // Clear any stale auth state with proper domain
      const isProduction = window.location.hostname.includes('shopgaugeai.com');
      const domainAttribute = isProduction ? '; domain=.shopgaugeai.com' : '';
      document.cookie = `shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT${domainAttribute};`;
      throw new Error('Authentication required');
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
  const res = await fetch(`${API_BASE_URL}/api/insights`, defaultOptions);
  return handleResponse<Insight>(res);
}

export async function getCompetitors(): Promise<Competitor[]> {
  const res = await fetch(`${API_BASE_URL}/api/competitors`, defaultOptions);
  return handleResponse<Competitor[]>(res);
}

export async function addCompetitor(url: string, productId: string): Promise<Competitor> {
  const res = await fetch(`${API_BASE_URL}/api/competitors`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ url, productId }),
  });
  return handleResponse<Competitor>(res);
}

export async function deleteCompetitor(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/competitors/${id}`, {
    ...defaultOptions,
    method: 'DELETE',
  });
  return handleResponse<void>(res);
}

// New competitor suggestion interfaces and functions
export interface CompetitorSuggestion {
  id: number;
  suggestedUrl: string;
  title: string;
  price: number;
  source: string;
  discoveredAt: string;
  status: string;
}

export interface SuggestionResponse {
  content: CompetitorSuggestion[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export async function getCompetitorSuggestions(page: number = 0, size: number = 10, status: string = 'NEW'): Promise<SuggestionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/competitors/suggestions?page=${page}&size=${size}&status=${status}`, defaultOptions);
  return handleResponse<SuggestionResponse>(res);
}

export async function getSuggestionCount(): Promise<{ newSuggestions: number }> {
  const res = await fetch(`${API_BASE_URL}/api/competitors/suggestions/count`, defaultOptions);
  return handleResponse<{ newSuggestions: number }>(res);
}

// Manual refresh endpoint for forcing fresh data
export async function refreshSuggestionCount(): Promise<{ newSuggestions: number }> {
  const res = await fetch(`${API_BASE_URL}/api/competitors/suggestions/refresh-count`, {
    ...defaultOptions,
    method: 'POST',
  });
  return handleResponse<{ newSuggestions: number }>(res);
}

// Debounced version of getSuggestionCount
let countDebounceTimer: NodeJS.Timeout | null = null;
export function getDebouncedSuggestionCount(): Promise<{ newSuggestions: number }> {
  return new Promise((resolve, reject) => {
    if (countDebounceTimer) {
      clearTimeout(countDebounceTimer);
    }
    
    countDebounceTimer = setTimeout(async () => {
      try {
        const result = await getSuggestionCount();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }, 300); // 300ms debounce
  });
}

export async function approveSuggestion(id: number): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/competitors/suggestions/${id}/approve`, {
    ...defaultOptions,
    method: 'POST',
  });
  return handleResponse<{ message: string }>(res);
}

export async function ignoreSuggestion(id: number): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/competitors/suggestions/${id}/ignore`, {
    ...defaultOptions,
    method: 'POST',
  });
  return handleResponse<{ message: string }>(res);
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
    if (error instanceof Error && error.message === 'Authentication required') {
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