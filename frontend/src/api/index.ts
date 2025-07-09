import axios from 'axios';

const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
) || '' /* Relative path handled by dev proxy */;

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

const API_BASE = '/api';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Route all requests through dedicated API host
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  // Only log in development or for non-auth endpoints
  if (import.meta.env.DEV && !url.includes('/auth/shopify/me')) {
    console.log('API: Making request to', fullUrl);
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
    const response = await fetchWithAuth('/analytics/insights');
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
  if (import.meta.env.DEV) {
    console.log('API: Admin login attempt');
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
  if (import.meta.env.DEV) {
    console.log('API: Checking admin status');
  }
  
  // Debug: Log the actual URL being constructed
  const fullUrl = `${API_BASE_URL}/api/admin/status`;
  console.log('API: getAdminStatus() - API_BASE_URL:', API_BASE_URL);
  console.log('API: getAdminStatus() - Full URL:', fullUrl);
  
  try {
    const response = await fetch(fullUrl, {
      credentials: 'include'
    });
    
    const data = await response.json();
    if (import.meta.env.DEV) {
      console.log('API: Admin status response:', data);
    }
    
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Admin status error:', error);
    }
    // Always throw the error instead of returning a fallback object
    // This ensures the AdminPage catch block is hit for network errors
    throw error;
  }
}

export { fetchWithAuth }; 