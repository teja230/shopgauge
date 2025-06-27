import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { CompetitorTable } from '../components/ui/CompetitorTable';
import type { Competitor } from '../components/ui/CompetitorTable';
import { SuggestionDrawer } from '../components/ui/SuggestionDrawer';
import { 
  getCompetitors, 
  addCompetitor, 
  deleteCompetitor,
  getDebouncedSuggestionCount,
  refreshSuggestionCount as refreshSuggestionCountAPI,
  API_BASE_URL
} from '../api';
import { useAuth } from '../context/AuthContext';
import { 
  SparklesIcon, 
  PlusIcon, 
  EyeIcon, 
  ChartBarIcon,
  PlayIcon,
  StopIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import type { CompetitorSuggestion } from '../api';
import { useNotifications } from '../hooks/useNotifications';
import { fetchWithAuth } from '../api/index';
import { getSuggestionCount } from '../api';
import { useNavigate } from 'react-router-dom';

// Demo data for when SerpAPI is not configured
const DEMO_COMPETITORS: Competitor[] = [
  {
    id: '1',
    url: 'https://amazon.com/dp/B08N5WRWNW',
    label: 'Amazon - Echo Dot (4th Gen)',
    price: 49.99,
    inStock: true,
    percentDiff: 0,
    lastChecked: '2 hours ago'
  },
  {
    id: '2',
    url: 'https://amazon.com/dp/B08C7W5L7D',
    label: 'Amazon - Fire TV Stick 4K',
    price: 39.99,
    inStock: true,
    percentDiff: -15.2,
    lastChecked: '1 hour ago'
  },
  {
    id: '3',
    url: 'https://amazon.com/dp/B08N5KWB9H',
    label: 'Amazon - Echo Show 8',
    price: 0,
    inStock: false,
    percentDiff: 0,
    lastChecked: '30 minutes ago'
  },
  {
    id: '4',
    url: 'https://amazon.com/dp/B07FZ8S74R',
    label: 'Amazon - Echo Plus (2nd Gen)',
    price: 149.99,
    inStock: true,
    percentDiff: 8.5,
    lastChecked: '15 minutes ago'
  }
];

// Demo suggestions for when SerpAPI is not configured
const DEMO_SUGGESTIONS: CompetitorSuggestion[] = [
  {
    id: 1,
    suggestedUrl: 'https://amazon.com/dp/B09B9Y6Y7H',
    title: 'Amazon - Echo Dot (5th Gen) - Smart Speaker',
    price: 49.99,
    source: 'GOOGLE_SHOPPING',
    discoveredAt: '2024-01-15T10:30:00Z',
    status: 'NEW'
  },
  {
    id: 2,
    suggestedUrl: 'https://amazon.com/dp/B08N5WRWNW',
    title: 'Amazon - Echo Dot (4th Gen) - Smart Speaker with Alexa',
    price: 39.99,
    source: 'GOOGLE_SHOPPING',
    discoveredAt: '2024-01-15T09:15:00Z',
    status: 'NEW'
  },
  {
    id: 3,
    suggestedUrl: 'https://amazon.com/dp/B07FZ8S74R',
    title: 'Amazon - Echo Plus (2nd Gen) - Premium Smart Speaker',
    price: 149.99,
    source: 'GOOGLE_SHOPPING',
    discoveredAt: '2024-01-15T08:45:00Z',
    status: 'NEW'
  }
];

// Cache configuration - 24hr cache for costly APIs (SerpAPI, etc.)
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - competitor data changes very slowly
const SUGGESTION_COUNT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - minimize expensive discovery API calls

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Global cache to persist across component re-renders
const cache = new Map<string, CacheEntry<any>>();

// Cached data fetcher with intelligent caching
const fetchWithCache = async <T,>(
  key: string,
  fetcher: () => Promise<T>,
  cacheDuration: number = CACHE_DURATION
): Promise<T> => {
  const cached = cache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < cacheDuration) {
    return cached.data;
  }
  
  const data = await fetcher();
  cache.set(key, { data, timestamp: now });
  return data;
};

export default function CompetitorsPage() {
  const { shop } = useAuth();
  const navigate = useNavigate();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [filteredCompetitors, setFilteredCompetitors] = useState<Competitor[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [url, setUrl] = useState('');
  const [productId, setProductId] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'inStock' | 'outOfStock'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastDiscoveryTime, setLastDiscoveryTime] = useState<number>(0);
  const [userDisabledDemo, setUserDisabledDemo] = useState<boolean>(false);
  const notifications = useNotifications();
  
  // Refs to prevent unnecessary re-renders and API calls
  const lastFetchTimeRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  
  // Discovery cooldown (24 hours per store) - now managed server-side
  const DISCOVERY_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

  // Fetch discovery status from server for cross-device consistency
  const fetchDiscoveryStatus = useCallback(async () => {
    if (!shop) return;
    
    try {
      const response = await fetchWithAuth('/competitors/discovery/status');
      const status = await response.json();
      
      // Handle improved response format (no cache details exposed)
      if (status.last_discovery) {
        const lastDiscoveryTime = new Date(status.last_discovery).getTime();
        setLastDiscoveryTime(lastDiscoveryTime);
      }
      
      // Enhanced logging for transparency without exposing technical details
      const canDiscover = status.can_discover || !status.is_on_cooldown;
      const statusText = status.status || (canDiscover ? 'ready' : 'cooldown');
      
      console.log(`Discovery status for ${shop}: ${statusText} (${canDiscover ? 'available now' : `available in ${status.hours_remaining || 0}h`})`);
    } catch (error) {
      console.log('Could not fetch discovery status from server - discovery status unavailable');
      // No fallback - server-side is the source of truth for cross-device consistency
    }
  }, [shop]);

  // Optimized data fetching with caching and debouncing
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!shop) return;
    
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    // Prevent rapid successive calls (debounce) - 24hr cooldown for costly APIs
    if (!forceRefresh && !isInitialLoadRef.current && timeSinceLastFetch < 24 * 60 * 60 * 1000) { // 24 hours
      return;
    }
    
    try {
      setIsLoading(true);
      
      const cacheKey = `competitors_${shop}`;
      const suggestionCacheKey = `suggestions_${shop}`;
      
      const [competitorsData, suggestionCountData] = await Promise.all([
        fetchWithCache(cacheKey, getCompetitors, forceRefresh ? 0 : CACHE_DURATION),
        fetchWithCache(suggestionCacheKey, getDebouncedSuggestionCount, forceRefresh ? 0 : SUGGESTION_COUNT_CACHE_DURATION)
      ]);
      
      // Set data first
      setCompetitors(competitorsData);
      setSuggestionCount(suggestionCountData.newSuggestions);
      
      // Handle demo mode logic - respect user preference above all
      if (userDisabledDemo) {
        // User explicitly disabled demo - stay in live mode regardless of data
        setIsDemoMode(false);
      } else if (competitorsData.length === 0 && suggestionCountData.newSuggestions === 0) {
        // No data and user hasn't disabled demo - show demo mode
        setIsDemoMode(true);
        setCompetitors(DEMO_COMPETITORS);
        setSuggestionCount(DEMO_SUGGESTIONS.length);
      } else {
        // Has data - use live mode
        setIsDemoMode(false);
      }
      
      lastFetchTimeRef.current = now;
      isInitialLoadRef.current = false;
      
    } catch (e) {
      console.log('API not available, using demo mode if not disabled by user');
      // Only auto-enable demo mode on API failure if user hasn't explicitly disabled it
      if (!userDisabledDemo) {
        setIsDemoMode(true);
        setCompetitors(DEMO_COMPETITORS);
        setSuggestionCount(DEMO_SUGGESTIONS.length);
      }
    } finally {
      setIsLoading(false);
    }
  }, [shop, fetchWithCache, userDisabledDemo]);

  // Initialize discovery status from server and user preferences from localStorage
  useEffect(() => {
    if (shop) {
      // Fetch discovery status from server (cross-device consistency)
      fetchDiscoveryStatus();
      
      // Check if user explicitly disabled demo mode for this shop
      const demoDisabled = localStorage.getItem(`demoDisabled_${shop}`);
      if (demoDisabled === 'true') {
        setUserDisabledDemo(true);
        console.log(`Demo mode disabled by user for shop: ${shop}`);
      }
    }
  }, [shop]);

  // Initial data load - ON-DEMAND ONLY (no polling)
  useEffect(() => {
    if (!shop) {
      setCompetitors([]);
      setFilteredCompetitors([]);
      setUrl('');
      setProductId('');
      setIsDemoMode(false);
      setSuggestionCount(0);
      return;
    }

    // Only fetch on initial page load - no background polling
    fetchData();
  }, [shop, fetchData]);

  // Optimized filtering with useMemo to prevent unnecessary re-calculations
  const filteredData = useMemo(() => {
    let filtered = [...competitors];
    
    // Apply status filter
    if (filterStatus === 'inStock') {
      filtered = filtered.filter(c => c.inStock);
    } else if (filterStatus === 'outOfStock') {
      filtered = filtered.filter(c => !c.inStock);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.label.toLowerCase().includes(query) || 
        c.url.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [competitors, filterStatus, searchQuery]);

  // Update filtered competitors when filteredData changes
  useEffect(() => {
    setFilteredCompetitors(filteredData);
  }, [filteredData]);

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      setCompetitors([]);
      setFilteredCompetitors([]);
      setUrl('');
      setProductId('');
      setIsDemoMode(false);
      setSuggestionCount(0);
      setUserDisabledDemo(false);
    };
  }, []);

  const handleAdd = useCallback(async () => {
    if (!url.trim()) {
      notifications.showError('Please enter a competitor URL', {
        category: 'Competitors'
      });
      return;
    }

    setIsAdding(true);
    try {
      let newCompetitor: Competitor;
      
      if (isDemoMode) {
        // Demo mode logic
        const demoId = `demo-${Date.now()}`;
        newCompetitor = {
          id: demoId,
          url: url.trim(),
          label: new URL(url.trim()).hostname,
          price: Math.floor(Math.random() * 100) + 20,
          inStock: Math.random() > 0.2,
          percentDiff: Math.floor(Math.random() * 40) - 20,
          lastChecked: new Date().toISOString()
        };
        setCompetitors((prev) => [...prev, newCompetitor]);
        notifications.showSuccess('Demo competitor added', {
          category: 'Competitors'
        });
      } else {
        // Intelligent competitor addition with automatic product syncing
        let finalProductId = productId;
        
        // If no productId provided, try to get products intelligently
        if (!finalProductId) {
          console.log('No productId provided, attempting to get products intelligently...');
          
          // First, try dashboard cache
          const dashboardCache = sessionStorage.getItem('dashboard_cache_v2');
          if (dashboardCache) {
            try {
              const cache = JSON.parse(dashboardCache);
              if (cache.products?.data?.products?.length > 0) {
                const age = Date.now() - cache.products.timestamp;
                if (age < 30 * 60 * 1000) { // 30 minutes
                  finalProductId = cache.products.data.products[0].id?.toString();
                  console.log('Using product from dashboard cache:', finalProductId);
                }
              }
            } catch (error) {
              console.warn('Failed to parse dashboard cache:', error);
            }
          }
          
          // If still no product, try to fetch from API with better error handling
          if (!finalProductId) {
            try {
              console.log('Fetching products from API for competitor addition');
              const response = await fetch(`${API_BASE_URL}/api/analytics/products`, {
                credentials: 'include',
              });
              
              if (response.ok) {
                const data = await response.json();
                if (data.products?.length > 0) {
                  finalProductId = data.products[0].id?.toString();
                  console.log('Using product from API:', finalProductId);
                  
                  // Update dashboard cache with fresh data
                  const cacheData = {
                    products: {
                      data: data,
                      timestamp: Date.now()
                    }
                  };
                  sessionStorage.setItem('dashboard_cache_v2', JSON.stringify(cacheData));
                } else {
                  console.log('No products found in API response');
                }
              } else {
                console.log('Products API returned status:', response.status);
              }
            } catch (error) {
              console.error('Failed to fetch products:', error);
            }
          }
        }
        
        // Add competitor with intelligent product handling
        newCompetitor = await addCompetitor(url.trim(), finalProductId || '');
        setCompetitors((prev) => [...prev, newCompetitor]);
        
        // Clear cache to ensure fresh data on next load
        const cacheKey = `competitors_${shop}`;
        cache.delete(cacheKey);
        
        notifications.showSuccess('Competitor added successfully', {
          category: 'Competitors'
        });
      }
      
      setUrl('');
      setProductId('');
      setShowAddForm(false);
    } catch (error: any) {
      console.error('handleAdd error:', error);
      
      // Enhanced error handling with user-friendly messages
      let userMessage = 'Failed to add competitor. Please try again.';
      let needsProductSync = false;
      
      // Check for specific error conditions
      if (error?.response?.status === 412 || 
          error?.response?.data?.error === 'PRODUCTS_SYNC_NEEDED' ||
          error?.needsProductSync) {
        userMessage = 'Syncing your product catalog... Please try adding the competitor again in a moment.';
        needsProductSync = true;
      } else if (error.message) {
        userMessage = error.message;
      }
      
      // Never show raw JSON to users - additional safeguard
      if (userMessage.includes('{') && userMessage.includes('}')) {
        userMessage = 'Unable to add competitor at this time. Please try again in a moment.';
        needsProductSync = true;
      }
      
      // If product sync is needed, trigger it automatically
      if (needsProductSync) {
        // Trigger product sync in background with better feedback
        notifications.showInfo('Syncing your product catalog in the background...', {
          category: 'Competitors',
          persistent: false
        });
        
        fetch(`${API_BASE_URL}/api/analytics/products`, {
          credentials: 'include',
        })
        .then(response => {
          if (response.ok) {
            console.log('Background product sync completed successfully');
            // Update cache with fresh data
            return response.json();
          } else {
            console.log('Background product sync failed with status:', response.status);
          }
        })
        .then(data => {
          if (data?.products?.length > 0) {
            const cacheData = {
              products: {
                data: data,
                timestamp: Date.now()
              }
            };
            sessionStorage.setItem('dashboard_cache_v2', JSON.stringify(cacheData));
            console.log('Updated dashboard cache with fresh product data');
          }
        })
        .catch(error => {
          console.error('Background product sync failed:', error);
        });
        
        notifications.showInfo(userMessage, {
          category: 'Competitors',
          persistent: false
        });
      } else {
        notifications.showError(userMessage, {
          category: 'Competitors',
          persistent: false
        });
      }
    } finally {
      setIsAdding(false);
    }
  }, [url, productId, shop, notifications, competitors.length, isDemoMode, navigate]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      if (isDemoMode) {
        setCompetitors((prev) => prev.filter((c) => c.id !== id));
        notifications.showSuccess('Demo competitor removed', {
          category: 'Competitors'
        });
        return;
      }
      
      await deleteCompetitor(id);
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      
      // Clear cache to force refresh
      const cacheKey = `competitors_${shop}`;
      cache.delete(cacheKey);
      
      notifications.showSuccess('Competitor deleted successfully', {
        category: 'Competitors'
      });
    } catch {
      notifications.showError('Failed to delete competitor', {
        category: 'Competitors'
      });
    }
  }, [isDemoMode, shop, notifications]);

  const refreshSuggestionCount = useCallback(async () => {
    try {
      if (isDemoMode) {
        setSuggestionCount(DEMO_SUGGESTIONS.length);
        return;
      }
      
      // Clear suggestion cache and get fresh count
      const suggestionCacheKey = `suggestions_${shop}`;
      cache.delete(suggestionCacheKey);
      
      const response = await refreshSuggestionCountAPI();
      setSuggestionCount(response.newSuggestions);
    } catch (error) {
      console.error('Error refreshing suggestion count:', error);
      // Fallback to cached or demo data
      if (isDemoMode) {
        setSuggestionCount(DEMO_SUGGESTIONS.length);
      }
    }
  }, [isDemoMode, shop]);

  const toggleDemoMode = useCallback(() => {
    if (isDemoMode) {
      // User explicitly disabled demo mode - immediate state change
      setUserDisabledDemo(true);
      setIsDemoMode(false);
      
      // Persist user preference immediately
      if (shop) {
        localStorage.setItem(`demoDisabled_${shop}`, 'true');
      }
      
      notifications.showSuccess('Switched to Live Mode', {
        category: 'Mode'
      });
      
      // Load real data without conflicting with mode state
      fetchData(true).then(() => {
        // Ensure we stay in live mode even if no data
        if (userDisabledDemo) {
          setIsDemoMode(false);
        }
      });
      
      // Set empty state immediately to show live mode is active
      setCompetitors([]);
      setSuggestionCount(0);
      
    } else {
      // User explicitly enabled demo mode
      setUserDisabledDemo(false);
      setIsDemoMode(true);
      setCompetitors(DEMO_COMPETITORS);
      setSuggestionCount(DEMO_SUGGESTIONS.length);
      
      // Clear user preference
      if (shop) {
        localStorage.removeItem(`demoDisabled_${shop}`);
      }
      
      notifications.showSuccess('Switched to Demo Mode', {
        category: 'Mode'
      });
    }
  }, [isDemoMode, notifications, fetchData, shop, userDisabledDemo]);

  const triggerManualDiscovery = useCallback(async () => {
    if (isDemoMode) {
      notifications.showInfo('Switch to Live Mode to run competitor discovery', {
        category: 'Discovery'
      });
      return;
    }

    // Check server-side cooldown for cross-device consistency
    const now = Date.now();
    const timeSinceLastDiscovery = now - lastDiscoveryTime;
    
    if (timeSinceLastDiscovery < DISCOVERY_COOLDOWN) {
      const hoursRemaining = Math.ceil((DISCOVERY_COOLDOWN - timeSinceLastDiscovery) / (60 * 60 * 1000));
      const lastDiscoveryDate = new Date(lastDiscoveryTime).toLocaleString();
      notifications.showInfo(`Discovery is available again in ${hoursRemaining} hours. This helps us find the best competitors while managing costs efficiently.`, {
        category: 'Discovery',
        persistent: false
      });
      return;
    }

    setIsDiscovering(true);
    try {
      // First check if discovery service is available
      const statusResponse = await fetch(`${API_BASE_URL}/api/competitors/discovery/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!statusResponse.ok) {
        throw new Error('Discovery service is not available');
      }

      const statusData = await statusResponse.json();
      
      // Check if discovery is enabled
      if (!statusData.enabled) {
        notifications.showError('Competitor discovery is currently disabled. Please contact support.', {
          category: 'Discovery'
        });
        return;
      }

      // Check if we have the required configuration
      if (!statusData.configured) {
        notifications.showError('Competitor discovery is not configured. Please set up your search API credentials.', {
          category: 'Discovery'
        });
        return;
      }

      // Trigger discovery
      const response = await fetch(`${API_BASE_URL}/api/competitors/discovery/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        setLastDiscoveryTime(now);
        // Server-side tracking handles persistence across devices
        console.log(`Discovery triggered for ${shop} at ${new Date(now).toLocaleString()}`);
        
        notifications.showSuccess('Discovery started! Initial results may appear within hours, full analysis completes overnight.', {
          category: 'Discovery'
        });
        
        // Refresh discovery status to show updated cooldown
        try {
          const updatedStatusResponse = await fetch(`${API_BASE_URL}/api/competitors/discovery/status`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });
          
          if (updatedStatusResponse.ok) {
            const updatedStatus = await updatedStatusResponse.json();
            if (updatedStatus.lastDiscoveryTime) {
              setLastDiscoveryTime(new Date(updatedStatus.lastDiscoveryTime).getTime());
            }
          }
        } catch (statusError) {
          console.warn('Failed to refresh discovery status:', statusError);
        }
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Discovery trigger failed';
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Discovery error:', error);
      
      // Provide specific error messages based on error type
      let userMessage = 'Failed to trigger competitor discovery';
      
      if (error.message.includes('not available')) {
        userMessage = 'Discovery service is temporarily unavailable. Please try again later.';
      } else if (error.message.includes('not configured')) {
        userMessage = 'Discovery is not configured. Please set up your search API credentials.';
      } else if (error.message.includes('disabled')) {
        userMessage = 'Competitor discovery is currently disabled. Please contact support.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('timeout')) {
        userMessage = 'Request timed out. Please try again.';
      }
      
      notifications.showError(userMessage, {
        category: 'Discovery'
      });
    } finally {
      setIsDiscovering(false);
    }
  }, [isDemoMode, notifications, lastDiscoveryTime, shop, DISCOVERY_COOLDOWN]);

  // Calculate discovery cooldown status
  const discoveryStatus = useMemo(() => {
    const now = Date.now();
    const timeSinceLastDiscovery = now - lastDiscoveryTime;
    const isOnCooldown = timeSinceLastDiscovery < DISCOVERY_COOLDOWN;
    const hoursRemaining = isOnCooldown ? 
      Math.ceil((DISCOVERY_COOLDOWN - timeSinceLastDiscovery) / (60 * 60 * 1000)) : 0;
    
    return { isOnCooldown, hoursRemaining };
  }, [lastDiscoveryTime, DISCOVERY_COOLDOWN]);

  // Calculate insights with useMemo for performance
  const insights = useMemo(() => {
    const total = filteredCompetitors.length;
    const inStock = filteredCompetitors.filter(c => c.inStock).length;
    const outOfStock = total - inStock;
    const priceChanges = filteredCompetitors.filter(c => c.percentDiff !== 0).length;
    const priceIncreases = filteredCompetitors.filter(c => c.percentDiff > 0).length;
    const priceDecreases = filteredCompetitors.filter(c => c.percentDiff < 0).length;
    const validPrices = filteredCompetitors.filter(c => c.price > 0);
    const avgPrice = validPrices.length > 0 ? 
      validPrices.reduce((sum, c) => sum + c.price, 0) / validPrices.length : 0;

    return {
      total,
      inStock,
      outOfStock,
      priceChanges,
      priceIncreases,
      priceDecreases,
      avgPrice: isNaN(avgPrice) ? 0 : avgPrice
    };
  }, [filteredCompetitors]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Market Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Competitors</p>
                <p className="text-2xl font-bold text-gray-900">{insights.total}</p>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Stock</p>
                <p className="text-2xl font-bold text-green-600">{insights.inStock}</p>
              </div>
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Price Changes</p>
                <p className="text-2xl font-bold text-orange-600">{insights.priceChanges}</p>
              </div>
              <div className="bg-orange-100 p-2 rounded-lg">
                <BoltIcon className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Price</p>
                <p className="text-2xl font-bold text-purple-600">
                  {insights.avgPrice > 0 ? `$${insights.avgPrice.toFixed(2)}` : 'N/A'}
                </p>
              </div>
              <div className="bg-purple-100 p-2 rounded-lg">
                <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Demo Mode Notice */}
        {isDemoMode && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <EyeIcon className="h-6 w-6 text-orange-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-orange-800">Demo Mode Active</h3>
                <p className="text-orange-700">
                  Showing sample competitor data. Configure your search API to enable live competitor discovery and price monitoring.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Control Panel */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left side - Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-5 w-5 text-gray-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="all">All Competitors</option>
                  <option value="inStock">In Stock Only</option>
                  <option value="outOfStock">Out of Stock</option>
                </select>
              </div>
              
              <div className="flex-1 relative min-w-64">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search competitors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                />
              </div>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Demo Mode Toggle */}
              <button
                onClick={toggleDemoMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isDemoMode 
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isDemoMode ? <PlayIcon className="h-4 w-4" /> : <StopIcon className="h-4 w-4" />}
                {isDemoMode ? 'Demo' : 'Live'}
              </button>

              {/* Manual Discovery Button with 24hr Cooldown */}
              <button
                onClick={triggerManualDiscovery}
                disabled={isDiscovering || discoveryStatus.isOnCooldown}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md ${
                  discoveryStatus.isOnCooldown 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
                title={discoveryStatus.isOnCooldown 
                  ? `Discovery available in ${discoveryStatus.hoursRemaining} hours. This helps us manage costs while finding the best competitors for you.`
                  : 'Find new competitors automatically using AI-powered market research'
                }
              >
                {isDiscovering ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <MagnifyingGlassIcon className="h-4 w-4" />
                )}
                {isDiscovering 
                  ? 'Discovering...' 
                  : discoveryStatus.isOnCooldown
                    ? `${discoveryStatus.hoursRemaining}h`
                    : 'Discover'
                }
              </button>

              {/* Suggestions Button */}
              {suggestionCount > 0 && (
                <button
                  onClick={() => setShowSuggestions(true)}
                  className="relative flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-md"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>{suggestionCount} New</span>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                </button>
              )}

              {/* Add Competitor Button */}
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all shadow-md"
              >
                <PlusIcon className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Competitor URL (e.g., https://amazon.com/dp/...)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition"
                  required
                />
                <input
                  type="text"
                  placeholder="Product ID (optional)"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition"
                />
                <button 
                  type="submit" 
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-all shadow-md"
                >
                  Add
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-gray-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Competitors Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Market Intelligence</h2>
              <div className="text-sm text-gray-500">
                {filteredCompetitors.length} of {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredCompetitors.length === 0 ? (
            <div className="text-center py-16">
              <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {competitors.length === 0 ? 'No competitors yet' : 'No matches found'}
              </h3>
              <p className="text-gray-500 mb-4">
                {competitors.length === 0 
                  ? 'Start tracking your competitors to monitor their pricing strategies.'
                  : 'Try adjusting your filters or search query.'
                }
              </p>
              {competitors.length === 0 && !isDemoMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 max-w-md mx-auto">
                  <p className="text-sm text-amber-800">
                    💡 <strong>Tip:</strong> If you get a "sync products" message, visit your Dashboard first to load your Shopify products.
                  </p>
                </div>
              )}
              {competitors.length === 0 && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all shadow-md"
                >
                  Add Your First Competitor
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <CompetitorTable data={filteredCompetitors} onDelete={handleDelete} />
            </div>
          )}
        </div>
      </div>
      
      <SuggestionDrawer
        isOpen={showSuggestions}
        onClose={() => setShowSuggestions(false)}
        onSuggestionUpdate={refreshSuggestionCount}
        isDemoMode={isDemoMode}
        demoSuggestions={DEMO_SUGGESTIONS}
      />
    </div>
  );
}
