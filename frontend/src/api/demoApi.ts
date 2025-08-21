/**
 * Demo API service
 * 
 * This service provides demo data when the application is in demo mode.
 * It overrides regular API calls with demo-specific endpoints that don't require authentication.
 */

const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
) || '';

/**
 * Check if the application is currently in demo mode
 */
const isDemoModeActive = (): boolean => {
  // Check multiple sources for demo mode
  const urlParams = new URLSearchParams(window.location.search);
  const urlDemo = urlParams.get('demo') === 'true';
  const localStorageDemo = localStorage.getItem('demo_mode_active') === 'true';
  const sessionStorageDemo = sessionStorage.getItem('demo_mode_active') === 'true';
  
  return urlDemo || localStorageDemo || sessionStorageDemo;
};

/**
 * Make a demo API call
 */
const makeDemoApiCall = async (endpoint: string) => {
  const response = await fetch(`${API_BASE_URL}/api/demo${endpoint}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Demo API call failed: ${response.status}`);
  }

  return response.json();
};

/**
 * Demo API functions that mirror the regular API
 */
export const demoApi = {
  /**
   * Get insights data for demo mode
   */
  getInsights: async () => {
    if (!isDemoModeActive()) {
      throw new Error('Demo mode is not active');
    }
    console.log('DemoAPI: Getting demo insights');
    return makeDemoApiCall('/analytics/insights');
  },

  /**
   * Get products data for demo mode
   */
  getProducts: async () => {
    if (!isDemoModeActive()) {
      throw new Error('Demo mode is not active');
    }
    console.log('DemoAPI: Getting demo products');
    return makeDemoApiCall('/analytics/products');
  },

  /**
   * Get orders data for demo mode
   */
  getOrders: async () => {
    if (!isDemoModeActive()) {
      throw new Error('Demo mode is not active');
    }
    console.log('DemoAPI: Getting demo orders');
    return makeDemoApiCall('/analytics/orders');
  },

  /**
   * Get revenue data for demo mode
   */
  getRevenue: async () => {
    if (!isDemoModeActive()) {
      throw new Error('Demo mode is not active');
    }
    console.log('DemoAPI: Getting demo revenue');
    return makeDemoApiCall('/analytics/revenue');
  },

  /**
   * Get inventory data for demo mode
   */
  getInventory: async () => {
    if (!isDemoModeActive()) {
      throw new Error('Demo mode is not active');
    }
    console.log('DemoAPI: Getting demo inventory');
    return makeDemoApiCall('/analytics/inventory');
  },

  /**
   * Check if demo mode is active
   */
  isDemoModeActive
};

export default demoApi;
