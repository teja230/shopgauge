import axios from 'axios';
import { debugLog } from './components/ui/DebugPanel';

// Enterprise-grade: never hard-code hostnames. Prefer environment config and, in dev, fallback to relative API proxy.
// In development: Empty string allows Vite proxy to handle requests (configured in vite.config.ts)
// In production: VITE_API_BASE_URL should be set to the full API domain (e.g., https://api.shopgaugeai.com)
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
) || ''; // Empty string for development proxy - routes through Vite dev server proxy

if (!import.meta.env.VITE_API_BASE_URL) {
  // Warn during development so engineers remember to configure the variable in production builds
  // but avoid leaking details or crashing the app.
  // eslint-disable-next-line no-console
  console.warn(
    'VITE_API_BASE_URL is not defined – using relative URLs for development proxy. ' +
    'Set VITE_API_BASE_URL=https://api.shopgaugeai.com in production'
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

// Correlation ID management
let currentCorrelationId: string | null = null;

// Generate a new correlation ID
const generateCorrelationId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Get or generate correlation ID
const getOrGenerateCorrelationId = (): string => {
  if (!currentCorrelationId) {
    currentCorrelationId = generateCorrelationId();
  }
  return currentCorrelationId;
};

// Clear correlation ID (useful for new user sessions)
export const clearCorrelationId = (): void => {
  currentCorrelationId = null;
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

// Add correlation ID to all axios requests
api.interceptors.request.use(request => {
  const correlationId = getOrGenerateCorrelationId();
  request.headers['X-Correlation-ID'] = correlationId;
  console.log('API: Starting Request:', request.method?.toUpperCase(), request.url, 'Correlation ID:', correlationId);
  return request;
});

// Add axios interceptor for logging (correlation ID already added above)
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
  const correlationId = getOrGenerateCorrelationId();
  console.log('API: Fetching:', fullUrl, 'Correlation ID:', correlationId);
  
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
      'X-Correlation-ID': correlationId,
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


    
    // Handle 429 responses specially - let them pass through to handleResponse
    // for proper business rule processing, but handle other errors generically
    if (response.status === 429) {
      // Let 429 responses pass through to handleResponse for proper processing
      return response;
    }
    
    // Generic non-OK status handler (for all other status codes)
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

// Admin-specific fetch function with enhanced logging and error handling
export const fetchWithAdminAuth = async (endpoint: string, options?: RequestInit) => {
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const correlationId = getOrGenerateCorrelationId();

  console.log(`API: Admin request to ${endpoint}`, { 
    endpoint, 
    fullUrl, 
    method: options?.method || 'GET',
    hasBody: !!options?.body,
    correlationId
  });

  try {
    const response = await fetch(fullUrl, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
        ...(options?.headers || {})
      },
      ...options,
    });

    console.log(`API: Admin response for ${endpoint}`, { 
      endpoint, 
      status: response.status, 
      statusText: response.statusText,
      ok: response.ok 
    });

    if (!response.ok) {
      console.error(`API: Admin error for ${endpoint}`, { 
        endpoint, 
        status: response.status, 
        statusText: response.statusText 
      });
      
      if (response.status === 401) {
        throw new Error('Admin authentication required');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Admin endpoint error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`API: Admin success for ${endpoint}`, { 
      endpoint, 
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : []
    });

    return data;
  } catch (error) {
    console.error(`API: Admin exception for ${endpoint}`, { 
      endpoint, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
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
  shopifyProductId?: string; // Optional field for product association
  productTitle?: string; // Product title for display
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
    
    // Handle 429 responses (rate limits and business rules) as normal responses
    if (response.status === 429) {
      debugLog.info('API: 429 response detected, handling as business rule response', {}, 'API');
      
      try {
        const errorData = await response.json();
        debugLog.info('API: 429 response data', errorData, 'API');
        
        // Create a proper error with the specific message from the backend
        const businessRuleError = new Error(errorData.message || 'Rate limit exceeded');
        (businessRuleError as any).status = 429;
        (businessRuleError as any).response = {
          status: 429,
          data: errorData
        };
        
        // Add specific flags for competitor limits
        if (errorData.error === 'COMPETITOR_LIMIT_EXCEEDED') {
          debugLog.info('API: Setting competitorLimitExceeded flag', {}, 'API');
          (businessRuleError as any).competitorLimitExceeded = true;
        } else if (errorData.error === 'ARCHIVED_COMPETITOR_LIMIT_EXCEEDED') {
          debugLog.info('API: Setting archivedCompetitorLimitExceeded flag', {}, 'API');
          (businessRuleError as any).archivedCompetitorLimitExceeded = true;
        }
        
        debugLog.info('API: Throwing business rule error with message', { message: businessRuleError.message }, 'API');
        throw businessRuleError;
      } catch (parseError) {
        // If we can't parse the response, throw a generic 429 error
        const generic429Error = new Error('Rate limit exceeded. Please wait a moment before retrying.');
        (generic429Error as any).status = 429;
        throw generic429Error;
      }
    }
    
    // Handle 412 PRODUCTS_SYNC_NEEDED error
    if (response.status === 412) {
      console.log('API: 412 response detected, handling as PRODUCTS_SYNC_NEEDED');
      
      try {
        const errorData = await response.json();
        console.log('API: 412 response data:', errorData);
        
        const userError = new Error('Your product catalog needs to be synchronized before adding competitors. Please sync your products first.');
        (userError as any).userFriendly = true;
        (userError as any).needsProductSync = true;
        throw userError;
      } catch (parseError) {
        const userError = new Error('Your product catalog needs to be synchronized before adding competitors. Please sync your products first.');
        (userError as any).userFriendly = true;
        (userError as any).needsProductSync = true;
        throw userError;
      }
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
  
  // Check if response has content before trying to parse as JSON
  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');
  
  // If response is empty or has no content, return undefined for void functions
  if (contentLength === '0' || !contentType || !contentType.includes('application/json')) {
    console.log('API: Empty response or non-JSON content, returning undefined');
    return undefined as T;
  }
  
  try {
    const data = await response.json();
    console.log('API: Success response:', response.status, data);
    return data;
  } catch (parseError) {
    console.log('API: Failed to parse JSON response, returning undefined');
    return undefined as T;
  }
}

export async function getInsights(): Promise<Insight> {
  // Check if demo mode is active
  const demoModeLocalStorage = localStorage.getItem('demo_mode_active') === 'true';
  const demoModeURL = new URLSearchParams(window.location.search).get('demo') === 'true';
  const isDemoMode = demoModeLocalStorage || demoModeURL;

  console.log('🔍 API getInsights: Demo mode check:', {
    localStorage: localStorage.getItem('demo_mode_active'),
    urlParam: new URLSearchParams(window.location.search).get('demo'),
    isDemoMode,
    currentUrl: window.location.href
  });

  if (isDemoMode) {
    console.log('API: Using embedded demo data for insights');
    
    try {
      // Use direct embedded demo data for fastest, most reliable performance
      const { DEMO_DATA_BUNDLE } = await import('./data/demoDataBundle');
      const data = DEMO_DATA_BUNDLE.analytics;
      
      const insight = {
        conversionRate: data.orders.conversion_rate,
        conversionRateDelta: 0.3, // Demo delta value
        topSellingProducts: [
          { title: 'Premium Wireless Headphones', sales: 24, delta: 5 },
          { title: 'Smart Fitness Tracker', sales: 18, delta: 3 },
          { title: 'Ergonomic Office Chair', sales: 12, delta: -2 }
        ],
        abandonedCartCount: data.inventory.abandoned_cart_count,
        insightText: `Your conversion rate is ${data.orders.conversion_rate}% with ${data.orders.total_orders} total orders and ${data.revenue.total_revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })} in revenue.`
      };
      
      console.log('✅ API: Demo insights loaded from embedded data:', insight);
      return insight;
    } catch (error) {
      console.error('❌ API: Failed to load demo data bundle, using minimal fallback:', error);
      // Minimal fallback data with non-zero values
      return {
        conversionRate: 2.5,
        conversionRateDelta: 0.2,
        topSellingProducts: [
          { title: 'Premium Wireless Headphones', sales: 24, delta: 5 },
          { title: 'Smart Fitness Tracker', sales: 18, delta: 3 }
        ],
        abandonedCartCount: 24,
        insightText: 'Your conversion rate is 2.5% with 187 total orders and $26,900 in revenue.'
      };
    }
  }
  
  console.log('API: Using regular insights endpoint');
  const res = await fetch(`${API_BASE_URL}/api/insights`, defaultOptions);
  return handleResponse<Insight>(res);
}

export async function getCompetitors(): Promise<Competitor[]> {
  // Check if demo mode is active
  const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                    new URLSearchParams(window.location.search).get('demo') === 'true';
  
  if (isDemoMode) {
    console.log('API: Using embedded demo data for competitors');
    
    try {
      const { DEMO_DATA_BUNDLE } = await import('./data/demoDataBundle');
      const competitors = DEMO_DATA_BUNDLE.competitors.map(comp => ({
        id: comp.id,
        url: comp.url,
        label: comp.name,
        price: comp.current_price,
        inStock: comp.status === 'active',
        percentDiff: Math.round((comp.price_difference / comp.our_price) * 100),
        lastChecked: comp.last_checked,
        productTitle: comp.name.split(' - ')[1] || 'Demo Product'
      }));
      
      console.log(`✅ API: Demo competitors loaded - ${competitors.length} competitors from embedded data`);
      return competitors;
    } catch (error) {
      console.error('❌ API: Failed to load demo data bundle, using minimal fallback:', error);
      return [];
    }
  }
  
  console.log('API: Using regular competitors endpoint');
  const res = await fetch(`${API_BASE_URL}/api/competitors`, defaultOptions);
  return handleResponse<Competitor[]>(res);
}

export async function getProducts(): Promise<any[]> {
  // Check if demo mode is active
  const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                    new URLSearchParams(window.location.search).get('demo') === 'true';
  
  console.log('🔍 API: getProducts - Demo mode check:', {
    localStorage: localStorage.getItem('demo_mode_active'),
    urlParam: new URLSearchParams(window.location.search).get('demo'),
    isDemoMode
  });
  
  if (isDemoMode) {
    console.log('API: Using embedded demo data for products');
    
    try {
      const { DEMO_DATA_BUNDLE } = await import('./data/demoDataBundle');
      const products = DEMO_DATA_BUNDLE.products;
      
      // Convert demo products to match backend API format
      const convertedProducts = products.map(product => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        price: `$${product.price.toFixed(2)}`,
        inventory: product.inventory_quantity, // Map inventory_quantity to inventory
        status: product.status,
        shopify_url: `https://demo-shopgauge.myshopify.com/admin/products/${product.id}`,
        sales: `${Math.floor(Math.random() * 100) + 20} units`, // Demo sales data
        revenue: `$${(product.price * (Math.floor(Math.random() * 100) + 20)).toFixed(0)}` // Demo revenue
      }));
      
      console.log(`✅ API: Demo products loaded - ${convertedProducts.length} products from embedded data`);
      console.log('📝 Sample product:', convertedProducts[0]);
      return convertedProducts;
    } catch (error) {
      console.error('❌ API: Failed to load demo data bundle, using minimal fallback:', error);
      // Return basic embedded product data in backend API format
      return [
        {
          id: '1',
          title: 'Premium Wireless Headphones',
          handle: 'premium-wireless-headphones',
          price: '$149.99',
          inventory: 45, // Use 'inventory' instead of 'inventory_quantity'
          status: 'active',
          shopify_url: 'https://demo-shopgauge.myshopify.com/admin/products/1',
          sales: '145 units',
          revenue: '$21,743'
        },
        {
          id: '2', 
          title: 'Smart Fitness Tracker',
          handle: 'smart-fitness-tracker',
          price: '$89.99',
          inventory: 32, // Use 'inventory' instead of 'inventory_quantity'
          status: 'active',
          shopify_url: 'https://demo-shopgauge.myshopify.com/admin/products/2',
          sales: '98 units',
          revenue: '$8,819'
        }
      ];
    }
  }
  
  console.log('API: Using regular products endpoint');
  const res = await fetch(`${API_BASE_URL}/api/analytics/products`, defaultOptions);
  return handleResponse<any[]>(res);
}

export async function getOrders(): Promise<any> {
  // Check if demo mode is active
  const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                    new URLSearchParams(window.location.search).get('demo') === 'true';
  
  if (isDemoMode) {
    console.log('API: Using embedded demo data for orders');
    
    try {
      const { DEMO_DATA_BUNDLE } = await import('./data/demoDataBundle');
      
      // Convert daily_orders analytics data to individual order records
      const dailyOrders = DEMO_DATA_BUNDLE.analytics.orders.daily_orders;
      const individualOrders = dailyOrders.map((dayData, index) => ({
        id: dayData.order_id || `demo_order_${1000 + index}`,
        order_number: `#SO-${1000 + index}`,
        created_at: dayData.created_at,
        total_price: dayData.total_price,
        customer: {
          first_name: 'Demo',
          last_name: `Customer ${index + 1}`,
          email: `customer${index + 1}@demo.com`
        },
        status: 'fulfilled',
        financial_status: 'paid',
        fulfillment_status: 'fulfilled'
      }));
      
      // Sort by date (newest first)
      individualOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Return in the same format as backend API
      const result = {
        orders: individualOrders, // Individual order objects
        timeseries: individualOrders, // Same data for timeseries charts
        count: individualOrders.length,
        has_more: false,
        page: 1,
        limit: individualOrders.length
      };
      
      console.log(`✅ API: Demo orders loaded - ${individualOrders.length} individual orders from embedded data`);
      console.log('📝 Sample order:', individualOrders[0]);
      console.log('📊 API Response Structure:', Object.keys(result));
      return result;
    } catch (error) {
      console.error('❌ API: Failed to load demo data bundle, using minimal fallback:', error);
      // Return basic embedded orders data in backend API format
      const fallbackOrders = [
        {
          id: '1001',
          order_number: '#SO-1001',
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          total_price: 299.99,
          customer: { first_name: 'John', last_name: 'Smith', email: 'john@example.com' },
          status: 'fulfilled',
          financial_status: 'paid',
          fulfillment_status: 'fulfilled'
        },
        {
          id: '1002',
          order_number: '#SO-1002', 
          created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          total_price: 149.99,
          customer: { first_name: 'Sarah', last_name: 'Wilson', email: 'sarah@example.com' },
          status: 'fulfilled',
          financial_status: 'paid',
          fulfillment_status: 'fulfilled'
        }
      ];
      
      return {
        orders: fallbackOrders,
        timeseries: fallbackOrders,
        count: fallbackOrders.length,
        has_more: false,
        page: 1,
        limit: fallbackOrders.length
      };
    }
  }
  
  console.log('API: Using regular orders endpoint');
  const res = await fetch(`${API_BASE_URL}/api/analytics/orders`, defaultOptions);
  return handleResponse<any>(res);
}

export async function getRevenue(): Promise<any> {
  // Check if demo mode is active
  const demoModeLocalStorage = localStorage.getItem('demo_mode_active') === 'true';
  const demoModeURL = new URLSearchParams(window.location.search).get('demo') === 'true';
  const isDemoMode = demoModeLocalStorage || demoModeURL;
  
  console.log('🔍 API getRevenue: Demo mode check:', {
    localStorage: localStorage.getItem('demo_mode_active'),
    urlParam: new URLSearchParams(window.location.search).get('demo'),
    isDemoMode,
    currentUrl: window.location.href
  });
  
  if (isDemoMode) {
    console.log('API: Using embedded demo data for revenue');
    
    try {
      const { DEMO_DATA_BUNDLE } = await import('./data/demoDataBundle');
      const revenueData = DEMO_DATA_BUNDLE.analytics.revenue;
      
      // Convert daily_revenue format to match backend API format
      const timeseriesData = revenueData.daily_revenue.map(day => ({
        created_at: day.date, // Backend uses 'created_at' instead of 'date'
        total_price: day.revenue // Backend uses 'total_price' instead of 'revenue'
      }));
      
      const result = {
        current_period: revenueData.total_revenue,
        previous_period: revenueData.total_revenue / (1 + revenueData.revenue_growth / 100),
        growth_rate: revenueData.revenue_growth,
        daily_data: timeseriesData,
        // Add dashboard-expected properties
        totalRevenue: revenueData.total_revenue,
        revenue: revenueData.total_revenue,
        timeseries: timeseriesData, // Use converted format
        recentRevenue: revenueData.total_revenue * 0.3, // ~30% of total as recent
        recentOrders: 45,
        recentConversionRate: 2.8,
        orders_count: 187,
        period_days: 30
      };
      
      console.log('✅ API: Demo revenue loaded from embedded data:', result);
      return result;
    } catch (error) {
      console.error('❌ API: Failed to load demo data bundle, using minimal fallback:', error);
      // Return basic embedded revenue data
      return {
        current_period: 26900.0,
        previous_period: 23947.20,
        growth_rate: 12.3,
        daily_data: [
          { created_at: '2024-01-01', total_price: 895.50 },
          { created_at: '2024-01-02', total_price: 1150.25 },
          { created_at: '2024-01-03', total_price: 780.75 }
        ],
        // Add dashboard-expected properties
        totalRevenue: 26900.0,
        revenue: 26900.0,
        timeseries: [
          { created_at: '2024-01-01', total_price: 895.50 },
          { created_at: '2024-01-02', total_price: 1150.25 },
          { created_at: '2024-01-03', total_price: 780.75 }
        ],
        recentRevenue: 8070.0, // ~30% of total
        recentOrders: 45,
        recentConversionRate: 2.8
      };
    }
  }
  
  console.log('API: Using regular revenue endpoint');
  const res = await fetch(`${API_BASE_URL}/api/analytics/revenue`, defaultOptions);
  return handleResponse<any>(res);
}

// Get products from session storage first, then Redis fallback
async function getProductsIntelligently(): Promise<any[]> {
  const shop = getApiAuthState().shop;
  if (!shop) {
    console.log('No shop available for product cache lookup');
    return [];
  }

  // First, try session storage (fastest) - use same key format as backend
  const sessionKey = `dashboard_cache_${shop}_v3`;
  const sessionData = sessionStorage.getItem(sessionKey);
  
  if (sessionData) {
    try {
      const cache = JSON.parse(sessionData);
      const age = Date.now() - cache.timestamp;
      const maxAge = 30 * 60 * 1000; // 30 minutes
      
      if (age < maxAge) {
        console.log('Using products from session storage cache');
        // Handle both old format and new dashboard format
        if (cache.products && Array.isArray(cache.products)) {
          // Old format: direct array
          return cache.products;
        } else if (cache.products && cache.products.data) {
          // New dashboard format: nested data
          return cache.products.data || [];
        }
        return [];
      } else {
        console.log('Session storage cache expired, removing');
        sessionStorage.removeItem(sessionKey);
      }
    } catch (error) {
      console.warn('Failed to parse session storage cache:', error);
      sessionStorage.removeItem(sessionKey);
    }
  }
  
  // Try Redis fallback via API (avoids direct Redis calls)
  try {
    console.log('Checking Redis cache for products via API');
    const response = await fetchWithAuth('/api/analytics/products');
    if (response.ok) {
      const data = await response.json();
      if (data.products && Array.isArray(data.products)) {
        // Cache in session storage for future use - use same format as dashboard
        const cacheData = {
          products: {
            data: data.products,
            timestamp: Date.now(),
            lastUpdated: new Date(),
            version: "v2.0",
            shop: shop
          },
          timestamp: Date.now()
        };
        sessionStorage.setItem(sessionKey, JSON.stringify(cacheData));
        console.log('Cached products from Redis in session storage');
        return data.products;
      } else {
        console.warn('Products API returned no products or invalid format:', data);
      }
    } else {
      console.warn('Products API failed with status:', response.status);
    }
  } catch (error) {
    console.warn('Redis fallback failed:', error);
  }
  
  // If no cache available, return empty array and let backend handle product selection
  console.log('No cached products available, letting backend handle product selection');
  return [];
}

// Intelligent competitor addition with automatic product syncing
export async function addCompetitorIntelligent(url: string, productId?: string): Promise<Competitor> {
  debugLog.info('addCompetitorIntelligent: Starting competitor addition', {
    url: url,
    productId: productId || 'not provided'
  }, 'API');
  
  console.log('addCompetitorIntelligent: Starting with URL:', url, 'productId:', productId);
  
  try {
    // If no productId provided, let backend handle product selection from cache
    let finalProductId = productId;
    
    if (!finalProductId) {
      console.log('No productId provided, letting backend select product from cache');
    }
    
    // Prepare request payload
    const payload = { url: url.trim(), productId: finalProductId || '' };
    console.log('addCompetitorIntelligent: Sending payload:', payload);
    
    // Use fetchWithAuth for proper authentication handling with extended timeout
    const response = await fetchWithAuth('/api/competitors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // Increased timeout for complex URLs like Amazon
    });
    
    console.log('addCompetitorIntelligent: Response status:', response.status);
    
    // Use handleResponse to properly handle 429 and other responses
    const competitor = await handleResponse<Competitor>(response);
    
    console.log('addCompetitorIntelligent: Success, received competitor:', competitor);
    debugLog.info('addCompetitorIntelligent: Successfully added competitor', {
      competitor: competitor,
      url: url
    }, 'API');
    return competitor;
    
  } catch (error: any) {
    debugLog.error('addCompetitorIntelligent: Caught error', { error: error.message }, 'API');
    debugLog.info('addCompetitorIntelligent: Error properties', {
      competitorLimitExceeded: error.competitorLimitExceeded,
      archivedCompetitorLimitExceeded: error.archivedCompetitorLimitExceeded,
      message: error.message,
      status: error.status
    }, 'API');
    
    // Re-throw user-friendly errors as-is
    if (error.userFriendly || error.needsProductSync) {
      throw error;
    }
    
    // Preserve specific competitor limit error messages
    if (error.competitorLimitExceeded || error.archivedCompetitorLimitExceeded) {
      debugLog.info('addCompetitorIntelligent: Re-throwing competitor limit error', { message: error.message }, 'API');
      throw error; // Re-throw the specific error message as-is
    }
    
    // Handle network errors and cancelled requests
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Connection issue detected. Please check your internet connection and try again.');
    }
    
    // Handle AbortError (cancelled requests)
    if (error.name === 'AbortError') {
      throw new Error('Request was cancelled due to timeout. Please try again.');
    }
    
    // Handle authentication errors
    if (error.message.includes('Authentication required') || error.message.includes('401')) {
      throw new Error('Your session has expired. Please refresh the page and try again.');
    }
    
    // Generic fallback
    const fallbackMessage = error.message || 'Unable to add competitor at this time. Please try again.';
    throw new Error(fallbackMessage);
  }
}

// Keep the original function for backward compatibility
export async function addCompetitor(url: string, productId: string): Promise<Competitor> {
  return addCompetitorIntelligent(url, productId);
}

export async function deleteCompetitor(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/competitors/${id}`, {
    method: 'DELETE',
  });
  return handleResponse<void>(res);
}

export async function getPriceStatus(id: string): Promise<{
  hasPrice: boolean;
  price?: number;
  inStock?: boolean;
  lastChecked?: string;
  message?: string;
}> {
  const res = await fetchWithAuth(`/api/competitors/${id}/price-status`);
  return handleResponse<{
    hasPrice: boolean;
    price?: number;
    inStock?: boolean;
    lastChecked?: string;
    message?: string;
  }>(res);
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
  const res = await fetchWithAuth(`/api/competitors/suggestions?page=${page}&size=${size}&status=${status}`);
  return handleResponse<SuggestionResponse>(res);
}

export async function getSuggestionCount(): Promise<{ newSuggestions: number }> {
  // Check if demo mode is active
  const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                    new URLSearchParams(window.location.search).get('demo') === 'true';
  
  if (isDemoMode) {
    console.log('API: Using demo data for suggestion count');
    
    try {
      const { DEMO_DATA_BUNDLE } = await import('./data/demoDataBundle');
      const demoCount = DEMO_DATA_BUNDLE.competitors.length;
      
      console.log('✅ API: Demo suggestion count loaded:', demoCount);
      return { newSuggestions: demoCount };
    } catch (error) {
      console.error('❌ API: Failed to load demo data bundle, using fallback:', error);
      // Fallback demo count
      return { newSuggestions: 24 };
    }
  }
  
  console.log('API: Using regular suggestion count endpoint');
  const res = await fetchWithAuth(`/api/competitors/suggestions/count`);
  return handleResponse<{ newSuggestions: number }>(res);
}

// Manual refresh endpoint for forcing fresh data
export async function refreshSuggestionCount(): Promise<{ newSuggestions: number }> {
  const res = await fetchWithAuth(`/api/competitors/suggestions/refresh-count`, {
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
  const res = await fetchWithAuth(`/api/competitors/suggestions/${id}/approve`, {
    method: 'POST',
  });
  return handleResponse<{ message: string }>(res);
}

export async function ignoreSuggestion(id: number): Promise<{ message: string }> {
  const res = await fetchWithAuth(`/api/competitors/suggestions/${id}/ignore`, {
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
  // Check if demo mode is active
  const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                    new URLSearchParams(window.location.search).get('demo') === 'true';
  
  if (isDemoMode) {
    console.log('API: Using demo data for store stats');
    
    try {
      const { DEMO_DATA_BUNDLE } = await import('./data/demoDataBundle');
      const data = DEMO_DATA_BUNDLE.analytics;
      
      // Return demo store stats that match the expected format
      const demoStats = {
        total_orders: data.orders.total_orders,
        total_revenue: data.revenue.total_revenue,
        total_products: data.inventory.total_products,
        conversion_rate: data.orders.conversion_rate,
        average_order_value: data.revenue.total_revenue / data.orders.total_orders,
        last_sync: new Date().toISOString(),
        shop_domain: 'demo-shopgauge.myshopify.com',
        is_demo: true
      };
      
      console.log('✅ API: Demo store stats loaded:', demoStats);
      return demoStats;
    } catch (error) {
      console.error('❌ API: Failed to load demo data bundle, using fallback:', error);
      // Fallback demo data
      return {
        total_orders: 187,
        total_revenue: 26900,
        total_products: 24,
        conversion_rate: 2.5,
        average_order_value: 143.85,
        last_sync: new Date().toISOString(),
        shop_domain: 'demo-shopgauge.myshopify.com',
        is_demo: true
      };
    }
  }
  
  console.log('API: Using regular store stats endpoint');
  const response = await fetchWithAuth('/api/analytics/store-stats');
  return handleResponse<any>(response);
};

export const forceDisconnectShop = async (shop: string) => {
  const response = await fetchWithAuth('/api/auth/shopify/profile/force-disconnect', {
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
