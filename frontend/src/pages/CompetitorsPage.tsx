import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { CompetitorTable } from '../components/ui/CompetitorTable';
import type { Competitor } from '../components/ui/CompetitorTable';
import { SuggestionDrawer } from '../components/ui/SuggestionDrawer';
import { 
  getCompetitors, 
  deleteCompetitor,
  getDebouncedSuggestionCount,
  refreshSuggestionCount as refreshSuggestionCountAPI,
  addCompetitorIntelligent
} from '../api';
import { marketIntelligenceAPI, type LimitsResponse } from '../api/marketIntelligence';
import { useAuth } from '../context/AuthContext';
import { 
  SparklesIcon, 
  PlusIcon, 
  ChartBarIcon,
  PlayIcon,
  StopIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  FunnelIcon,
  AcademicCapIcon,
  CogIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useNotifications } from '../hooks/useNotifications';
import { fetchWithAuth } from '../api/index';
import { useNavigate } from 'react-router-dom';
import Joyride from 'react-joyride';
import type { CallBackProps, Step } from 'react-joyride';
import ThemedJoyrideTooltip from '../components/ui/ThemedJoyrideTooltip';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { debugLog } from '../components/ui/DebugPanel';
import { getSuggestionCount } from '../api';

// Tutorial step types
interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector for highlighting
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
}

// Demo customization types
interface DemoPreferences {
  category: 'electronics' | 'fashion' | 'home' | 'books' | 'random';
  priceRange: 'low' | 'medium' | 'high' | 'mixed';
  competitors: number;
  includeOutOfStock: boolean;
}

// Demo analytics types
interface DemoAnalytics {
  timeSpent: number;
  interactions: number;
  featuresUsed: string[];
  tutorialCompleted: boolean;
  lastUsed: Date;
}

// Tutorial steps for guided tour
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Market Intelligence!',
    description: 'This feature helps you monitor your competitors\' pricing and discover new market opportunities.',
    target: 'body', // Changed from '.market-insights-cards' to 'body' for no highlight
    position: 'center' // Changed from 'bottom' to 'center' for modal style
  },
  {
    id: 'insights',
    title: 'Market Insights',
    description: 'Get a quick overview of your competitive landscape with these key metrics.',
    target: '.market-insights-cards',
    position: 'bottom'
  },
  {
    id: 'filters',
    title: 'Filter & Search',
    description: 'Use filters to focus on specific competitors or search for particular products.',
    target: '.filter-controls',
    position: 'bottom'
  },
  {
    id: 'demo-toggle',
    title: 'Demo Mode',
    description: 'Switch between demo and live modes. Demo mode shows sample data for exploration.',
    target: '.demo-toggle-button',
    position: 'bottom'
  },
  {
    id: 'discovery',
    title: 'AI-Powered Discovery',
    description: 'Automatically find new competitors using our AI-powered market research.',
    target: '.discovery-button',
    position: 'bottom'
  },
  {
    id: 'suggestions',
    title: 'Competitor Suggestions',
    description: 'Review AI-suggested competitors and add them to your monitoring list.',
    target: '.suggestions-button',
    position: 'bottom'
  },
  {
    id: 'add-competitor',
    title: 'Add Competitors',
    description: 'Manually add competitors by entering their product URLs. Click the info icon to see supported URL formats for major e-commerce platforms.',
    target: '.add-competitor-button',
    position: 'bottom'
  },
  {
    id: 'table',
    title: 'Competitor Table',
    description: 'View detailed pricing information, stock status, and price changes for all your competitors.',
    target: '.competitor-table',
    position: 'top'
  }
];

// Default demo preferences
const DEFAULT_DEMO_PREFERENCES: DemoPreferences = {
  category: 'electronics',
  priceRange: 'mixed',
  competitors: 8,
  includeOutOfStock: true
};

// Demo data by category
const DEMO_DATA_BY_CATEGORY = {
  electronics: {
    competitors: [
      {
        id: '1',
        url: 'https://amazon.com/dp/B08N5WRWNW',
        label: 'Amazon - Echo Dot (4th Gen) Smart Speaker',
        price: 49.99,
        inStock: true,
        percentDiff: 0,
        lastChecked: '2 hours ago'
      },
      {
        id: '2',
        url: 'https://amazon.com/dp/B08C7W5L7D',
        label: 'Amazon - Fire TV Stick 4K Max',
        price: 39.99,
        inStock: true,
        percentDiff: -15.2,
        lastChecked: '1 hour ago'
      },
      {
        id: '3',
        url: 'https://bestbuy.com/site/apple-airpods-pro-2nd-generation-white/6509650.p',
        label: 'Best Buy - Apple AirPods Pro (2nd Gen)',
        price: 249.99,
        inStock: true,
        percentDiff: -5.0,
        lastChecked: '45 minutes ago'
      },
      {
        id: '4',
        url: 'https://walmart.com/ip/Samsung-65-Class-4K-UHD-QLED-Tizen-Smart-TV/123456789',
        label: 'Walmart - Samsung 65" 4K QLED Smart TV',
        price: 899.99,
        inStock: true,
        percentDiff: 12.3,
        lastChecked: '1 hour ago'
      }
    ],
    suggestions: [
      {
        id: 1,
        suggestedUrl: 'https://amazon.com/dp/B09B9Y6Y7H',
        title: 'Amazon - Echo Dot (5th Gen) Smart Speaker with Alexa',
        price: 49.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T10:30:00Z',
        status: 'NEW'
      },
      {
        id: 2,
        suggestedUrl: 'https://bestbuy.com/site/apple-airpods-3rd-generation-white/6478578.p',
        title: 'Best Buy - Apple AirPods (3rd Generation)',
        price: 179.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T07:30:00Z',
        status: 'NEW'
      }
    ]
  },
  fashion: {
    competitors: [
      {
        id: '1',
        url: 'https://nike.com/t/air-force-1-07-shoe-GjGXSP',
        label: 'Nike - Air Force 1 07 Sneaker',
        price: 100.00,
        inStock: true,
        percentDiff: 0,
        lastChecked: '2 hours ago'
      },
      {
        id: '2',
        url: 'https://adidas.com/us/ultraboost-22-shoes/GZ0127.html',
        label: 'Adidas - Ultraboost 22 Running Shoes',
        price: 190.00,
        inStock: true,
        percentDiff: -10.5,
        lastChecked: '1 hour ago'
      },
      {
        id: '3',
        url: 'https://zara.com/us/en/oversized-blazer-p01234567.html',
        label: 'Zara - Oversized Blazer',
        price: 89.90,
        inStock: false,
        percentDiff: 0,
        lastChecked: '30 minutes ago'
      },
      {
        id: '4',
        url: 'https://h&m.com/us/en/product/relaxed-fit-t-shirt-12345678',
        label: 'H&M - Relaxed Fit T-Shirt',
        price: 19.99,
        inStock: true,
        percentDiff: 5.2,
        lastChecked: '15 minutes ago'
      }
    ],
    suggestions: [
      {
        id: 1,
        suggestedUrl: 'https://nike.com/t/air-max-270-shoe-KkLcGR',
        title: 'Nike - Air Max 270 Sneaker',
        price: 150.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T10:30:00Z',
        status: 'NEW'
      },
      {
        id: 2,
        suggestedUrl: 'https://adidas.com/us/stan-smith-shoes/FV3968.html',
        title: 'Adidas - Stan Smith Sneakers',
        price: 100.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T09:15:00Z',
        status: 'NEW'
      }
    ]
  },
  home: {
    competitors: [
      {
        id: '1',
        url: 'https://ikea.com/us/en/p/hemnes-bed-frame-white-stain-80263875/',
        label: 'IKEA - HEMNES Bed Frame',
        price: 299.00,
        inStock: true,
        percentDiff: 0,
        lastChecked: '2 hours ago'
      },
      {
        id: '2',
        url: 'https://wayfair.com/furniture/pdp/mercury-row-ayden-72-bookcase-w000123456.html',
        label: 'Wayfair - Ayden 72" Bookcase',
        price: 449.99,
        inStock: true,
        percentDiff: -8.3,
        lastChecked: '1 hour ago'
      },
      {
        id: '3',
        url: 'https://westelm.com/products/modern-leather-sofa-H1234567/',
        label: 'West Elm - Modern Leather Sofa',
        price: 1299.00,
        inStock: false,
        percentDiff: 0,
        lastChecked: '30 minutes ago'
      },
      {
        id: '4',
        url: 'https://cb2.com/furniture/sofas-sectionals/sofas/c-scape-sofa/s1234567.html',
        label: 'CB2 - C-Scape Sofa',
        price: 899.00,
        inStock: true,
        percentDiff: 12.1,
        lastChecked: '15 minutes ago'
      }
    ],
    suggestions: [
      {
        id: 1,
        suggestedUrl: 'https://ikea.com/us/en/p/malm-bed-frame-high-white-stain-80263875/',
        title: 'IKEA - MALM Bed Frame High',
        price: 199.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T10:30:00Z',
        status: 'NEW'
      },
      {
        id: 2,
        suggestedUrl: 'https://wayfair.com/furniture/pdp/mercury-row-ayden-48-bookcase-w000123457.html',
        title: 'Wayfair - Ayden 48" Bookcase',
        price: 299.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T09:15:00Z',
        status: 'NEW'
      }
    ]
  },
  books: {
    competitors: [
      {
        id: '1',
        url: 'https://amazon.com/dp/014312755X',
        label: 'Amazon - The Great Gatsby (Paperback)',
        price: 12.99,
        inStock: true,
        percentDiff: 0,
        lastChecked: '2 hours ago'
      },
      {
        id: '2',
        url: 'https://barnesandnoble.com/w/to-kill-a-mockingbird-harper-lee/1100170896',
        label: 'Barnes & Noble - To Kill a Mockingbird',
        price: 14.99,
        inStock: true,
        percentDiff: -5.2,
        lastChecked: '1 hour ago'
      },
      {
        id: '3',
        url: 'https://booksamillion.com/p/1984/George-Orwell/9780451524935',
        label: 'Books-A-Million - 1984 (Paperback)',
        price: 9.99,
        inStock: false,
        percentDiff: 0,
        lastChecked: '30 minutes ago'
      },
      {
        id: '4',
        url: 'https://target.com/p/the-hobbit-j-r-r-tolkien-paperback/-/A-123456',
        label: 'Target - The Hobbit (Paperback)',
        price: 11.99,
        inStock: true,
        percentDiff: 8.7,
        lastChecked: '15 minutes ago'
      }
    ],
    suggestions: [
      {
        id: 1,
        suggestedUrl: 'https://amazon.com/dp/0743273567',
        title: 'Amazon - The Catcher in the Rye (Paperback)',
        price: 13.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T10:30:00Z',
        status: 'NEW'
      },
      {
        id: 2,
        suggestedUrl: 'https://barnesandnoble.com/w/lord-of-the-flies-william-golding/1100170897',
        title: 'Barnes & Noble - Lord of the Flies',
        price: 12.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T09:15:00Z',
        status: 'NEW'
      }
    ]
  },
  random: {
    competitors: [
      {
        id: '1',
        url: 'https://amazon.com/dp/B08N5WRWNW',
        label: 'Amazon - Echo Dot (4th Gen) Smart Speaker',
        price: 49.99,
        inStock: true,
        percentDiff: 0,
        lastChecked: '2 hours ago'
      },
      {
        id: '2',
        url: 'https://nike.com/t/air-force-1-07-shoe-GjGXSP',
        label: 'Nike - Air Force 1 07 Sneaker',
        price: 100.00,
        inStock: true,
        percentDiff: -10.5,
        lastChecked: '1 hour ago'
      },
      {
        id: '3',
        url: 'https://ikea.com/us/en/p/hemnes-bed-frame-white-stain-80263875/',
        label: 'IKEA - HEMNES Bed Frame',
        price: 299.00,
        inStock: false,
        percentDiff: 0,
        lastChecked: '30 minutes ago'
      },
      {
        id: '4',
        url: 'https://amazon.com/dp/014312755X',
        label: 'Amazon - The Great Gatsby (Paperback)',
        price: 12.99,
        inStock: true,
        percentDiff: 8.7,
        lastChecked: '15 minutes ago'
      }
    ],
    suggestions: [
      {
        id: 1,
        suggestedUrl: 'https://amazon.com/dp/B09B9Y6Y7H',
        title: 'Amazon - Echo Dot (5th Gen) Smart Speaker with Alexa',
        price: 49.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T10:30:00Z',
        status: 'NEW'
      },
      {
        id: 2,
        suggestedUrl: 'https://nike.com/t/air-max-270-shoe-KkLcGR',
        title: 'Nike - Air Max 270 Sneaker',
        price: 150.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T09:15:00Z',
        status: 'NEW'
      }
    ]
  }
};

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

// Helper function to get demo data safely
const getDemoData = (category: DemoPreferences['category']) => {
  return DEMO_DATA_BY_CATEGORY[category] || DEMO_DATA_BY_CATEGORY.electronics;
};

// Helper to map position to Joyride's placement
const mapPositionToPlacement = (position: string) => {
  switch (position) {
    case 'top': return 'top';
    case 'bottom': return 'bottom';
    case 'left': return 'left';
    case 'right': return 'right';
    case 'center': return 'center';
    default: return 'bottom';
  }
};

const JOYRIDE_STEPS: Step[] = TUTORIAL_STEPS.map(step => ({
  target: step.target,
  title: step.title,
  content: step.description,
  placement: mapPositionToPlacement(step.position),
  disableBeacon: true,
}));

export default function CompetitorsPage() {
  const { shop, isAuthenticated, authLoading, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [filteredCompetitors, setFilteredCompetitors] = useState<Competitor[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [url, setUrl] = useState('');
  const [productId, setProductId] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showUrlTooltip, setShowUrlTooltip] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'inStock' | 'outOfStock'>('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  
  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showUrlTooltip && !target.closest('.url-tooltip-container')) {
        setShowUrlTooltip(false);
      }
      if (filterDropdownOpen && !target.closest('.filter-dropdown')) {
        setFilterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUrlTooltip, filterDropdownOpen]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastDiscoveryTime, setLastDiscoveryTime] = useState<number>(0);
  const [userDisabledDemo, setUserDisabledDemo] = useState<boolean>(false);
  const notifications = useNotifications();
  
  // Show helpful message if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isDemoMode && isAuthReady) {
              notifications.showInfo('Connect your Shopify store to initiate competitor tracking', {
          category: 'Competitors',
          persistent: true,
          action: {
            label: 'Connect Store',
            onClick: () => {
              window.location.href = '/';
            }
          }
        });
    }
  }, [isAuthenticated, isDemoMode, isAuthReady, notifications]);
  
  // New state for enhanced demo features
  const [showTutorial, setShowTutorial] = useState(false);
  // Add a ref to prevent duplicate notifications
  const notificationShownRef = useRef(false);

  const [showDemoSettings, setShowDemoSettings] = useState(false);
  const [demoPreferences, setDemoPreferences] = useState<DemoPreferences>(DEFAULT_DEMO_PREFERENCES);
  const [demoAnalytics, setDemoAnalytics] = useState<DemoAnalytics>({
    timeSpent: 0,
    interactions: 0,
    featuresUsed: [],
    tutorialCompleted: false,
    lastUsed: new Date()
  });
  const [interactiveDemoActive, setInteractiveDemoActive] = useState(false);
  const [demoStartTime, setDemoStartTime] = useState<number>(0);
  const [limits, setLimits] = useState<LimitsResponse | null>(null);
  
  // Refs to prevent unnecessary re-renders and API calls
  const lastFetchTimeRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  
  // Discovery cooldown (24 hours per store) - now managed server-side
  const DISCOVERY_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

  // Track if tutorial is running to prevent duplicate notifications
  const [tutorialRunning, setTutorialRunning] = useState(false);



  useEffect(() => {
    setTutorialRunning(showTutorial);
  }, [showTutorial]);

  // Reset notification flag when tutorial is started
  useEffect(() => {
    if (showTutorial) {
      notificationShownRef.current = false;
    }
  }, [showTutorial]);

  // Fetch discovery status from server for cross-device consistency
  const fetchDiscoveryStatus = useCallback(async () => {
    if (!shop) return;
    
    try {
      const response = await fetchWithAuth('/api/competitors/discovery/status');
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

  // Fetch limits for the current shop
  const fetchLimits = useCallback(async () => {
    if (!shop || !isAuthenticated) return;
    
    try {
      const limitsData = await marketIntelligenceAPI.checkLimits();
      setLimits(limitsData);
    } catch (error) {
      console.log('Could not fetch limits from server');
    }
  }, [shop, isAuthenticated]);

  // Optimized data fetching with authentication checks
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!shop || !isAuthenticated || !isAuthReady) {
      console.log('CompetitorsPage: Skipping fetch - no shop, not authenticated, or auth not ready', {
        shop: !!shop,
        isAuthenticated,
        isAuthReady
      });
      
      // Only use demo mode if explicitly not authenticated (not just loading)
      if (isAuthReady && !isAuthenticated && !userDisabledDemo) {
        console.log('CompetitorsPage: Not authenticated, enabling demo mode');
        setIsDemoMode(true);
        setCompetitors(getDemoData(DEFAULT_DEMO_PREFERENCES.category).competitors);
        setSuggestionCount(getDemoData(DEFAULT_DEMO_PREFERENCES.category).suggestions.length);
      }
      
      return;
    }
    
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    
    // Prevent rapid successive calls (debounce) - 24hr cooldown for costly APIs
    if (!forceRefresh && !isInitialLoadRef.current && timeSinceLastFetch < 24 * 60 * 60 * 1000) { // 24 hours
      return;
    }
    
    try {
      const cacheKey = `competitors_${shop}`;
      const suggestionCacheKey = `suggestions_${shop}`;
      
      const [competitorsData, suggestionCountData] = await Promise.all([
        fetchWithCache(cacheKey, getCompetitors, forceRefresh ? 0 : CACHE_DURATION),
        fetchWithCache(suggestionCacheKey, getDebouncedSuggestionCount, forceRefresh ? 0 : SUGGESTION_COUNT_CACHE_DURATION)
      ]);
      
      // Set data first
      console.log('fetchData: Received competitors data:', competitorsData);
      debugLog.info('fetchData: Received competitors data', {
        count: competitorsData.length,
        competitors: competitorsData.map(c => ({ id: c.id, url: c.url, label: c.label }))
      }, 'CompetitorsPage');
      setCompetitors(competitorsData);
      setSuggestionCount(suggestionCountData.newSuggestions);
      
      // Handle demo mode logic - respect user preference above all
      console.log(`fetchData: authenticated=${isAuthenticated}, userDisabledDemo=${userDisabledDemo}, competitorsData.length=${competitorsData.length}, suggestionCountData.newSuggestions=${suggestionCountData.newSuggestions}`);
      
      if (userDisabledDemo) {
        // User explicitly disabled demo - stay in live mode regardless of data
        console.log('fetchData: User explicitly disabled demo, staying in Live Mode');
        if (isDemoMode) {
          setIsDemoMode(false);
        }
      } else if (isAuthenticated && (competitorsData.length > 0 || suggestionCountData.newSuggestions > 0)) {
        // Has data and authenticated - use live mode
        if (isDemoMode) {
          console.log('fetchData: Authenticated with data, switching to Live Mode');
          setIsDemoMode(false);
        }
      } else if (isAuthenticated && competitorsData.length === 0 && suggestionCountData.newSuggestions === 0) {
        // Authenticated but no data - default to demo mode unless user explicitly disabled it
        console.log('fetchData: Authenticated but no data available, defaulting to Demo Mode');
        if (!isDemoMode) {
          setIsDemoMode(true);
          setCompetitors(getDemoData(DEFAULT_DEMO_PREFERENCES.category).competitors);
          setSuggestionCount(getDemoData(DEFAULT_DEMO_PREFERENCES.category).suggestions.length);
        }
      }
      
      lastFetchTimeRef.current = now;
      isInitialLoadRef.current = false;
      
    } catch (e) {
      console.error('fetchData: API error:', e);
      
      // Only auto-enable demo mode on API failure if user hasn't explicitly disabled it AND not authenticated
      if (!userDisabledDemo && !isAuthenticated) {
        console.log('fetchData: API failed and not authenticated, enabling Demo Mode');
        setIsDemoMode(true);
        setCompetitors(getDemoData(DEFAULT_DEMO_PREFERENCES.category).competitors);
        setSuggestionCount(getDemoData(DEFAULT_DEMO_PREFERENCES.category).suggestions.length);
      } else {
        console.log('fetchData: API failed but authenticated or demo disabled, showing error state');
      }
    }
  }, [shop, isAuthenticated, isAuthReady, fetchWithCache, userDisabledDemo, isDemoMode]);

  // Clear error states on component mount to prevent persistence from previous navigation
  useEffect(() => {
    // Clear any persistent error notifications when component mounts
    console.log('CompetitorsPage: Cleared error states on mount');
  }, []); // Empty dependency array - only run on mount

  // Initialize discovery status from server and user preferences from localStorage
  useEffect(() => {
    if (shop) {
      // Fetch discovery status from server (cross-device consistency)
      fetchDiscoveryStatus();
      
      // Fetch limits for the current shop
      fetchLimits();
      
      // Check if user explicitly disabled demo mode for this shop
      const demoDisabled = localStorage.getItem(`demoDisabled_${shop}`);
      if (demoDisabled === 'true') {
        setUserDisabledDemo(true);
        console.log(`Demo mode disabled by user for shop: ${shop}`);
      }
    }
  }, [shop, fetchLimits]);

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
      notifications.showError('Please provide a valid competitor URL to begin tracking', {
        category: 'Competitors'
      });
      return;
    }

    // Enhanced URL validation for better user guidance
    const trimmedUrl = url.trim();
    if (trimmedUrl.includes('amazon.com') && !trimmedUrl.includes('/dp/') && !trimmedUrl.includes('/gp/product/')) {
      notifications.showError('Please provide a direct Amazon product page URL (should contain /dp/ or /gp/product/)', {
        category: 'Competitors'
      });
      return;
    }

    setIsAdding(true);
    try {
      let newCompetitor: Competitor;
      
      // Check limits before adding competitor (only in live mode)
      if (!isDemoMode && limits) {
        if (!limits.competitorLimit.canAdd) {
          notifications.showError(limits.competitorLimit.message || 'Competitor limit reached', {
            category: 'Competitors'
          });
          return;
        }
      }
      
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
        notifications.showSuccess('Demo competitor has been added to tracking', {
          category: 'Competitors'
        });
      } else {
        // Intelligent competitor addition - let backend handle product selection
        let finalProductId = productId;
        
        // If no productId provided, let backend select from Redis cache
        if (!finalProductId) {
          console.log('No productId provided, letting backend select product from cache');
        }
        
        // Add competitor with intelligent product handling
        newCompetitor = await addCompetitorIntelligent(url.trim(), finalProductId);
        setCompetitors((prev) => [...prev, newCompetitor]);
      
        // Clear cache to ensure fresh data on next load
        const cacheKey = `competitors_${shop}`;
        cache.delete(cacheKey);
        
        // Show success notification immediately
        notifications.showSuccess('Competitor has been added successfully. Price data will be updated within the next 12 hours.', {
          category: 'Competitors'
        });
        
        // If we were in demo mode and successfully added a real competitor, switch to live mode
        if (isDemoMode) {
          console.log('Successfully added real competitor, switching from Demo to Live Mode');
          setIsDemoMode(false);
          setUserDisabledDemo(true);
          if (shop) {
            localStorage.setItem(`demoDisabled_${shop}`, 'true');
          }
        }
        
        // Clear form and close after success
        setUrl('');
        setProductId('');
        setShowAddForm(false);
      }
    } catch (error: any) {
      console.error('handleAdd error:', error);
      
      // Log error to debug panel for production debugging
      debugLog.error('Competitor addition failed', {
        error: error.message,
        errorType: error.constructor.name,
        needsProductSync: error.needsProductSync,
        userFriendly: error.userFriendly,
        url: url,
        productId: productId
      }, 'CompetitorsPage');
      
      // Enhanced error handling with enterprise-grade messages
      let userMessage = 'Unable to initiate competitor tracking at this time. Please try again.';
      let needsProductSync = false;
      let needsAuthentication = false;
      
      if (error.needsProductSync) {
        needsProductSync = true;
        userMessage = 'Product catalog synchronization is required before initiating competitor tracking. Please synchronize your product catalog first.';
        debugLog.info('Detected PRODUCTS_SYNC_NEEDED error - user needs to sync products', {
          error: error.message,
          url: url
        }, 'CompetitorsPage');
      } else if (error.message?.includes('Authentication required') || error.message?.includes('401') || error.message?.includes('Authentication required. Please connect your Shopify store')) {
        needsAuthentication = true;
        userMessage = 'Store authentication is required to initiate competitor tracking. Please connect your Shopify store first.';
        debugLog.warn('Authentication required for competitor addition', {
          error: error.message,
          url: url,
          errorType: error.constructor.name
        }, 'CompetitorsPage');
      } else if (error.message?.includes('already being monitored')) {
        userMessage = 'This competitor is already under active tracking for your product catalog.';
        debugLog.info('Competitor already being monitored', {
          error: error.message,
          url: url
        }, 'CompetitorsPage');
      } else if (error.message?.includes('limit')) {
        userMessage = 'You have reached the maximum competitor tracking limit for your current subscription tier.';
        debugLog.warn('Competitor limit reached', {
          error: error.message,
          url: url
        }, 'CompetitorsPage');
      } else if (error.message?.includes('Invalid URL') || error.message?.includes('Unsupported platform')) {
        userMessage = 'Please provide a valid competitor URL from a supported platform (Amazon, Best Buy, Shopify, etc.). Make sure it\'s a product page, not a search or category page.';
        debugLog.warn('Invalid competitor URL provided', {
          error: error.message,
          url: url,
          errorType: error.constructor.name
        }, 'CompetitorsPage');
      } else if (error.message?.includes('Connection issue') || error.message?.includes('fetch') || error.message?.includes('Network Error') || error.message?.includes('cancelled') || error.message?.includes('timeout') || error.name === 'AbortError') {
        userMessage = 'Request timed out. Please try again.';
        debugLog.error('Request cancelled/timeout', {
          error: error.message,
          errorName: error.name,
          url: url,
          errorType: error.constructor.name
        }, 'CompetitorsPage');
      } else if (error.message?.includes('session has expired')) {
        userMessage = 'Your session has expired. Please refresh the page and re-authenticate.';
        debugLog.warn('Session expired during competitor addition', {
          error: error.message,
          url: url
        }, 'CompetitorsPage');
      } else if (error.message?.includes('Too many requests')) {
        userMessage = 'Rate limit exceeded. Please wait a moment before retrying.';
        debugLog.warn('Rate limit exceeded for competitor addition', {
          error: error.message,
          url: url
        }, 'CompetitorsPage');
      } else if (error.message?.includes('temporarily unavailable')) {
        userMessage = 'Service is temporarily unavailable. Please retry in a few moments.';
        debugLog.error('Service temporarily unavailable', {
          error: error.message,
          url: url
        }, 'CompetitorsPage');
      } else if (error.userFriendly) {
        userMessage = error.message;
        debugLog.info('User-friendly error displayed', {
          error: error.message,
          url: url
        }, 'CompetitorsPage');
      }
      
      console.error('Competitor addition failed:', {
        error: error.message,
        needsProductSync,
        needsAuthentication,
        userMessage
      });

      // Show appropriate notification based on error type
      if (needsAuthentication) {
        debugLog.info('Showing authentication error notification');
        notifications.showError('Store Authentication Required', {
          category: 'Competitors',
          persistent: true,
          action: {
            label: 'Connect Store',
            onClick: () => {
              window.location.href = '/';
            }
          }
        });
        notifications.showInfo('To initiate competitor tracking, you must first authenticate your Shopify store. Click "Connect Store" above or visit the home page to authenticate.', {
          category: 'Competitors',
          persistent: false,
          duration: 8000
        });
      } else if (needsProductSync) {
        debugLog.info('Showing product sync error notification');
        notifications.showError('Product Catalog Synchronization Required', {
            category: 'Competitors',
          persistent: true,
          action: {
            label: 'Sync Products',
            onClick: () => {
              navigate('/dashboard?sync_products=true');
            }
          }
        });
        notifications.showInfo('To initiate competitor tracking, you must first synchronize your product catalog. Click "Sync Products" above or visit your Dashboard to refresh your product data.', {
            category: 'Competitors',
          persistent: false,
          duration: 8000
        });
      } else {
        debugLog.info('Showing generic error notification', {
          message: userMessage
        }, 'CompetitorsPage');
        notifications.showError(userMessage, {
          category: 'Competitors',
          showToast: true // Force toast to show for errors
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
        notifications.showSuccess('Demo competitor has been removed from tracking', {
          category: 'Competitors'
        });
        return;
      }
      
      // Call API first, then update UI only on success
      await deleteCompetitor(id);
      
      // Only update UI after successful API call
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      
      // Clear cache to force refresh
      const cacheKey = `competitors_${shop}`;
      cache.delete(cacheKey);
      
      notifications.showSuccess('Competitor tracking has been discontinued', {
        category: 'Competitors'
      });
    } catch (error) {
      console.error('Delete competitor error:', error);
      debugLog.error('Delete competitor failed', { 
        competitorId: id, 
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }, 'CompetitorsPage');
      
      notifications.showError('Unable to discontinue competitor tracking at this time. Please try again.', {
        category: 'Competitors'
      });
    }
  }, [isDemoMode, shop, notifications]);

  // Fetch suggestion count with debouncing and caching
  const getDebouncedSuggestionCount = useCallback(async () => {
    try {
      debugLog.info('Fetching suggestion count', { shop, isDemoMode }, 'CompetitorsPage');
      
      if (isDemoMode) {
        const demoCount = getDemoData(DEFAULT_DEMO_PREFERENCES.category).suggestions.length;
        debugLog.info('Demo mode: returning demo suggestion count', { demoCount }, 'CompetitorsPage');
        return { newSuggestions: demoCount };
      }
      
      const response = await getSuggestionCount();
      debugLog.info('Suggestion count response', { 
        newSuggestions: response.newSuggestions,
        response 
      }, 'CompetitorsPage');
      return response;
    } catch (error) {
      debugLog.error('Error fetching suggestion count', { error, shop }, 'CompetitorsPage');
      return { newSuggestions: 0 };
    }
  }, [shop, isDemoMode]);

  // Refresh suggestion count (for manual refresh)
  const refreshSuggestionCount = useCallback(async () => {
    try {
      debugLog.info('Refreshing suggestion count', { shop, isDemoMode }, 'CompetitorsPage');
      
      if (isDemoMode) {
        const demoCount = getDemoData(DEFAULT_DEMO_PREFERENCES.category).suggestions.length;
        debugLog.info('Demo mode: setting demo suggestion count', { demoCount }, 'CompetitorsPage');
        setSuggestionCount(demoCount);
        return;
      }
      
      const response = await refreshSuggestionCountAPI();
      debugLog.info('Refreshed suggestion count', { 
        newSuggestions: response.newSuggestions,
        response 
      }, 'CompetitorsPage');
      setSuggestionCount(response.newSuggestions);
    } catch (error) {
      debugLog.error('Error refreshing suggestion count', { error, shop }, 'CompetitorsPage');
      // Fallback to demo data if in demo mode
      if (isDemoMode) {
        setSuggestionCount(getDemoData(DEFAULT_DEMO_PREFERENCES.category).suggestions.length);
      }
    }
  }, [shop, isDemoMode]);

  // Limit display component
  const LimitDisplay = () => {
    if (isDemoMode || !limits) return null;

    const { competitorLimit, suggestionLimit, discoveryLimit } = limits;
    
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <InformationCircleIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-medium text-blue-900">Usage Limits</h3>
          </div>
          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
            {competitorLimit.tier.toUpperCase()} TIER
          </span>
        </div>
        
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">
              {competitorLimit.currentCount}/{competitorLimit.limit}
            </div>
            <div className="text-xs text-blue-600">Competitors</div>
            {competitorLimit.message && (
              <div className="text-xs text-blue-500 mt-1">{competitorLimit.message}</div>
            )}
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">
              {suggestionLimit.currentCount}/{suggestionLimit.limit}
            </div>
            <div className="text-xs text-blue-600">Suggestions</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">
              {discoveryLimit.productCount}/{discoveryLimit.maxProducts}
            </div>
            <div className="text-xs text-blue-600">Products</div>
          </div>
        </div>
        
        {competitorLimit.currentCount >= competitorLimit.limit * 0.8 && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            ⚠️ You're approaching your competitor limit. Consider upgrading for unlimited tracking.
          </div>
        )}
      </div>
    );
  };

  const toggleDemoMode = useCallback(() => {
    console.log(`Demo Mode Toggle: Current state: ${isDemoMode ? 'Demo' : 'Live'}, switching to: ${isDemoMode ? 'Live' : 'Demo'}`);
    
    if (isDemoMode) {
      // User explicitly switching from Demo to Live mode
      console.log('User explicitly switching to Live Mode');
      
      // Set all state changes together to prevent flickering
      setUserDisabledDemo(true);
      setIsDemoMode(false);
      setCompetitors(getDemoData(DEFAULT_DEMO_PREFERENCES.category).competitors);
      setSuggestionCount(getDemoData(DEFAULT_DEMO_PREFERENCES.category).suggestions.length);
      
      // Persist user preference immediately
      if (shop) {
        localStorage.setItem(`demoDisabled_${shop}`, 'true');
        console.log(`Persisted demoDisabled preference for shop: ${shop}`);
      }
      
      notifications.showSuccess('Switched to Live Mode - Real competitor tracking enabled', {
        category: 'Mode'
      });
      
      // Load real data after a brief delay to ensure state is stable
      setTimeout(() => {
        console.log('Loading real data after Live Mode toggle');
        fetchData(true);
      }, 50);
      
    } else {
      // User explicitly switching from Live to Demo mode
      console.log('User explicitly switching to Demo Mode');
      
      // Set all state changes together immediately - no API calls needed
      setUserDisabledDemo(false);
      setIsDemoMode(true);
      setCompetitors(getDemoData(DEFAULT_DEMO_PREFERENCES.category).competitors);
      setSuggestionCount(getDemoData(DEFAULT_DEMO_PREFERENCES.category).suggestions.length);
      
      // Clear user preference
      if (shop) {
        localStorage.removeItem(`demoDisabled_${shop}`);
        console.log(`Removed demoDisabled preference for shop: ${shop}`);
      }
      
      notifications.showSuccess('Switched to Demo Mode - Sample data enabled', {
        category: 'Mode'
      });
      
      // No fetchData call needed for demo mode - everything is already set
    }
  }, [isDemoMode, notifications, fetchData, shop]);

  // Enhanced discovery trigger with better error handling and mobile support
  const triggerManualDiscovery = useCallback(async () => {
    if (isDemoMode) {
      notifications.showInfo('Discovery is not available in demo mode', {
        category: 'Discovery'
      });
      return;
    }

    if (!shop) {
      notifications.showError('No shop connected', {
        category: 'Discovery'
      });
      return;
    }

    const now = Date.now();
    if (now - lastDiscoveryTime < DISCOVERY_COOLDOWN) {
      const hoursRemaining = Math.ceil((DISCOVERY_COOLDOWN - (now - lastDiscoveryTime)) / (60 * 60 * 1000));
      notifications.showError(`Discovery is on cooldown. Please wait ${hoursRemaining} more hours.`, {
        category: 'Discovery'
      });
      return;
    }

    setIsDiscovering(true);

    notifications.showInfo('Starting discovery process...', {
      category: 'Discovery',
      duration: 2000
    });

    try {
      console.log(`[Discovery] Starting discovery process for shop: ${shop}`);
      
      // Step 1: Check configuration with retry
      console.log(`[Discovery] Checking configuration...`);
      let cfg;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[Discovery] Config check attempt ${attempt}/3`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          const cfgRes = await fetchWithAuth('/api/competitors/discovery/config', { signal: controller.signal });
          clearTimeout(timeoutId);

          const responseText = await cfgRes.text();
          console.log(`[Discovery] Config response text:`, responseText);

          try {
            cfg = JSON.parse(responseText);
          } catch (e) {
            console.error('[Discovery] Failed to parse config JSON:', e);
            if (attempt === 3) throw new Error('Invalid configuration response from server.');
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          if (!cfgRes.ok) {
            console.error(`[Discovery] Config check failed: ${cfgRes.status} ${cfgRes.statusText}`, cfg);
            const errorMessage = cfg.message || cfg.error || `Discovery configuration unavailable (${cfgRes.status})`;
            if (attempt === 3) {
              notifications.showError(errorMessage, { category: 'Discovery' });
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          console.log(`[Discovery] Configuration received:`, cfg);
          break;
        } catch (error) {
          console.error(`[Discovery] Config check attempt ${attempt} failed:`, error);
          if (attempt === 3) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
      
      if (!cfg) {
        console.error('[Discovery] Final config check failed, cfg is undefined');
        notifications.showError('Could not retrieve discovery configuration.', { category: 'Discovery' });
        return;
      }
      
      if (cfg.error) {
        console.error(`[Discovery] Configuration error:`, cfg.error);
        notifications.showError(`Discovery error: ${cfg.message || cfg.error}`, { category: 'Discovery' });
        return;
      }
      
      if (!cfg.enabled) {
        console.warn(`[Discovery] Discovery disabled. Config:`, cfg);
        const errorMessage = cfg.message || 'Competitor discovery is currently disabled. Please contact support.';
        if (cfg.debugInfo) {
          console.error('[Discovery] Debug info:', cfg.debugInfo);
        }
        notifications.showError(errorMessage, { category: 'Discovery' });
        return;
      }
      
      if (!cfg.configured) {
        console.warn(`[Discovery] Discovery not configured. Config:`, cfg);
        const errorMessage = cfg.message || 'Competitor discovery is not configured. Please set up your search API credentials.';
        if (cfg.debugInfo) {
          console.error('[Discovery] Debug info:', cfg.debugInfo);
        }
        notifications.showError(errorMessage, { category: 'Discovery' });
        return;
      }

      console.log(`[Discovery] Configuration valid, triggering discovery...`);

      // Step 2: Trigger discovery with retry
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[Discovery] Trigger attempt ${attempt}/3`);
          const response = await fetchWithAuth('/api/competitors/discovery/trigger', {
            method: 'POST',
            signal: AbortSignal.timeout(30000)
          });
          
          const responseText = await response.text();
          console.log(`[Discovery] Raw trigger response:`, responseText);

          let result;
          try {
            result = JSON.parse(responseText);
          } catch (e) {
            if (response.ok) {
              result = { message: responseText };
            } else {
              throw new Error(responseText || `Discovery trigger failed with status ${response.status}`);
            }
          }

          if (response.ok) {
            console.log(`[Discovery] Successfully triggered:`, result);
            setLastDiscoveryTime(Date.now());
            notifications.showSuccess(result.message || 'Discovery started! Initial results may appear within hours.', { category: 'Discovery' });
            fetchDiscoveryStatus();
            return;
          }
            
          console.error(`[Discovery] Trigger failed: ${response.status} ${response.statusText}`, result);
          const errorMessage = result.message || result.error || 'Discovery trigger failed';
          
          if (response.status === 429 || errorMessage.includes('cooldown')) {
            throw new Error(errorMessage);
          }
          
          if (attempt === 3) {
            throw new Error(errorMessage);
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } catch (error: any) {
          console.error(`[Discovery] Trigger attempt ${attempt} failed:`, error);
          if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            if (attempt === 3) throw new Error('Request timed out. Please check your connection and try again.');
          } else if (attempt === 3) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    } catch (error: any) {
      console.error('[Discovery] Error during discovery process:', error);
      
      let userMessage = 'Failed to trigger competitor discovery';
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        userMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message.includes('not available')) {
        userMessage = 'Discovery service is temporarily unavailable. Please try again later.';
      } else if (error.message.includes('not configured')) {
        userMessage = 'Discovery is not configured. Please set up your search API credentials.';
      } else if (error.message.includes('disabled')) {
        userMessage = 'Competitor discovery is currently disabled. Please contact support.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('401') || error.message.includes('Authentication')) {
        userMessage = 'Authentication error. Please refresh the page and try again.';
      } else if (error.message.includes('429') || error.message.includes('cooldown')) {
        userMessage = 'Discovery is on cooldown. Please wait before trying again.';
      } else if (error.message.includes('body stream already read')) {
        userMessage = 'Request processing error. Please try again.';
      } else {
        userMessage = `Discovery failed: ${error.message}`;
      }
      
      notifications.showError(userMessage, { category: 'Discovery' });
    } finally {
      setIsDiscovering(false);
    }
  }, [isDemoMode, notifications, lastDiscoveryTime, shop, DISCOVERY_COOLDOWN, fetchDiscoveryStatus]);

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

  // Tutorial management functions
  const startTutorial = useCallback(() => {
    setShowTutorial(true);
    setDemoAnalytics(prev => ({
      ...prev,
      tutorialCompleted: false
    }));
  }, []);

  // Demo analytics tracking
  const trackDemoInteraction = useCallback((feature: string) => {
    setDemoAnalytics(prev => ({
      ...prev,
      interactions: prev.interactions + 1,
      featuresUsed: prev.featuresUsed.includes(feature) 
        ? prev.featuresUsed 
        : [...prev.featuresUsed, feature]
    }));
  }, []);

  const startDemoSession = useCallback(() => {
    setDemoStartTime(Date.now());
    setInteractiveDemoActive(true);
    setDemoAnalytics(prev => ({
      ...prev,
      lastUsed: new Date()
    }));
  }, []);

  const endDemoSession = useCallback(() => {
    if (demoStartTime > 0) {
      const sessionTime = Date.now() - demoStartTime;
      setDemoAnalytics(prev => ({
        ...prev,
        timeSpent: prev.timeSpent + sessionTime
      }));
      setDemoStartTime(0);
      setInteractiveDemoActive(false);
    }
  }, [demoStartTime]);

  // Demo preferences management
  const updateDemoPreferences = useCallback((newPreferences: Partial<DemoPreferences>) => {
    const updatedPreferences = { ...demoPreferences, ...newPreferences };
    setDemoPreferences(updatedPreferences);
    
    // Save to localStorage
    if (shop) {
      localStorage.setItem(`demoPreferences_${shop}`, JSON.stringify(updatedPreferences));
    }
    
    // Update demo data if in demo mode
    if (isDemoMode) {
      const newDemoData = getDemoData(updatedPreferences.category);
      setCompetitors(newDemoData.competitors);
      setSuggestionCount(newDemoData.suggestions.length);
    }
    
    trackDemoInteraction('preferences_updated');
  }, [demoPreferences, shop, isDemoMode, trackDemoInteraction]);

  // Load saved preferences on component mount
  useEffect(() => {
    if (shop) {
      // Load demo preferences
      const savedPreferences = localStorage.getItem(`demoPreferences_${shop}`);
      if (savedPreferences) {
        try {
          const parsed = JSON.parse(savedPreferences);
          setDemoPreferences(parsed);
        } catch (error) {
          console.warn('Failed to parse saved demo preferences:', error);
        }
      }
      
      // Load tutorial completion status
      const tutorialCompleted = localStorage.getItem(`tutorialCompleted_${shop}`);
      if (tutorialCompleted === 'true') {
        setDemoAnalytics(prev => ({
          ...prev,
          tutorialCompleted: true
        }));
      }
    }
  }, [shop]);

  // Track demo session time
  useEffect(() => {
    if (isDemoMode && !demoStartTime) {
      startDemoSession();
    } else if (!isDemoMode && demoStartTime) {
      endDemoSession();
    }
  }, [isDemoMode, demoStartTime, startDemoSession, endDemoSession]);

  // Cleanup demo session on unmount
  useEffect(() => {
    return () => {
      if (demoStartTime > 0) {
        endDemoSession();
      }
    };
  }, [demoStartTime, endDemoSession]);

  // Joyride callback handler
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;
    console.log('Market Intelligence Joyride callback:', { action, index, status, type });

    // Prevent duplicate notifications
    if (notificationShownRef.current) return;

    // Handle tutorial completion - only show one notification
    if (status === 'finished') {
      setShowTutorial(false);
      setDemoAnalytics(prev => ({
        ...prev,
        tutorialCompleted: true
      }));
      if (shop) {
        localStorage.setItem(`tutorialCompleted_${shop}`, 'true');
      }
      notificationShownRef.current = true;
      notifications.showSuccess('Tutorial completed! You\'re ready to explore Market Intelligence.', {
        category: 'Tutorial'
      });
    } else if (status === 'skipped') {
      setShowTutorial(false);
      setDemoAnalytics(prev => ({
        ...prev,
        tutorialCompleted: true
      }));
      if (shop) {
        localStorage.setItem(`tutorialCompleted_${shop}`, 'true');
      }
      notificationShownRef.current = true;
      notifications.showInfo('Tutorial skipped. You can restart it anytime from the tutorial button.', {
        category: 'Tutorial'
      });
    } else if (action === 'close') {
      setShowTutorial(false);
      setDemoAnalytics(prev => ({
        ...prev,
        tutorialCompleted: true
      }));
      if (shop) {
        localStorage.setItem(`tutorialCompleted_${shop}`, 'true');
      }
      notificationShownRef.current = true;
      // Don't show notification for close action to avoid duplicates
    }
    // Handle step navigation - let Joyride handle navigation internally
    else if (type === 'step:after' && typeof index === 'number') {
      // Let Joyride handle step navigation - don't interfere
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Limit Display */}
        <LimitDisplay />
        
        {/* Market Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 market-insights-cards">
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
          <div className="relative overflow-hidden rounded-xl border-l-4 border-amber-500 bg-amber-50 p-6 shadow-md">
            <span className="absolute top-0 right-0 mt-2 mr-2 px-2 py-0.5 text-xs font-semibold bg-amber-600 text-white rounded-full shadow">DEMO</span>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <InformationCircleIcon className="h-6 w-6 text-amber-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-amber-800 leading-6">Demo Mode Active</h3>
                <p className="mt-1 text-sm text-amber-700">
                  {isAuthenticated 
                    ? "Showing sample competitor data because no competitors have been added yet. Add your first competitor to start monitoring real market data."
                    : "Showing sample competitor data. Configure your search API to enable live competitor discovery and price monitoring."
                  }
                </p>
                {isAuthenticated && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {/* Primary CTAs */}
                    <button
                      onClick={() => {
                        setShowAddForm(true);
                        trackDemoInteraction('add_competitor_button');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1 text-sm font-medium text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add
                    </button>
                    <button
                      onClick={() => {
                        toggleDemoMode();
                        trackDemoInteraction('switch_to_live_mode');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1 text-sm font-medium text-amber-700 shadow hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                    >
                      Switch to Live Mode
                    </button>

                    {/* Secondary options */}
                    <button
                      onClick={() => {
                        setShowDemoSettings(true);
                        trackDemoInteraction('demo_settings');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 shadow hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                    >
                      <CogIcon className="h-4 w-4" />
                      Customize Demo
                    </button>
                    {!demoAnalytics.tutorialCompleted && (
                      <button
                        onClick={() => {
                          startTutorial();
                          trackDemoInteraction('start_tutorial');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1 text-sm font-medium text-green-700 shadow hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
                      >
                        <AcademicCapIcon className="h-4 w-4" />
                        Start Tutorial
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Control Panel */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left side - Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1 filter-controls">
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-5 w-5 text-gray-500" />
                <div className="relative filter-dropdown">
                  <button
                    onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                    className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-400 outline-none transition-colors"
                  >
                    <span className="text-gray-700">
                      {filterStatus === 'all' && 'All Competitors'}
                      {filterStatus === 'inStock' && 'In Stock Only'}
                      {filterStatus === 'outOfStock' && 'Out of Stock'}
                    </span>
                    <svg 
                      className={`h-4 w-4 text-gray-400 transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {filterDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setFilterStatus('all');
                            setFilterDropdownOpen(false);
                    trackDemoInteraction('filter_status');
                  }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                            filterStatus === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          All Competitors
                        </button>
                        <button
                          onClick={() => {
                            setFilterStatus('inStock');
                            setFilterDropdownOpen(false);
                            trackDemoInteraction('filter_status');
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                            filterStatus === 'inStock' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          In Stock Only
                        </button>
                        <button
                          onClick={() => {
                            setFilterStatus('outOfStock');
                            setFilterDropdownOpen(false);
                            trackDemoInteraction('filter_status');
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                            filterStatus === 'outOfStock' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          Out of Stock
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex-1 relative min-w-64">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) trackDemoInteraction('search_competitors');
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm bg-white hover:bg-gray-50 transition-colors"
                />
              </div>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Demo Mode Toggle */}
              <button
                onClick={() => {
                  toggleDemoMode();
                  trackDemoInteraction('demo_toggle');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all demo-toggle-button ${
                  isDemoMode 
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={isDemoMode 
                  ? 'Switch to Live Mode to monitor real competitor data'
                  : 'Switch to Demo Mode to see sample data'
                }
              >
                {isDemoMode ? <PlayIcon className="h-4 w-4" /> : <StopIcon className="h-4 w-4" />}
                {isDemoMode ? 'Demo' : 'Live'}
              </button>

              {/* Manual Discovery Button with 24hr Cooldown */}
              <button
                onClick={() => {
                  triggerManualDiscovery();
                  trackDemoInteraction('discovery_button');
                }}
                disabled={isDiscovering || discoveryStatus.isOnCooldown}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md discovery-button ${
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
                  onClick={() => {
                    debugLog.info('Suggestions button clicked', { 
                      suggestionCount, 
                      isDemoMode,
                      shop 
                    }, 'CompetitorsPage');
                    setShowSuggestions(true);
                  }}
                  className="relative flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-md suggestions-button"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>{suggestionCount} New</span>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                </button>
              )}

              {/* Add Competitor Button */}
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                disabled={isAdding}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md add-competitor-button ${
                  isAdding 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isAdding ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <PlusIcon className="h-4 w-4" />
                )}
                {isAdding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <div className="relative url-tooltip-container">
                    <input
                      type="text"
                      placeholder="Competitor URL (e.g., https://amazon.com/dp/B07D3HG1SD)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isAdding}
                      className={`w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition text-sm ${
                        isAdding ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                      required
                      onFocus={() => setShowUrlTooltip(true)}
                      onBlur={() => setTimeout(() => setShowUrlTooltip(false), 200)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowUrlTooltip(!showUrlTooltip)}
                      disabled={isAdding}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition-all duration-200 ${
                        showUrlTooltip 
                          ? 'bg-blue-100 text-blue-600 shadow-sm' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      } disabled:opacity-50`}
                      title="Show supported URL formats"
                    >
                      <InformationCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {/* Enhanced URL format tooltip with modern design */}
                  {showUrlTooltip && (
                    <div className="url-tooltip-container absolute z-50 mt-3 w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-2xl sm:left-0 sm:right-auto backdrop-blur-sm">
                      <div className="p-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                              <SparklesIcon className="h-3 w-3 text-white" />
                            </div>
                            <div>
                              <h4 className="text-base font-semibold text-gray-900">Supported Platforms</h4>
                              <p className="text-xs text-gray-500">Copy URLs from these e-commerce sites</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowUrlTooltip(false)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Platform Grid */}
                        <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2">
                          {/* Amazon */}
                          <div className="group relative bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-white">A</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="text-xs font-semibold text-gray-900">Amazon</h5>
                                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">Popular</span>
                                </div>
                                <p className="text-xs text-gray-600 font-mono break-all bg-white px-2 py-1 rounded border">
                                  amazon.com/dp/PRODUCT_ID
                                </p>
                                <p className="text-xs text-gray-500 mt-1">All Amazon domains supported</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Best Buy */}
                          <div className="group relative bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-white">B</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="text-xs font-semibold text-gray-900">Best Buy</h5>
                                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">Electronics</span>
                                </div>
                                <p className="text-xs text-gray-600 font-mono break-all bg-white px-2 py-1 rounded border">
                                  bestbuy.com/site/PRODUCT_NAME
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Product pages only</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Walmart */}
                          <div className="group relative bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-white">W</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="text-xs font-semibold text-gray-900">Walmart</h5>
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Retail</span>
                                </div>
                                <p className="text-xs text-gray-600 font-mono break-all bg-white px-2 py-1 rounded border">
                                  walmart.com/ip/PRODUCT_NAME
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Product pages only</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Target */}
                          <div className="group relative bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-red-400 to-red-600 rounded-lg flex items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-white">T</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="text-xs font-semibold text-gray-900">Target</h5>
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">Retail</span>
                                </div>
                                <p className="text-xs text-gray-600 font-mono break-all bg-white px-2 py-1 rounded border">
                                  target.com/p/PRODUCT_NAME
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Product pages only</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* eBay */}
                          <div className="group relative bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-white">E</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="text-xs font-semibold text-gray-900">eBay</h5>
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Marketplace</span>
                                </div>
                                <p className="text-xs text-gray-600 font-mono break-all bg-white px-2 py-1 rounded border">
                                  ebay.com/itm/ITEM_ID
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Individual listings</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Shopify */}
                          <div className="group relative bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-3 hover:shadow-md transition-all duration-200">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-white">S</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h5 className="text-xs font-semibold text-gray-900">Shopify Stores</h5>
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">E-commerce</span>
                                </div>
                                <p className="text-xs text-gray-600 font-mono break-all bg-white px-2 py-1 rounded border">
                                  store.myshopify.com/products/PRODUCT
                                </p>
                                <p className="text-xs text-gray-500 mt-1">All Shopify stores supported</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Footer with enhanced tip */}
                        <div className="mt-4 pt-3 border-t border-gray-100">
                          <div className="flex items-start gap-2 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                            <div className="flex-shrink-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-white">💡</span>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-blue-900 mb-0.5">Pro Tip</p>
                              <p className="text-xs text-blue-700">
                                Copy the URL directly from your competitor's product page. Make sure it's a product page, not a category or search page.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Your Shopify Product ID (optional)"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  disabled={isAdding}
                  className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition text-sm ${
                    isAdding ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
                <button 
                  type="submit" 
                  disabled={isAdding}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md ${
                    isAdding 
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isAdding ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Adding...
                    </div>
                  ) : (
                    'Add'
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  disabled={isAdding}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isAdding 
                      ? 'bg-gray-300 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-500 text-white hover:bg-gray-600'
                  }`}
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Competitors Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden relative">
          {/* Loading overlay during competitor addition */}
          {isAdding && (
            <div className="absolute inset-0 bg-white bg-opacity-75 z-10 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Adding competitor...</p>
                <p className="text-sm text-gray-500 mt-1">Please wait while we process your request</p>
              </div>
            </div>
          )}
          
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                Market Intelligence
              </h2>
              <div className="text-sm text-gray-500">
                {filteredCompetitors.length} of {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          
          {filteredCompetitors.length === 0 ? (
            <div className="text-center py-16">
              <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {competitors.length === 0 ? 'No competitors yet' : 'No matches found'}
              </h3>
              <p className="text-gray-500 mb-4">
                {competitors.length === 0 
                  ? isDemoMode 
                    ? 'Demo mode is active. Add your first competitor to start monitoring real market data.'
                    : 'Start tracking your competitors to monitor their pricing strategies.'
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
            <div className="overflow-x-auto competitor-table">
              <CompetitorTable data={filteredCompetitors} onDelete={handleDelete} />
            </div>
          )}
        </div>
      </div>
      
      <SuggestionDrawer
        isOpen={showSuggestions}
        onClose={() => {
          debugLog.info('SuggestionDrawer closed', { 
            wasOpen: showSuggestions,
            suggestionCount 
          }, 'CompetitorsPage');
          setShowSuggestions(false);
        }}
        onSuggestionUpdate={refreshSuggestionCount}
        isDemoMode={isDemoMode}
        demoSuggestions={getDemoData(demoPreferences.category).suggestions}
      />

      <Joyride
        steps={JOYRIDE_STEPS}
        run={showTutorial}
        continuous={true}
        showSkipButton={true}
        showProgress={true}
        disableOverlayClose={true}
        styles={{
          options: {
            zIndex: 9999,
            primaryColor: '#2563eb',
            textColor: '#1e293b',
            backgroundColor: '#fff',
          },
          tooltip: {
            borderRadius: 16,
            boxShadow: '0 8px 32px 0 rgba(37,99,235,0.10)',
            padding: 0,
            fontFamily: 'Inter, sans-serif',
          },
          buttonNext: {
            backgroundColor: '#2563eb',
            color: '#fff',
            borderRadius: 8,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
          },
          buttonBack: {
            color: '#2563eb',
            background: '#e0e7ff',
            borderRadius: 8,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
          },
          buttonSkip: {
            color: '#64748b',
            background: 'transparent',
            fontFamily: 'Inter, sans-serif',
          },
        }}
        tooltipComponent={props => <ThemedJoyrideTooltip {...props} accentColor="#2563eb" />}
        callback={handleJoyrideCallback}
        locale={{
          back: 'Previous',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip',
        }}
      />

      {/* Demo Settings Modal */}
      {showDemoSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Demo Settings</h3>
              <button
                onClick={() => setShowDemoSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Category
                </label>
                <select
                  value={demoPreferences.category}
                  onChange={(e) => updateDemoPreferences({ category: e.target.value as DemoPreferences['category'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="electronics">Electronics</option>
                  <option value="fashion">Fashion & Apparel</option>
                  <option value="home">Home & Furniture</option>
                  <option value="books">Books & Media</option>
                  <option value="random">Mixed Categories</option>
                </select>
              </div>
              
              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range
                </label>
                <select
                  value={demoPreferences.priceRange}
                  onChange={(e) => updateDemoPreferences({ priceRange: e.target.value as DemoPreferences['priceRange'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="low">Low ($10 - $50)</option>
                  <option value="medium">Medium ($50 - $200)</option>
                  <option value="high">High ($200+)</option>
                  <option value="mixed">Mixed Range</option>
                </select>
              </div>
              
              {/* Number of Competitors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Competitors
                </label>
                <select
                  value={demoPreferences.competitors}
                  onChange={(e) => updateDemoPreferences({ competitors: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value={4}>4 Competitors</option>
                  <option value={6}>6 Competitors</option>
                  <option value={8}>8 Competitors</option>
                  <option value={10}>10 Competitors</option>
                </select>
              </div>
              
              {/* Include Out of Stock */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeOutOfStock"
                  checked={demoPreferences.includeOutOfStock}
                  onChange={(e) => updateDemoPreferences({ includeOutOfStock: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="includeOutOfStock" className="ml-2 block text-sm text-gray-700">
                  Include out-of-stock items
                </label>
              </div>
              
              {/* Demo Analytics */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Demo Usage Analytics</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div>Time spent in demo: {Math.round(demoAnalytics.timeSpent / 1000 / 60)} minutes</div>
                  <div>Interactions: {demoAnalytics.interactions}</div>
                  <div>Features used: {demoAnalytics.featuresUsed.length}</div>
                  <div>Tutorial completed: {demoAnalytics.tutorialCompleted ? 'Yes' : 'No'}</div>
                </div>
              </div>
              
              {/* Tutorial Button */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDemoSettings(false);
                    startTutorial();
                  }}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Tutorial
                </button>
                <button
                  onClick={() => setShowDemoSettings(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Trigger Button - Floating Action Button */}
      {/* Visible on desktop (sm+), hidden on mobile */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => {
            setShowTutorial(true);
          }}
          aria-label="Start Market Intelligence Tutorial"
          title="Start Market Intelligence Tutorial"
          className="hidden sm:flex items-center justify-center rounded-full shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          style={{
            width: 56,
            height: 56,
            minWidth: 56,
            minHeight: 56,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: 'white',
            boxShadow: '0 4px 20px rgba(37, 99, 235, 0.3)',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Use Material-UI HelpOutlineIcon for perfect match with Dashboard */}
          <HelpOutlineIcon sx={{ fontSize: 24 }} />
        </button>
      </div>



    </div>
  );
}
