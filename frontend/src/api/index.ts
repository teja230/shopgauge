import axios from 'axios';
import { debugLog } from '../components/ui/DebugPanel';

const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
) || '' /* Relative path handled by dev proxy */;

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

if (!import.meta.env.VITE_API_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    'VITE_API_BASE_URL is not defined – defaulting to relative URLs. Set this variable in production.'
  );
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add correlation ID to all axios requests
api.interceptors.request.use(request => {
  const correlationId = getOrGenerateCorrelationId();
  request.headers['X-Correlation-ID'] = correlationId;
  return request;
});

const API_BASE = '/api';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Route all requests through dedicated API host
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const correlationId = getOrGenerateCorrelationId();
  // Only log in development or for non-auth endpoints
  if (import.meta.env.DEV && !url.includes('/auth/shopify/me')) {
    console.log('API: Making request to', fullUrl, 'Correlation ID:', correlationId);
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
    
    // Only log response status in development and for non-auth endpoints
    if (import.meta.env.DEV && !url.includes('/auth/shopify/me')) {
      console.log('API: Response status for', fullUrl, ':', response.status);
    }
    
    // Try to parse response as JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Only log errors for non-auth endpoints or in development
      if (import.meta.env.DEV || !url.includes('/auth/shopify/me')) {
        console.error('API: Error response from', fullUrl, ':', data);
      }
      if (response.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error(typeof data === 'string' ? data : data.error || 'API request failed');
    }

    return response;
  } catch (error) {
    // Only log errors for non-auth endpoints or in development
    if (import.meta.env.DEV || !url.includes('/auth/shopify/me')) {
      console.error('API: Request failed for', fullUrl, ':', error);
    }
    throw error;
  }
}

export async function getAuthShop(): Promise<string> {
  // Only log in development
  if (import.meta.env.DEV) {
    console.log('API: Getting auth shop');
  }
  
  try {
    const response = await fetchWithAuth('/api/auth/shopify/me');
    const data = await response.json();
    
    // Only log in development
    if (import.meta.env.DEV) {
      console.log('API: Auth shop response:', data);
    }
    
    if (!data.shop) {
      throw new Error('No shop found in response');
    }
    return data.shop;
  } catch (error) {
    // Only log in development
    if (import.meta.env.DEV) {
      console.error('API: Failed to get auth shop:', error);
    }
    throw error;
  }
}

export async function getInsights(): Promise<any> {
  console.log('API: Getting insights');
  try {
    const response = await fetchWithAuth('/api/analytics/insights');
    const data = await response.json();
    console.log('API: Insights response:', data);
    return data;
  } catch (error) {
    console.error('API: Failed to get insights:', error);
    throw error;
  }
}

export async function getHealthSummary(): Promise<any> {
  if (import.meta.env.DEV) {
    console.log('API: Fetching health summary');
  }
  try {
    const response = await fetchWithAuth('/api/health/summary');
    const data = await response.json();
    if (import.meta.env.DEV) {
      console.log('API: Health summary response:', data);
    }
    
    // Transform the backend response format to match frontend expectations
    const transformedData = {
      backendStatus: data.status === 'healthy' ? 'UP' : 
                    data.status === 'degraded' ? 'DEGRADED' : 'DOWN',
      redisStatus: data.redis?.status === 'healthy' ? 'UP' : 
                  data.redis?.status === 'unhealthy' ? 'DOWN' : 'UNKNOWN',
      databaseStatus: data.database?.status === 'healthy' ? 'UP' : 
                     data.database?.status === 'unhealthy' ? 'DOWN' : 'UNKNOWN',
      systemStatus: data.status === 'healthy' ? 'UP' : 
                   data.status === 'degraded' ? 'DEGRADED' : 'DOWN',
      lastUpdated: new Date(data.timestamp).getTime(),
      lastDeployCommit: 'unknown', // Not provided by backend
      database: data.database ? {
        activeConnections: data.database.activeConnections || 0,
        idleConnections: data.database.idleConnections || 0,
        totalConnections: data.database.totalConnections || 0,
        threadsAwaitingConnection: data.database.threadsAwaitingConnection || 0,
        maxPoolSize: data.database.maxPoolSize || 20,
        minimumIdle: data.database.minimumIdle || 5,
        activeUsageRatio: data.database.activeUsageRatio || 0,
        activeUsagePercent: data.database.activeUsagePercent || 0,
        consecutiveFailures: data.database.consecutiveFailures || 0,
        lastFailureTime: data.database.lastFailureTime || 0,
        healthStatus: data.database.status === 'healthy' ? 'HEALTHY' : 'UNHEALTHY',
        poolStatus: data.database.poolStatus || 'UNKNOWN'
      } : undefined
    };
    
    if (import.meta.env.DEV) {
      console.log('API: Transformed health summary:', transformedData);
    }
    
    return transformedData;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Failed to fetch health summary', error);
    }
    throw error;
  }
}

export async function adminLogin(username: string, password: string): Promise<any> {
  const correlationId = getOrGenerateCorrelationId();
  if (import.meta.env.DEV) {
    console.log('API: Admin login attempt', 'Correlation ID:', correlationId);
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });
    
    const data = await response.json();
    if (import.meta.env.DEV) {
      console.log('API: Admin login response:', data);
    }
    
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Admin login error:', error);
    }
    return { success: false, error: 'Login failed' };
  }
}

export async function adminLogout(): Promise<any> {
  if (import.meta.env.DEV) {
    console.log('API: Admin logout');
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    const data = await response.json();
    if (import.meta.env.DEV) {
      console.log('API: Admin logout response:', data);
    }
    
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Admin logout error:', error);
    }
    return { success: false, error: 'Logout failed' };
  }
}

export async function getAdminStatus(): Promise<any> {
  debugLog.info('API: Checking admin status', null, 'API');
  
  // Debug: Log the actual URL being constructed
  const fullUrl = `${API_BASE_URL}/api/admin/status`;
  debugLog.info('API: getAdminStatus() - API_BASE_URL', API_BASE_URL, 'API');
  debugLog.info('API: getAdminStatus() - Full URL', fullUrl, 'API');
  
  try {
    const response = await fetch(fullUrl, {
      credentials: 'include'
    });
    
    const data = await response.json();
    debugLog.info('API: Admin status response', data, 'API');
    
    return data;
  } catch (error) {
    debugLog.error('API: Admin status error', error, 'API');
    // Always throw the error instead of returning a fallback object
    // This ensures the AdminPage catch block is hit for network errors
    throw error;
  }
}

export async function fetchWithAdminAuth(endpoint: string, options?: RequestInit) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const correlationId = getOrGenerateCorrelationId();

  debugLog.info(`fetchWithAdminAuth: Making request to ${endpoint}`, { 
    endpoint, 
    fullUrl, 
    method: options?.method || 'GET',
    hasBody: !!options?.body,
    correlationId
  }, 'API');

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

    debugLog.info(`fetchWithAdminAuth: Response received for ${endpoint}`, { 
      endpoint, 
      status: response.status, 
      statusText: response.statusText,
      ok: response.ok 
    }, 'API');

    if (!response.ok) {
      debugLog.error(`fetchWithAdminAuth: Error response for ${endpoint}`, { 
        endpoint, 
        status: response.status, 
        statusText: response.statusText 
      }, 'API');
      
      if (response.status === 401) {
        throw new Error('Admin authentication required');
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Admin endpoint error: ${response.status}`);
    }

    const data = await response.json();
    debugLog.info(`fetchWithAdminAuth: Success response for ${endpoint}`, { 
      endpoint, 
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : []
    }, 'API');

    return data;
  } catch (error) {
    debugLog.error(`fetchWithAdminAuth: Exception for ${endpoint}`, { 
      endpoint, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 'API');
    throw error;
  }
}

export { fetchWithAuth }; 

export async function refreshCompetitorPrices(): Promise<{
  message: string;
  updated_count: number;
  total_competitors: number;
  estimated_completion_time: string;
}> {
  const response = await fetchWithAuth('/api/competitors/refresh-prices', {
    method: 'POST',
  });
  
  return response.json();
}

export const getPriceRefreshStatus = async (): Promise<{
  total_competitors: number;
  stale_count: number;
  recent_count: number;
  today_count: number;
  last_24h_count: number;
  can_refresh: boolean;
  last_refresh_available: string;
}> => {
  const response = await fetchWithAuth('/api/competitors/refresh-status');
  
  return response.json();
}; 