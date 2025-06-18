const API_BASE = '/api';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  console.log('API: Making request to', fullUrl);
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
    console.log('API: Response status for', fullUrl, ':', response.status);
    
    // Try to parse response as JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      console.error('API: Error response from', fullUrl, ':', data);
      if (response.status === 401) {
        throw new Error('Please log in');
      }
      throw new Error(typeof data === 'string' ? data : data.error || 'API request failed');
    }

    return response;
  } catch (error) {
    console.error('API: Request failed for', fullUrl, ':', error);
    throw error;
  }
}

export async function getAuthShop(): Promise<string> {
  console.log('API: Getting auth shop');
  try {
    const response = await fetchWithAuth('/auth/shopify/me');
    const data = await response.json();
    console.log('API: Auth shop response:', data);
    if (!data.shop) {
      throw new Error('No shop found in response');
    }
    return data.shop;
  } catch (error) {
    console.error('API: Failed to get auth shop:', error);
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

export { fetchWithAuth }; 