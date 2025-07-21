import { fetchWithAdminAuth } from './index';
import { debugLog } from '../components/ui/DebugPanel';

const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
) || '';

export const adminLogin = async (username: string, password: string): Promise<any> => {
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
};

export const adminLogout = async (): Promise<any> => {
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
};

export const getAdminStatus = async (): Promise<any> => {
  if (import.meta.env.DEV) {
    console.log('API: Checking admin status');
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/status`, {
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
    return { authenticated: false, error: 'Status check failed' };
  }
};

// Admin Session Management Functions
export const getAdminSessionHealth = async (): Promise<any> => {
  if (import.meta.env.DEV) {
    console.log('API: Getting admin session health');
  }
  try {
    const data = await fetchWithAdminAuth('/api/sessions/admin/health');
    if (import.meta.env.DEV) {
      console.log('API: Admin session health response:', data);
    }
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Admin session health error:', error);
    }
    return { success: false, error: 'Failed to get session health' };
  }
};

export const getAdminShopsWithSessions = async (): Promise<any> => {
  if (import.meta.env.DEV) {
    console.log('API: Getting admin shops with sessions');
  }
  try {
    const data = await fetchWithAdminAuth('/api/sessions/admin/shops');
    if (import.meta.env.DEV) {
      console.log('API: Admin shops with sessions response:', data);
    }
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Admin shops with sessions error:', error);
    }
    return { success: false, error: 'Failed to get shops with sessions' };
  }
};

export const getAdminShopSessions = async (shopDomain: string): Promise<any> => {
  debugLog.info(`API: Getting admin shop sessions for: ${shopDomain}`, { shopDomain }, 'AdminAPI');
  try {
    const data = await fetchWithAdminAuth(`/api/sessions/admin/shop/${encodeURIComponent(shopDomain)}/sessions`);
    debugLog.info(`API: Admin shop sessions response received`, { 
      shopDomain, 
      success: data.success, 
      sessionCount: data.sessions?.length || 0,
      hasError: !!data.error 
    }, 'AdminAPI');
    return data;
  } catch (error) {
    debugLog.error(`API: Admin shop sessions error`, { 
      shopDomain, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 'AdminAPI');
    return { success: false, error: 'Failed to get shop sessions' };
  }
};

export const refreshAdminShopSessions = async (shopDomain: string): Promise<any> => {
  if (import.meta.env.DEV) {
    console.log('API: Refreshing admin shop sessions for:', shopDomain);
  }
  try {
    const data = await fetchWithAdminAuth(`/api/sessions/admin/shop/${encodeURIComponent(shopDomain)}/refresh`, {
      method: 'POST'
    });
    if (import.meta.env.DEV) {
      console.log('API: Admin shop sessions refresh response:', data);
    }
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Admin shop sessions refresh error:', error);
    }
    return { success: false, error: 'Failed to refresh shop sessions' };
  }
};

export const invalidateAdminShopSessions = async (shopDomain: string): Promise<any> => {
  if (import.meta.env.DEV) {
    console.log('API: Invalidating admin shop sessions for:', shopDomain);
  }
  try {
    const data = await fetchWithAdminAuth(`/api/sessions/admin/shop/${encodeURIComponent(shopDomain)}/invalidate`, {
      method: 'POST'
    });
    if (import.meta.env.DEV) {
      console.log('API: Admin shop sessions invalidate response:', data);
    }
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Admin shop sessions invalidate error:', error);
    }
    return { success: false, error: 'Failed to invalidate shop sessions' };
  }
};

/**
 * Invalidate all sessions for a specific shop using the new admin session invalidation service
 */
export const invalidateShopSessions = async (shopDomain: string, reason?: string): Promise<any> => {
  if (import.meta.env.DEV) {
    console.log('API: Invalidating shop sessions for:', shopDomain, 'Reason:', reason);
  }
  try {
    const body = reason ? { reason } : undefined;
    const data = await fetchWithAdminAuth(`/api/admin/invalidate-shop-sessions/${encodeURIComponent(shopDomain)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (import.meta.env.DEV) {
      console.log('API: Shop sessions invalidate response:', data);
    }
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Shop sessions invalidate error:', error);
    }
    return { success: false, error: 'Failed to invalidate shop sessions' };
  }
};

/**
 * Invalidate a specific session
 */
export const invalidateSpecificSession = async (shopDomain: string, sessionId: string, reason?: string): Promise<any> => {
  if (import.meta.env.DEV) {
    console.log('API: Invalidating specific session:', sessionId, 'for shop:', shopDomain, 'Reason:', reason);
  }
  try {
    const body = reason ? { reason } : undefined;
    const data = await fetchWithAdminAuth(`/api/admin/invalidate-session/${encodeURIComponent(shopDomain)}/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (import.meta.env.DEV) {
      console.log('API: Specific session invalidate response:', data);
    }
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Specific session invalidate error:', error);
    }
    return { success: false, error: 'Failed to invalidate specific session' };
  }
};

/**
 * Get all shops with active sessions
 */
export const getShopsWithSessions = async (): Promise<any> => {
  if (import.meta.env.DEV) {
    console.log('API: Getting shops with active sessions');
  }
  try {
    const data = await fetchWithAdminAuth('/api/admin/shops-with-sessions', {
      method: 'GET'
    });
    if (import.meta.env.DEV) {
      console.log('API: Shops with sessions response:', data);
    }
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Get shops with sessions error:', error);
    }
    return { success: false, error: 'Failed to get shops with sessions' };
  }
};

export const getAdminSseStats = async (): Promise<any> => {
  if (import.meta.env.DEV) {
    console.log('API: Getting admin SSE statistics');
  }
  try {
    const data = await fetchWithAdminAuth('/api/sessions/admin/sse/stats');
    if (import.meta.env.DEV) {
      console.log('API: Admin SSE stats response:', data);
    }
    return data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('API: Admin SSE stats error:', error);
    }
    return { success: false, error: 'Failed to get SSE statistics' };
  }
}; 