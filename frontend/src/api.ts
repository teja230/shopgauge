import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
console.log('API: Using API URL:', API_BASE_URL);

const defaultOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
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
    return Promise.reject(error);
  }
);

// Simple function to handle global auth errors without notifications
// Let AuthContext handle the user notifications
const handleGlobalAuthError = () => {
  // Check if we're in a Shopify OAuth flow - don't handle as session expired
  const urlParams = new URLSearchParams(window.location.search);
  const shopFromUrl = urlParams.get('shop');
  
  if (shopFromUrl) {
    console.log('API: 401 during OAuth flow, not treating as session expired');
    return;
  }
  
  console.log('API: Handling global auth error - clearing cookies');
  
  // Clear auth cookies
  document.cookie = 'shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  document.cookie = 'SESSION=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};

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
    
    // Handle 401 Unauthorized globally
    if (response.status === 401) {
      console.log('API: Unauthorized response detected, handling globally');
      
      // Try to refresh authentication before failing
      try {
        console.log('API: Attempting to refresh authentication...');
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/shopify/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          console.log('API: Authentication refresh successful:', refreshData);
          
          // Retry the original request
          console.log('API: Retrying original request after refresh...');
          const retryResponse = await fetch(fullUrl, {
            ...options,
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...options.headers,
            },
          });
          
          if (retryResponse.ok) {
            console.log('API: Retry successful after auth refresh');
            return retryResponse;
          } else {
            console.log('API: Retry failed even after auth refresh');
          }
        } else {
          console.log('API: Authentication refresh failed');
        }
      } catch (refreshError) {
        console.error('API: Auth refresh error:', refreshError);
      }
      
      // If refresh didn't work, proceed with original error handling
      handleGlobalAuthError();
      throw new Error('Authentication required');
    }
    
    return response;
  } catch (error) {
    console.error('API: Request failed for', fullUrl, ':', error);
    
    // Handle network errors that might be auth-related
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('API: Network error, might be auth-related');
      // Don't trigger global auth error for network issues
    }
    
    throw error;
  }
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      console.log('API: Unauthorized, clearing auth state');
      // Clear any stale auth state
      document.cookie = 'shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
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