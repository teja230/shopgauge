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
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Failed to fetch health summary', error);
    }
    throw error;
  }
}

export { fetchWithAuth }; 