import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
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

// Global auth state management
let isHandlingAuthError = false;

// Function to handle global auth errors
const handleGlobalAuthError = () => {
  if (isHandlingAuthError) return; // Prevent multiple simultaneous auth error handling
  
  isHandlingAuthError = true;
  console.log('API: Handling global auth error');
  
  // Clear auth cookies
  document.cookie = 'shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  document.cookie = 'SESSION=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  
  // Clear any local auth state
  localStorage.removeItem('auth_state');
  sessionStorage.removeItem('auth_state');
  
  // Show user-friendly notification
  if (typeof window !== 'undefined' && window.location.pathname !== '/') {
    // Try to use toast notification if available
    const toast = (window as any).toast;
    if (toast && typeof toast.error === 'function') {
      toast.error('Session expired. Please log in again.');
    } else {
      alert('Session expired. Please log in again.');
    }
    
    // Redirect to home page after a short delay
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  }
  
  // Reset flag after handling
  setTimeout(() => {
    isHandlingAuthError = false;
  }, 2000);
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
  const res = await fetch(`/api/competitors/suggestions?page=${page}&size=${size}&status=${status}`, defaultOptions);
  return handleResponse<SuggestionResponse>(res);
}

export async function getSuggestionCount(): Promise<{ newSuggestions: number }> {
  const res = await fetch('/api/competitors/suggestions/count', defaultOptions);
  return handleResponse<{ newSuggestions: number }>(res);
}

export async function approveSuggestion(id: number): Promise<{ message: string }> {
  const res = await fetch(`/api/competitors/suggestions/${id}/approve`, {
    ...defaultOptions,
    method: 'POST',
  });
  return handleResponse<{ message: string }>(res);
}

export async function ignoreSuggestion(id: number): Promise<{ message: string }> {
  const res = await fetch(`/api/competitors/suggestions/${id}/ignore`, {
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