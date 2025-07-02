import axios from 'axios';

// Enterprise-grade: never hard-code hostnames. Prefer environment config and, in dev, fallback to relative API proxy.
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
) || 'https://api.shopgaugeai.com'; // Production fallback

if (!import.meta.env.VITE_API_BASE_URL) {
  // Warn during development so engineers remember to configure the variable in production builds
  // but avoid leaking details or crashing the app.
  // eslint-disable-next-line no-console
  console.warn(
    'VITE_API_BASE_URL is not defined – using relative URLs for API calls. ' +
    'Ensure this variable is set in production (e.g., https://api.shopgaugeai.com)'
  );
}

console.log('API: Using API URL:', API_BASE_URL);

// Global service error handler - will be set by the service status context
let globalServiceErrorHandler: ((error: any) => boolean) | null = null;

export const setGlobalServiceErrorHandler = (handler: (error: any) => boolean) => {
  globalServiceErrorHandler = handler;
};

// Authentication state for API calls
let isApiAuthenticated = false;
let currentShop: string | null = null;

export const setApiAuthState = (authenticated: boolean, shop: string | null) => {
  isApiAuthenticated = authenticated;
  currentShop = shop;
  console.log('API: Updated auth state - authenticated:', authenticated, 'shop:', shop);
};

export const getApiAuthState = () => ({
  isAuthenticated: isApiAuthenticated,
  shop: currentShop
});

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

// Enhanced fetchWithAuth with authentication pre-checks
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const fullUrl = `${API_BASE_URL}${url}`;
  console.log('API: Fetching:', fullUrl);
  
  // Pre-flight authentication check
  if (!isApiAuthenticated || !currentShop) {
    console.warn('API: Attempting request without authentication - url:', url);
    // Don't throw immediately, let the server respond with 401 if needed
  }
  
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
          // Mark the error as handled to prevent notifications
          (error as any).handled = true;
          (error as any).preventNotification = true;
          
          // Don't throw the error - return a special response instead
          console.log('API: Service error handled by global handler, not throwing');
          return new Response(JSON.stringify({ 
            handled: true,
            message: 'Service temporarily unavailable'
          }), { 
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      throw error;
    }
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      console.log('API: Unauthorized response detected - updating auth state');
      setApiAuthState(false, null);
      
      // Trigger a global authentication state reset
      if (globalServiceErrorHandler) {
        const authError = new Error('Authentication required');
        (authError as any).status = 401;
        (authError as any).response = { status: 401 };
        (authError as any).authenticationError = true;
        
        const handled = globalServiceErrorHandler(authError);
        if (handled) {
          return new Response(JSON.stringify({ 
            error: 'Authentication required',
            authenticationError: true,
            redirectToLogin: true
          }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      throw new Error('Authentication required');
    }

    // Generic non-OK status handler (after specific cases above)
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`);
      (err as any).status = response.status;
      throw err;
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
          // Mark the error as handled to prevent notifications
          (networkError as any).handled = true;
          (networkError as any).preventNotification = true;
          
          // Don't throw the error - return a special response instead
          console.log('API: Network error handled by global handler, not throwing');
          return new Response(JSON.stringify({ 
            handled: true,
            message: 'Service temporarily unavailable'
          }), { 
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
    
    throw error;
  }
};

// Retry utility with exponential backoff
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        console.log(`API: Retry succeeded on attempt ${attempt + 1}`);
      }
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Don't retry authentication errors, handled service errors, or errors that shouldn't show notifications
      if (error.message === 'Authentication required' || 
          error.status === 401 ||
          (error as any).handled ||
          (error as any).preventNotification) {
        console.log('API: Not retrying - error is authentication, handled, or should not show notifications');
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`API: Retry attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`API: All ${maxRetries + 1} attempts failed`);
  throw lastError;
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
  label: string;
  price: number;
  inStock: boolean;
  percentDiff: number;
  lastChecked: string;
}

// Enhanced error handling to prevent raw JSON errors
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Check if this is a special response indicating the error was handled
    try {
      const responseData = await response.json();
      if (responseData.handled) {
        console.log('API: Error was handled by global service error handler, throwing appropriate error');
        // Don't return empty objects - throw an appropriate error that components can handle
        const error = new Error(responseData.message || 'Service temporarily unavailable');
        (error as any).handled = true;
        (error as any).preventNotification = true;
        (error as any).status = response.status;
        throw error;
      }
    } catch (parseError) {
      // If we can't parse the response, continue with normal error handling
      console.log('API: Could not parse special response, continuing with normal error handling');
    }
    
    if (response.status === 401) {
      console.log('API: Unauthorized, updating auth state and clearing cookies');
      setApiAuthState(false, null);
      // Clear any stale auth state with proper domain
      const isProduction = window.location.hostname.includes('shopgaugeai.com');
      const domainAttribute = isProduction ? '; domain=.shopgaugeai.com' : '';
      document.cookie = `shop=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT${domainAttribute};`;
      throw new Error('Authentication required');
    }
    
    // Try to parse as JSON first, fallback to text
    let errorData: any;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        const textError = await response.text();
        errorData = { message: textError };
      }
    } catch (parseError) {
      // If parsing fails, create a generic error
      errorData = { message: `Server error (${response.status})` };
    }
    
    // Enhanced error object with proper structure
    const apiError = new Error(errorData.message || `Request failed with status ${response.status}`);
    (apiError as any).response = {
      status: response.status,
      data: errorData
    };
    (apiError as any).status = response.status;
    
    console.error('API: Error response:', response.status, errorData);
    throw apiError;
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

// Get products from dashboard cache or API
async function getProductsIntelligently(): Promise<any[]> {
  // First, try to get products from dashboard cache
  const dashboardCache = sessionStorage.getItem('dashboard_cache_v2');
  if (dashboardCache) {
    try {
      const cache = JSON.parse(dashboardCache);
      if (cache.products && cache.products.data && Array.isArray(cache.products.data.products)) {
        const age = Date.now() - cache.products.timestamp;
        // Use cache if less than 30 minutes old
        if (age < 30 * 60 * 1000) {
          console.log('Using products from dashboard cache');
          return cache.products.data.products;
        }
      }
    } catch (error) {
      console.warn('Failed to parse dashboard cache:', error);
    }
  }
  
  // If no cache, try to fetch products directly
  try {
    console.log('Fetching products from API for competitor addition');
    const response = await fetch(`${API_BASE_URL}/api/analytics/products`, defaultOptions);
    const data = await handleResponse<{ products: any[] }>(response);
    return data.products || [];
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return [];
  }
}

// Intelligent competitor addition with automatic product syncing
export async function addCompetitorIntelligent(url: string, productId?: string): Promise<Competitor> {
  try {
    // If no productId provided, try to get products and use the first one
    let finalProductId = productId;
    
    if (!finalProductId) {
      console.log('No productId provided, attempting to get products intelligently...');
      const products = await getProductsIntelligently();
      
      if (products.length > 0) {
        finalProductId = products[0].id?.toString();
        console.log('Using first available product:', finalProductId);
      }
    }
    
    // Attempt to add competitor
  const res = await fetch(`${API_BASE_URL}/api/competitors`, {
    ...defaultOptions,
    method: 'POST',
      body: JSON.stringify({ url, productId: finalProductId }),
  });
    
  return handleResponse<Competitor>(res);
  } catch (error: any) {
    // Enhanced error handling to prevent raw JSON display
    console.error('addCompetitorIntelligent error:', error);
    
    // Check for specific error types and provide user-friendly messages
    if (error.response?.status === 412 || error.response?.data?.error === 'PRODUCTS_SYNC_NEEDED') {
      // Don't throw an error that would trigger redirects - just return a user-friendly error
      const userError = new Error('Please visit your Dashboard first to sync your product catalog, then try adding competitors again.');
      (userError as any).userFriendly = true;
      (userError as any).needsProductSync = true;
      throw userError;
    }
    
    if (error.response?.status === 400) {
      const errorMessage = error.response?.data?.message || error.message;
      if (errorMessage.includes('already being tracked')) {
        throw new Error('This competitor is already being tracked for your products.');
      }
      throw new Error(errorMessage || 'Invalid competitor URL. Please check the URL and try again.');
    }
    
    if (error.response?.status === 401) {
      throw new Error('Authentication required. Please log in again.');
    }
    
    if (error.response?.status >= 500) {
      throw new Error('Service temporarily unavailable. Please try again in a few moments.');
    }
    
    // Generic fallback for any other errors
    const fallbackMessage = error.response?.data?.message || error.message || 'Failed to add competitor. Please try again.';
    throw new Error(fallbackMessage);
  }
}

// Keep the original function for backward compatibility
export async function addCompetitor(url: string, productId: string): Promise<Competitor> {
  return addCompetitorIntelligent(url, productId);
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

// Helper function to check if error is an abort error
const isAbortError = (error: any): boolean => {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
};

// Enhanced authentication state management with better error handling
let authCheckInProgress = false;
let lastAuthCheck = 0;
const AUTH_CHECK_COOLDOWN = 5000; // 5 seconds between auth checks

const checkAuthWithRetry = async (retries = 3): Promise<{ shop: string | null; authenticated: boolean }> => {
  const now = Date.now();
  
  // Prevent multiple simultaneous auth checks
  if (authCheckInProgress || (now - lastAuthCheck) < AUTH_CHECK_COOLDOWN) {
    console.log('Auth check already in progress or on cooldown, skipping');
    return { shop: null, authenticated: false };
  }
  
  authCheckInProgress = true;
  lastAuthCheck = now;
  
  try {
    // Use GET method explicitly to prevent HEAD requests
    const response = await fetch(`${API_BASE_URL}/api/auth/shopify/me`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      cache: 'no-cache', // Ensure fresh auth checks
    });

    if (response.ok) {
      const data = await response.json();
      if (data.shop && data.authenticated) {
        console.log('Authentication check successful:', data.shop);
        return { shop: data.shop, authenticated: true };
      }
    }
    
    if (response.status === 401) {
      console.log('Authentication required - user not logged in');
      return { shop: null, authenticated: false };
    }
    
    if (response.status === 404) {
      console.warn('Auth endpoint not found - possible deployment issue');
      return { shop: null, authenticated: false };
    }
    
    throw new Error(`Auth check failed with status: ${response.status}`);
    
  } catch (error) {
    console.warn(`Auth check attempt failed:`, error);
    
    if (retries > 0 && !isAbortError(error)) {
      console.log(`Retrying auth check, ${retries} attempts remaining`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return checkAuthWithRetry(retries - 1);
    }
    
    return { shop: null, authenticated: false };
  } finally {
    authCheckInProgress = false;
  }
};

export const getAuthShop = async () => {
  try {
    return await checkAuthWithRetry();
  } catch (error) {
    console.error('Failed to get auth shop:', error);
    return { shop: null, authenticated: false };
  }
};

export const logoutShop = async () => {
  try {
    await api.post('/api/auth/shopify/profile/disconnect');
  } catch (error) {
    console.error('Error logging out:', error);
  }
};

// Profile and privacy-related API functions
export const getStoreStats = async () => {
  const response = await fetchWithAuth('/api/analytics/store-stats');
  return handleResponse<any>(response);
};

export const forceDisconnectShop = async (shop: string) => {
  const response = await fetchWithAuth('/auth/shopify/profile/force-disconnect', {
    method: 'POST',
    body: JSON.stringify({ shop }),
  });
  return handleResponse<any>(response);
};

export const exportData = async () => {
  const response = await fetchWithAuth('/api/analytics/privacy/data-export');
  return response; // Return raw response for blob handling
};

export const deleteData = async (customerId: string) => {
  const response = await fetchWithAuth('/api/analytics/privacy/data-deletion', {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId }),
  });
  return handleResponse<any>(response);
};

export const getPrivacyReport = async () => {
  const response = await fetchWithAuth('/api/analytics/privacy/compliance-report');
  return handleResponse<any>(response);
};

export default api; 