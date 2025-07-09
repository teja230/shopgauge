import { fetchWithAuth } from './index';

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