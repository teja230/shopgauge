import { fetchWithAdminAuth } from './index';

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
  console.log('API: Getting admin shop sessions for:', shopDomain);
  try {
    const data = await fetchWithAdminAuth(`/api/sessions/admin/shop/${encodeURIComponent(shopDomain)}/sessions`);
    console.log('API: Admin shop sessions response:', data);
    return data;
  } catch (error) {
    console.error('API: Admin shop sessions error:', error);
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