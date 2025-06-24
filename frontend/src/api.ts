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

// Global auth state management
let isHandlingAuthError = false;
let authErrorCount = 0;
const MAX_AUTH_ERRORS = 3;

// Function to show session expired notification
const showSessionExpiredNotification = () => {
  // Try to use react-hot-toast if available
  const toast = (window as any).toast;
  if (toast && typeof toast.error === 'function') {
    toast.error('Your session has expired. Please sign in again.', {
      duration: 4000,
      position: 'top-center',
      style: {
        background: '#ef4444',
        color: '#ffffff',
        fontWeight: '500',
      },
    });
  } else {
    // Fallback to a custom notification div
    const existingNotification = document.getElementById('session-expired-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'session-expired-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        max-width: 400px;
        animation: slideInFromRight 0.3s ease-out;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-8h2v6h-2V9z"/>
          </svg>
          <span>Your session has expired. Redirecting to sign in...</span>
        </div>
      </div>
      <style>
        @keyframes slideInFromRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.style.animation = 'slideInFromRight 0.3s ease-out reverse';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }
    }, 3000);
  }
};

// Function to handle global auth errors with rate limiting
const handleGlobalAuthError = () => {
  // Check if we're in a Shopify OAuth flow - don't handle as session expired
  const urlParams = new URLSearchParams(window.location.search);
  const shopFromUrl = urlParams.get('shop');
  
  if (shopFromUrl) {
    console.log('API: 401 during OAuth flow, not treating as session expired');
    return;
  }
  
  authErrorCount++;
  
  // Prevent spam of auth errors
  if (isHandlingAuthError || authErrorCount > MAX_AUTH_ERRORS) {
    if (authErrorCount > MAX_AUTH_ERRORS) {
      console.log('API: Too many auth errors, temporarily ignoring');
    }
    return;
  }
  
  isHandlingAuthError = true;
  console.log('API: Handling global auth error');
  
  // Clear auth cookies
  document.cookie = 'shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  document.cookie = 'SESSION=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  
  // Show professional notification only if not on home page
  if (typeof window !== 'undefined' && window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    console.log('API: Session expired, showing notification and redirecting');
    
    // Show elegant notification
    showSessionExpiredNotification();
    
    // Redirect after a brief delay to let user see the notification
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }
  
  // Reset flags after handling
  setTimeout(() => {
    isHandlingAuthError = false;
    authErrorCount = 0; // Reset error count after cooldown
  }, 5000); // Longer cooldown to prevent loops
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