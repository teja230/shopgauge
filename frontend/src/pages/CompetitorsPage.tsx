import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { CompetitorTable } from '../components/ui/CompetitorTable';
import type { Competitor } from '../components/ui/CompetitorTable';
import { SuggestionDrawer } from '../components/ui/SuggestionDrawer';
import { ProductAssociationModal } from '../components/ui/ProductAssociationModal';
import { ProductSelector } from '../components/ui/ProductSelector';
import { ArchivedCompetitorsPanel } from '../components/ui/ArchivedCompetitorsPanel';
import { PriceHistoryModal } from '../components/ui/PriceHistoryModal';
import { 
  getCompetitors, 
  deleteCompetitor,
  refreshSuggestionCount as refreshSuggestionCountAPI,
  addCompetitorIntelligent,
} from '../api';
import { marketIntelligenceAPI, type LimitsResponse } from '../api/marketIntelligence';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles as SparklesIcon,
  Plus as PlusIcon,
  BarChart3 as ChartBarIcon,
  Play as PlayIcon,
  Square as StopIcon,
  Search as MagnifyingGlassIcon,
  Zap as BoltIcon,
  TrendingUp as ArrowTrendingUpIcon,
  CheckCircle2 as CheckCircleIcon,
  Filter as FunnelIcon,
  GraduationCap as AcademicCapIcon,
  Settings as CogIcon,
  Info as InformationCircleIcon,
  X as XMarkIcon,
  Archive as ArchiveBoxIcon,
  RefreshCw as ArrowPathIcon,
  HelpCircle as HelpOutlineIcon,
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationSettings } from '../context/NotificationSettingsContext';
import { fetchWithAuth } from '../api/index';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Joyride from 'react-joyride';
import type { CallBackProps, Step } from 'react-joyride';
import ThemedJoyrideTooltip from '../components/ui/ThemedJoyrideTooltip';
import { debugLog } from '../components/ui/DebugPanel';
import { getSuggestionCount } from '../api';
import { refreshCompetitorPrices, getPriceRefreshProgress } from '../api/index';
import { DemoModeBanner } from '../components/ui/DemoModeIndicator';

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

// Helper function to detect if we're in a demo store
const isDemoStore = (shop: string | null): boolean => {
  return shop === 'demo-shopgauge.myshopify.com';
};

const AnimatedStatValue = ({
  value,
  format = 'integer',
}: {
  value: number;
  format?: 'integer' | 'currency';
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      previousValueRef.current = value;
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 650;
    const from = previousValueRef.current;
    const distance = value - from;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + distance * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        previousValueRef.current = value;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  if (format === 'currency') {
    return <>{displayValue > 0 ? `$${displayValue.toFixed(2)}` : 'N/A'}</>;
  }

  return <>{Math.round(displayValue).toLocaleString()}</>;
};

// Tutorial steps for guided tour (ordered and with precise targets)
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Market Intelligence!',
    description: 'This feature helps you monitor your competitors\' pricing and discover new market opportunities.',
    target: 'body',
    position: 'center'
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
    id: 'refresh-all',
    title: 'Bulk Refresh Prices',
    description: 'Use this button to refresh prices in bulk for competitors with data older than 24 hours.',
    target: '.refresh-button',
    position: 'bottom'
  },
  {
    id: 'show-archived',
    title: 'Show Archived',
    description: 'Open the archived competitors section to view and restore previously archived competitors.',
    target: '.archived-competitors-button',
    position: 'bottom'
  },
  {
    id: 'table',
    title: 'Active Section',
    description: 'View detailed pricing information, stock status, and price changes for all your competitors.',
    target: '.competitor-table',
    position: 'top'
  },
  {
    id: 'row-refresh',
    title: 'Refresh a Single Competitor',
    description: 'Use the refresh icon to update the latest price for a specific competitor.',
    target: '.desktop-row-refresh-button',
    position: 'top'
  },
  {
    id: 'row-graph',
    title: 'Price History Graph',
    description: 'Click the graph icon to view detailed price history and trends for this competitor.',
    target: '.desktop-row-graph-button',
    position: 'top'
  },
  {
    id: 'row-archive',
    title: 'Archive a Competitor',
    description: 'Use the archive icon to move a competitor to the archived list. You can restore it later.',
    target: '.desktop-row-archive-button',
    position: 'top'
  },
  {
    id: 'more-actions',
    title: 'More Actions',
    description: 'Open the menu for secondary actions like visiting the site or copying the URL.',
    target: '.desktop-row-more-actions-button',
    position: 'top'
  },
  {
    id: 'archived-panel',
    title: 'Archived Section',
    description: 'This section lists archived competitors. You can restore them and their full price history at any time within 30 days.',
    target: '.archived-competitors-panel',
    position: 'top'
  },
  {
    id: 'archived-restore',
    title: 'Restore Archived Competitor',
    description: 'Use the restore icon to bring back an archived competitor with their full price history.',
    target: '.archived-restore-button',
    position: 'top'
  },
  {
    id: 'archived-delete',
    title: 'Permanently Delete',
    description: 'Use the delete icon to permanently remove an archived competitor. This action cannot be undone.',
    target: '.archived-delete-button',
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
      },
      {
        id: 3,
        suggestedUrl: 'https://amazon.com/dp/B08N5WRWNW',
        title: 'Amazon - Echo Dot (4th Gen) Smart Speaker',
        price: 39.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T09:15:00Z',
        status: 'NEW'
      },
      {
        id: 4,
        suggestedUrl: 'https://bestbuy.com/site/samsung-65-class-4k-uhd-qled-tizen-smart-tv/6509650.p',
        title: 'Best Buy - Samsung 65" 4K QLED Smart TV',
        price: 899.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T08:45:00Z',
        status: 'NEW'
      },
      {
        id: 5,
        suggestedUrl: 'https://walmart.com/ip/sony-wh-1000xm4-wireless-noise-canceling-headphones/123456789',
        title: 'Walmart - Sony WH-1000XM4 Wireless Noise-Canceling Headphones',
        price: 349.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T07:30:00Z',
        status: 'NEW'
      },
      {
        id: 6,
        suggestedUrl: 'https://target.com/p/apple-ipad-air-10-9-inch-tablet-64gb/123456789',
        title: 'Target - Apple iPad Air (10.9-inch, 64GB)',
        price: 599.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T06:15:00Z',
        status: 'NEW'
      },
      {
        id: 7,
        suggestedUrl: 'https://amazon.com/dp/B08C7W5L7D',
        title: 'Amazon - Fire TV Stick 4K Max',
        price: 39.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T05:30:00Z',
        status: 'NEW'
      },
      {
        id: 8,
        suggestedUrl: 'https://bestbuy.com/site/macbook-air-13-3-laptop-apple-m1-chip-8gb-memory-256gb-ssd/123456789',
        title: 'Best Buy - MacBook Air 13.3" Laptop (Apple M1 Chip, 8GB Memory, 256GB SSD)',
        price: 999.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T04:45:00Z',
        status: 'NEW'
      },
      {
        id: 9,
        suggestedUrl: 'https://walmart.com/ip/dell-xps-13-laptop-13-4-inch-4k-ultra-hd-touchscreen/123456789',
        title: 'Walmart - Dell XPS 13 Laptop (13.4-inch, 4K Ultra HD Touchscreen)',
        price: 1299.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T03:20:00Z',
        status: 'NEW'
      },
      {
        id: 10,
        suggestedUrl: 'https://target.com/p/samsung-galaxy-tab-s7-fe-12-4-inch-tablet-128gb/123456789',
        title: 'Target - Samsung Galaxy Tab S7 FE (12.4-inch, 128GB)',
        price: 529.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T02:10:00Z',
        status: 'NEW'
      },
      {
        id: 11,
        suggestedUrl: 'https://amazon.com/dp/B08N5WRWNW',
        title: 'Amazon - Echo Show 8 (2nd Gen) Smart Display',
        price: 89.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T01:30:00Z',
        status: 'NEW'
      },
      {
        id: 12,
        suggestedUrl: 'https://bestbuy.com/site/apple-watch-series-7-gps-45mm-aluminum-case/123456789',
        title: 'Best Buy - Apple Watch Series 7 (GPS, 45mm, Aluminum Case)',
        price: 399.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T00:45:00Z',
        status: 'NEW'
      },
      {
        id: 13,
        suggestedUrl: 'https://walmart.com/ip/fitbit-versa-3-fitness-smartwatch/123456789',
        title: 'Walmart - Fitbit Versa 3 Fitness Smartwatch',
        price: 229.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T23:15:00Z',
        status: 'NEW'
      },
      {
        id: 14,
        suggestedUrl: 'https://target.com/p/google-nest-mini-2nd-gen-smart-speaker/123456789',
        title: 'Target - Google Nest Mini (2nd Gen) Smart Speaker',
        price: 49.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T22:30:00Z',
        status: 'NEW'
      },
      {
        id: 15,
        suggestedUrl: 'https://amazon.com/dp/B08N5WRWNW',
        title: 'Amazon - Ring Video Doorbell (2nd Gen)',
        price: 99.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T21:45:00Z',
        status: 'NEW'
      },
      {
        id: 16,
        suggestedUrl: 'https://bestbuy.com/site/sony-playstation-5-console/123456789',
        title: 'Best Buy - Sony PlayStation 5 Console',
        price: 499.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T20:20:00Z',
        status: 'NEW'
      },
      {
        id: 17,
        suggestedUrl: 'https://walmart.com/ip/microsoft-xbox-series-x-console/123456789',
        title: 'Walmart - Microsoft Xbox Series X Console',
        price: 499.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T19:10:00Z',
        status: 'NEW'
      },
      {
        id: 18,
        suggestedUrl: 'https://target.com/p/nintendo-switch-console-gray-joy-con/123456789',
        title: 'Target - Nintendo Switch Console (Gray Joy-Con)',
        price: 299.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T18:25:00Z',
        status: 'NEW'
      },
      {
        id: 19,
        suggestedUrl: 'https://amazon.com/dp/B08N5WRWNW',
        title: 'Amazon - DJI Mini 2 Drone',
        price: 449.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T17:40:00Z',
        status: 'NEW'
      },
      {
        id: 20,
        suggestedUrl: 'https://bestbuy.com/site/gopro-hero10-black-action-camera/123456789',
        title: 'Best Buy - GoPro HERO10 Black Action Camera',
        price: 399.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T16:55:00Z',
        status: 'NEW'
      },
      {
        id: 21,
        suggestedUrl: 'https://walmart.com/ip/canon-eos-r6-mirrorless-camera/123456789',
        title: 'Walmart - Canon EOS R6 Mirrorless Camera',
        price: 2499.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T15:30:00Z',
        status: 'NEW'
      },
      {
        id: 22,
        suggestedUrl: 'https://target.com/p/sony-a7-iii-mirrorless-camera/123456789',
        title: 'Target - Sony A7 III Mirrorless Camera',
        price: 1999.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T14:45:00Z',
        status: 'NEW'
      },
      {
        id: 23,
        suggestedUrl: 'https://amazon.com/dp/B08N5WRWNW',
        title: 'Amazon - DJI Pocket 2 Creator Combo',
        price: 349.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T13:20:00Z',
        status: 'NEW'
      },
      {
        id: 24,
        suggestedUrl: 'https://bestbuy.com/site/insta360-one-x2-360-degree-camera/123456789',
        title: 'Best Buy - Insta360 ONE X2 360-Degree Camera',
        price: 429.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T12:35:00Z',
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
      },
      {
        id: 3,
        suggestedUrl: 'https://nike.com/t/air-force-1-07-shoe-GjGXSP',
        title: 'Nike - Air Force 1 07 Sneaker',
        price: 100.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T08:30:00Z',
        status: 'NEW'
      },
      {
        id: 4,
        suggestedUrl: 'https://adidas.com/us/ultraboost-22-shoes/GZ0127.html',
        title: 'Adidas - Ultraboost 22 Running Shoes',
        price: 190.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T07:45:00Z',
        status: 'NEW'
      },
      {
        id: 5,
        suggestedUrl: 'https://zara.com/us/en/oversized-blazer-p01234567.html',
        title: 'Zara - Oversized Blazer',
        price: 89.90,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T07:00:00Z',
        status: 'NEW'
      },
      {
        id: 6,
        suggestedUrl: 'https://h&m.com/us/en/product/relaxed-fit-t-shirt-12345678',
        title: 'H&M - Relaxed Fit T-Shirt',
        price: 19.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T06:15:00Z',
        status: 'NEW'
      },
      {
        id: 7,
        suggestedUrl: 'https://uniqlo.com/us/en/men/ultra-light-down-jacket-123456789',
        title: 'Uniqlo - Ultra Light Down Jacket',
        price: 69.90,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T05:30:00Z',
        status: 'NEW'
      },
      {
        id: 8,
        suggestedUrl: 'https://gap.com/us/en/product/1969-denim-jacket-123456789',
        title: 'Gap - 1969 Denim Jacket',
        price: 79.95,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T04:45:00Z',
        status: 'NEW'
      },
      {
        id: 9,
        suggestedUrl: 'https://oldnavy.com/us/en/product/relaxed-fit-jeans-123456789',
        title: 'Old Navy - Relaxed Fit Jeans',
        price: 34.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T04:00:00Z',
        status: 'NEW'
      },
      {
        id: 10,
        suggestedUrl: 'https://bananarepublic.com/us/en/product/slim-fit-oxford-shirt-123456789',
        title: 'Banana Republic - Slim Fit Oxford Shirt',
        price: 89.50,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T03:15:00Z',
        status: 'NEW'
      },
      {
        id: 11,
        suggestedUrl: 'https://jcrew.com/us/en/product/merino-wool-sweater-123456789',
        title: 'J.Crew - Merino Wool Sweater',
        price: 89.50,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T02:30:00Z',
        status: 'NEW'
      },
      {
        id: 12,
        suggestedUrl: 'https://anthropologie.com/us/en/product/embroidered-blouse-123456789',
        title: 'Anthropologie - Embroidered Blouse',
        price: 128.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T01:45:00Z',
        status: 'NEW'
      },
      {
        id: 13,
        suggestedUrl: 'https://freepeople.com/us/en/product/bohemian-dress-123456789',
        title: 'Free People - Bohemian Dress',
        price: 158.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T01:00:00Z',
        status: 'NEW'
      },
      {
        id: 14,
        suggestedUrl: 'https://urbanoutfitters.com/us/en/product/oversized-sweater-123456789',
        title: 'Urban Outfitters - Oversized Sweater',
        price: 69.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-15T00:15:00Z',
        status: 'NEW'
      },
      {
        id: 15,
        suggestedUrl: 'https://asos.com/us/product/denim-skirt-123456789',
        title: 'ASOS - Denim Skirt',
        price: 45.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T23:30:00Z',
        status: 'NEW'
      },
      {
        id: 16,
        suggestedUrl: 'https://revolve.com/us/en/product/leather-jacket-123456789',
        title: 'Revolve - Leather Jacket',
        price: 298.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T22:45:00Z',
        status: 'NEW'
      },
      {
        id: 17,
        suggestedUrl: 'https://shopbop.com/us/en/product/silk-blouse-123456789',
        title: 'Shopbop - Silk Blouse',
        price: 198.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T22:00:00Z',
        status: 'NEW'
      },
      {
        id: 18,
        suggestedUrl: 'https://nordstrom.com/us/en/product/wool-coat-123456789',
        title: 'Nordstrom - Wool Coat',
        price: 298.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T21:15:00Z',
        status: 'NEW'
      },
      {
        id: 19,
        suggestedUrl: 'https://bloomingdales.com/us/en/product/cashmere-scarf-123456789',
        title: 'Bloomingdale\'s - Cashmere Scarf',
        price: 98.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T20:30:00Z',
        status: 'NEW'
      },
      {
        id: 20,
        suggestedUrl: 'https://macys.com/us/en/product/evening-dress-123456789',
        title: 'Macy\'s - Evening Dress',
        price: 198.00,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T19:45:00Z',
        status: 'NEW'
      },
      {
        id: 21,
        suggestedUrl: 'https://kohls.com/us/en/product/casual-shoes-123456789',
        title: 'Kohl\'s - Casual Shoes',
        price: 59.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T19:00:00Z',
        status: 'NEW'
      },
      {
        id: 22,
        suggestedUrl: 'https://tjmaxx.com/us/en/product/designer-handbag-123456789',
        title: 'TJ Maxx - Designer Handbag',
        price: 89.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T18:15:00Z',
        status: 'NEW'
      },
      {
        id: 23,
        suggestedUrl: 'https://marshalls.com/us/en/product/sunglasses-123456789',
        title: 'Marshalls - Sunglasses',
        price: 29.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T17:30:00Z',
        status: 'NEW'
      },
      {
        id: 24,
        suggestedUrl: 'https://ross.com/us/en/product/jewelry-set-123456789',
        title: 'Ross - Jewelry Set',
        price: 19.99,
        source: 'GOOGLE_SHOPPING',
        discoveredAt: '2024-01-14T16:45:00Z',
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

  // Enhanced demo mode detection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    const localStorageFlag = localStorage.getItem('demo_mode_active');
    
    console.log('CompetitorsPage: Demo mode detection', {
      demoParam,
      localStorageFlag,
      shop,
      currentUrl: window.location.href
    });
    
    // Check if demo mode should be activated
    const shouldActivateDemo = demoParam === 'true' || 
                              shop === 'demo-shopgauge.myshopify.com' ||
                              window.location.hostname.includes('demo');
    
    if (shouldActivateDemo && !isDemoMode) {
      console.log('CompetitorsPage: Activating demo mode');
      setIsDemoMode(true);
      setCompetitors(getDemoData(DEFAULT_DEMO_PREFERENCES.category).competitors);
      setSuggestionCount(getDemoData(DEFAULT_DEMO_PREFERENCES.category).suggestions.length);
    }
  }, [shop, isDemoMode]);

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
  const { settings: notificationSettings } = useNotificationSettings();
  
  // Debug notification settings
  debugLog.info('Notification settings loaded', {
    showToasts: notificationSettings.showToasts,
    soundEnabled: notificationSettings.soundEnabled,
    systemNotifications: notificationSettings.systemNotifications,
    emailNotifications: notificationSettings.emailNotifications,
    marketingNotifications: notificationSettings.marketingNotifications
  }, 'CompetitorsPage');
  
  // Debug notification settings on component mount
  useEffect(() => {
    debugLog.info('Notification settings loaded', {
      showToasts: notificationSettings.showToasts
    }, 'CompetitorsPage');
  }, [notificationSettings.showToasts]); // Only run when settings change
  
  // Show helpful message if not authenticated - only run once when auth state changes
  useEffect(() => {
    if (!isAuthenticated && !isDemoMode && isAuthReady && !notificationShownRef.current) {
      notificationShownRef.current = true;
      notifications.showInfo('Connect your Shopify store to initiate competitor tracking', {
        category: 'Competitors',
        persistent: true,
        showToast: true,
        action: {
          label: 'Connect Store',
          onClick: () => {
            window.location.href = '/';
          }
        }
      });
    }
  }, [isAuthenticated, isDemoMode, isAuthReady]); // Remove notifications from dependencies
  
  // New state for enhanced demo features
  const [showTutorial, setShowTutorial] = useState(false);
  // Add a ref to prevent duplicate notifications
  const notificationShownRef = useRef(false);
  // Add a ref to prevent duplicate tutorial auto-triggers
  const tutorialAutoTriggerRef = useRef(false);

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
  
  // Highlighting state for row highlighting
  const [highlightedCompetitorId, setHighlightedCompetitorId] = useState<string | undefined>();
  const [highlightAction, setHighlightAction] = useState<'add' | 'archive' | 'restore' | undefined>();
  
  // Refresh trigger for archived competitors
  const [archivedRefreshTrigger, setArchivedRefreshTrigger] = useState(0);
  
  // Function to trigger row highlighting
  const triggerHighlight = (competitorId: string, action: 'add' | 'archive' | 'restore') => {
    setHighlightedCompetitorId(competitorId);
    setHighlightAction(action);
    
    // Clear highlighting after 2 seconds
    setTimeout(() => {
      setHighlightedCompetitorId(undefined);
      setHighlightAction(undefined);
    }, 2000);
  };
  
  // Refresh functionality state
  // Refresh state - enhanced with session tracking
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(() => {
    const saved = localStorage.getItem('refreshCooldown');
    const savedTime = localStorage.getItem('refreshCooldownTime');
    if (saved && savedTime) {
      const elapsed = Math.floor((Date.now() - parseInt(savedTime)) / 1000);
      const remaining = Math.max(0, parseInt(saved) - elapsed);
      return remaining;
    }
    return 0;
  });
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [refreshSession, setRefreshSession] = useState<{
    sessionId: string;
    totalCompetitors: number;
    totalDomains: number;
  } | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<{
    completed: number;
    failed: number;
    skipped: number;
    percentage: number;
    estimatedTimeRemaining: string;
    isCompleted: boolean;
  } | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshCooldownRef = useRef<NodeJS.Timeout | null>(null);
  const progressPollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Product association modal state
  const [productAssociationModal, setProductAssociationModal] = useState<{
    open: boolean;
    competitor: Competitor | null;
  }>({
    open: false,
    competitor: null,
  });
  
  // Deleted competitors panel state
  const [showDeletedCompetitors, setShowDeletedCompetitors] = useState(false);
  
  // Graph view state
  const [showGraphView, setShowGraphView] = useState(false);
  const [selectedCompetitorForGraph, setSelectedCompetitorForGraph] = useState<Competitor | null>(null);
  
  // Collapsible sections state
  const [activeSectionCollapsed, setActiveSectionCollapsed] = useState(false);
  const [deletedSectionCollapsed, setDeletedSectionCollapsed] = useState(false);
  
  // Archived competitors count
  const [archivedCount, setArchivedCount] = useState(0);
  
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
      const cacheKey = `mi_competitors_${shop}`;
      const suggestionCacheKey = `mi_suggestions_${shop}`;

      // L1: Session storage read (non-blocking): if present and not forcing, seed UI immediately
      if (!forceRefresh) {
        try {
          const sessionData = sessionStorage.getItem(cacheKey);
          if (sessionData) {
            const seeded = JSON.parse(sessionData);
            if (Array.isArray(seeded) && seeded.length >= 0) {
              setCompetitors(seeded);
            }
          }
        } catch (_) {
          // ignore session parse errors
        }
      }

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
              // L1: Write-through to session storage for subsequent loads
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(competitorsData));
        } catch (_) {
          // ignore storage quota errors
        }
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

  // Refresh functionality with cooldown and debounce
  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    
    // Check cooldown (5 minutes - since scraping only updates prices older than 24hrs)
    if (refreshCooldown > 0) {
      debugLog.info('Refresh blocked by cooldown', { 
        cooldownRemaining: refreshCooldown,
        lastRefreshTime 
      }, 'CompetitorsPage');
      return;
    }
    
    // Check debounce (2 seconds)
    if (now - lastRefreshTime < 2000) {
      debugLog.info('Refresh blocked by debounce', { 
        timeSinceLastRefresh: now - lastRefreshTime 
      }, 'CompetitorsPage');
      return;
    }
    
    // Prevent multiple simultaneous refreshes
    if (isRefreshing) {
      debugLog.info('Refresh blocked - already in progress', {}, 'CompetitorsPage');
      return;
    }
    
    setIsRefreshing(true);
    setLastRefreshTime(now);
    
    try {
      debugLog.info('Starting manual price refresh', { 
        isDemoMode, 
        shop 
      }, 'CompetitorsPage');
      
      // Call the new scalable price refresh endpoint that triggers queue-based processing
      const refreshResult = await refreshCompetitorPrices();
      
      debugLog.info('Scalable price refresh started', { 
        result: refreshResult 
      }, 'CompetitorsPage');
      
      // Store session info for progress tracking
      setRefreshSession({
        sessionId: refreshResult.session_id,
        totalCompetitors: refreshResult.total_competitors,
        totalDomains: refreshResult.total_domains
      });
      
      // Start progress polling
      startProgressPolling(refreshResult.session_id);
      
      // Show success notification with enhanced details
      notifications.showSuccess(
        `Scalable price refresh started for ${refreshResult.updated_count} competitors across ${refreshResult.total_domains} domains. ${refreshResult.message}`, 
        {
          category: 'Competitors',
          showToast: true,
          duration: 6000
        }
      );
      
      // For now, just show a simple success message
      // notifications.showSuccess('Refresh functionality coming soon!', {
      //   category: 'Competitors',
      //   showToast: true,
      //   duration: 3000
      // });
      
      // Set cooldown (5 minutes - since scraping only updates prices older than 24hrs)
          setRefreshCooldown(300);
    localStorage.setItem('refreshCooldown', '300');
    localStorage.setItem('refreshCooldownTime', Date.now().toString());
    refreshCooldownRef.current = setTimeout(() => {
      setRefreshCooldown(0);
      localStorage.removeItem('refreshCooldown');
      localStorage.removeItem('refreshCooldownTime');
    }, 300000);
      
    } catch (error) {
      debugLog.error('Refresh failed', { error }, 'CompetitorsPage');
      notifications.showError('Failed to refresh competitor prices. Please try again.', {
        category: 'Competitors',
        showToast: true
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchData, isRefreshing, refreshCooldown, lastRefreshTime, isDemoMode, shop, notifications]);

  // Progress polling functionality
  const startProgressPolling = useCallback((sessionId: string) => {
    debugLog.info('Starting progress polling for session', { sessionId }, 'CompetitorsPage');
    
    const pollProgress = async () => {
      try {
        const progress = await getPriceRefreshProgress(sessionId);
        
        debugLog.info('Progress update received', { progress }, 'CompetitorsPage');
        
        setRefreshProgress({
          completed: progress.completed,
          failed: progress.failed,
          skipped: progress.skipped,
          percentage: progress.percentage,
          estimatedTimeRemaining: progress.estimatedTimeRemaining,
          isCompleted: progress.isCompleted
        });
        
        // Stop polling and refresh data when completed
        if (progress.isCompleted) {
          debugLog.info('Refresh session completed', { 
            sessionId, 
            completed: progress.completed,
            failed: progress.failed,
            skipped: progress.skipped
          }, 'CompetitorsPage');
          
          // Clear polling
          if (progressPollingRef.current) {
            clearTimeout(progressPollingRef.current);
            progressPollingRef.current = null;
          }
          
          // Reset states
          setIsRefreshing(false);
          setRefreshSession(null);
          
          // Show completion notification
          notifications.showSuccess(
            `Price refresh completed! Updated ${progress.completed} competitors, ${progress.failed} failed, ${progress.skipped} skipped.`,
            {
              category: 'Competitors',
              showToast: true,
              duration: 5000
            }
          );
          
          // Invalidate session + in-memory caches before fetching fresh data
          try {
            if (shop) {
              const cacheKey = `mi_competitors_${shop}`;
              sessionStorage.removeItem(cacheKey);
              cache.delete(cacheKey);
            }
          } catch (_) {
            // ignore cache errors
          }

          // Refresh the competitor data
          await fetchData(true);
          
          return; // Stop polling
        }
        
        // Continue polling every 3 seconds
        progressPollingRef.current = setTimeout(pollProgress, 3000);
        
      } catch (error) {
        debugLog.error('Progress polling failed', { error }, 'CompetitorsPage');
        
        // Stop polling on error
        if (progressPollingRef.current) {
          clearTimeout(progressPollingRef.current);
          progressPollingRef.current = null;
        }
        
        setIsRefreshing(false);
        setRefreshSession(null);
        
        notifications.showError('Lost connection to refresh progress. Please check results manually.', {
          category: 'Competitors',
          showToast: true
        });
      }
    };
    
    // Start initial poll
    pollProgress();
  }, [notifications, fetchData]);

  // Countdown effect for refresh cooldown
  useEffect(() => {
    if (refreshCooldown > 0) {
      const interval = setInterval(() => {
        setRefreshCooldown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            localStorage.removeItem('refreshCooldown');
            localStorage.removeItem('refreshCooldownTime');
            return 0;
          }
          const newValue = prev - 1;
          localStorage.setItem('refreshCooldown', newValue.toString());
          return newValue;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [refreshCooldown]);

  // Cleanup refresh timeouts on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (refreshCooldownRef.current) {
        clearTimeout(refreshCooldownRef.current);
      }
    };
  }, []);

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
        category: 'Competitors',
        showToast: true
      });
      return;
    }

    // Enhanced URL validation for better user guidance
    const trimmedUrl = url.trim();
    if (trimmedUrl.includes('amazon.com') && !trimmedUrl.includes('/dp/') && !trimmedUrl.includes('/gp/product/')) {
      notifications.showError('Please provide a direct Amazon product page URL (should contain /dp/ or /gp/product/)', {
        category: 'Competitors',
        showToast: true
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
            category: 'Competitors',
            showToast: true
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
          category: 'Competitors',
          showToast: true
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
        // Set price loading state for the new competitor
        const competitorWithLoading = { ...newCompetitor, priceLoading: true };
        setCompetitors((prev) => [...prev, competitorWithLoading]);
        
        // Trigger highlighting for the newly added competitor
        triggerHighlight(newCompetitor.id, 'add');
      
        // Clear session cache and refetch to ensure fresh data on next load
        const cacheKey = `mi_competitors_${shop}`;
        try {
          sessionStorage.removeItem(cacheKey);
        } catch (e) {
          void 0;
        }
        cache.delete(cacheKey);
        await fetchData(true);
        
        // Show enterprise-grade success notification
        debugLog.info('Showing success notification for competitor addition', {
          message: 'Competitor added successfully! Price tracking will be activated shortly.',
          category: 'Competitors'
        }, 'CompetitorsPage');
        
        notifications.showSuccess('Competitor added successfully! Price data is being retrieved now.', {
          category: 'Competitors',
          showToast: true, // Force toast to show
          persistent: false,
          duration: 4000
        });

        // Backend now handles immediate scraping with API fallbacks - no polling needed
        
        // If we were in demo mode and successfully added a real competitor, switch to live mode
        if (isDemoMode) {
          console.log('Successfully added real competitor, switching from Demo to Live Mode');
          setIsDemoMode(false);
          setUserDisabledDemo(true);
          if (shop) {
            localStorage.setItem(`demoDisabled_${shop}`, 'true');
          }
        }
        
        // Start polling for price updates for the new competitor (less aggressive)
        const startPricePolling = async (competitorId: string) => {
          let attempts = 0;
          const maxAttempts = 3; // Only 3 attempts total
          
          const pollForPrice = async () => {
            try {
              attempts++;
              console.log(`Polling for price update, attempt ${attempts}/${maxAttempts}`);
              
              // Fetch fresh competitor data
              await fetchData(true);
              
              // Check if the new competitor has a price by looking at current state
              setCompetitors(prev => {
                const updatedCompetitor = prev.find(c => c.id === competitorId);
                if (updatedCompetitor && updatedCompetitor.price > 0) {
                  console.log('Price found, stopping polling');
                  // Update the competitor's loading state
                  return prev.map(c => 
                    c.id === competitorId 
                      ? { ...c, priceLoading: false }
                      : c
                  );
                }
                return prev; // No changes needed
              });
              
              // Check if we should stop polling
              const currentCompetitor = competitors.find(c => c.id === competitorId);
              if (currentCompetitor && currentCompetitor.price > 0) {
                console.log('Price found, stopping polling');
                return; // Stop polling
              }
              
              // If we haven't reached max attempts, continue polling with longer intervals
              if (attempts < maxAttempts) {
                let nextPollDelay;
                switch (attempts) {
                  case 1:
                    nextPollDelay = 30000; // 30 seconds
                    break;
                  case 2:
                    nextPollDelay = 90000; // 90 seconds
                    break;
                  default:
                    nextPollDelay = 180000; // 180 seconds (3 minutes)
                    break;
                }
                console.log(`Scheduling next poll in ${nextPollDelay / 1000} seconds`);
                setTimeout(pollForPrice, nextPollDelay);
        } else {
                console.log('Max polling attempts reached, stopping');
                // Stop loading state even if no price found
                setCompetitors(prev => prev.map(c => 
                  c.id === competitorId 
                    ? { ...c, priceLoading: false }
                    : c
                ));
              }
            } catch (error) {
              console.log('Error during price polling:', error);
              // Stop loading state on error
              setCompetitors(prev => prev.map(c => 
                c.id === competitorId 
                  ? { ...c, priceLoading: false }
                  : c
              ));
            }
          };
          
          // Start polling after initial delay
          setTimeout(pollForPrice, 30000); // Start after 30 seconds
        };
        
        // Start polling for the new competitor
        if (newCompetitor?.id) {
          startPricePolling(newCompetitor.id);
        }
        
        // Clear form and close after success
        setUrl('');
        setProductId('');
        setShowAddForm(false);
      }
    } catch (error: any) {
      console.error('handleAdd error:', error);
      
      // Check if this is a timeout error that might be from the refresh
      if (error.message?.includes('timeout') || error.message?.includes('Request timed out')) {
        // If we have a competitor in the list, this might be a refresh timeout, not a failure
        const lastAddedCompetitor = competitors.find(c => c.url === url.trim());
        if (lastAddedCompetitor) {
          console.log('Timeout error detected but competitor was added successfully, showing success message');
          notifications.showSuccess('Competitor added successfully! Price data will be updated shortly.', {
            category: 'Competitors',
            showToast: true,
            persistent: false,
            duration: 4000
          });
          
          // Clear form and close
          setUrl('');
          setProductId('');
          setShowAddForm(false);
          return;
        }
      }
      
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
      
      // Check if the competitor was actually added despite the error
      const competitorWasAdded = competitors.some(c => c.url === url.trim());
      if (competitorWasAdded) {
        console.log('Competitor was added successfully despite error, showing success message');
        notifications.showSuccess('Competitor added successfully! Price data will be updated shortly.', {
          category: 'Competitors',
          showToast: true,
          persistent: false,
          duration: 4000
        });
        
        // Clear form and close
        setUrl('');
        setProductId('');
        setShowAddForm(false);
        return;
      }
      
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
      } else if (error.message?.includes('archived competitor limit') || error.message?.includes('ARCHIVED_COMPETITOR_LIMIT_EXCEEDED')) {
        userMessage = 'You have reached the maximum archived competitor limit for your current subscription tier.';
        debugLog.warn('Archived competitor limit reached', {
          error: error.message,
          url: url
        }, 'CompetitorsPage');
      } else if (error.message?.includes('limit') || error.message?.includes('COMPETITOR_LIMIT_EXCEEDED')) {
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
      } else if (error.message?.includes('maximum competitor tracking limit') || error.message?.includes('maximum archived competitor limit')) {
        // Use the specific error message from the backend
        userMessage = error.message;
        debugLog.warn('Competitor limit exceeded for competitor addition', {
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
          showToast: true,
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
          showToast: true,
          duration: 8000
        });
      } else if (needsProductSync) {
        debugLog.info('Showing product sync error notification');
                notifications.showError('Product Catalog Synchronization Required', {
            category: 'Competitors',
          persistent: true,
          showToast: true,
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
          showToast: true,
          duration: 8000
        });
      } else {
        debugLog.info('Showing generic error notification', {
          message: userMessage
        }, 'CompetitorsPage');
        notifications.showError(userMessage, {
          category: 'Competitors',
          showToast: true
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
          category: 'Competitors',
          showToast: true
        });
        return;
      }
      
      // Optimistically remove from UI for better UX
      const competitorToDelete = competitors.find(c => c.id === id);
      
      // Trigger highlighting for the archived competitor
      triggerHighlight(id, 'archive');
      
      // Delay removal slightly to allow highlight animation
      setTimeout(() => {
        setCompetitors((prev) => prev.filter((c) => c.id !== id));
        // Trigger archived panel refresh immediately so highlight can apply when it appears
        setArchivedRefreshTrigger(prev => prev + 1);
      }, 200);
      
      try {
        // Call API to actually delete from backend
        await deleteCompetitor(id);

        // L1 session cache: surgical updates for efficiency
        const cacheKey = `mi_competitors_${shop}`;
        const archivedKey = `mi_archived_${shop}`;
        try {
          // Remove from active list cache
          const rawActive = sessionStorage.getItem(cacheKey);
          if (rawActive) {
            const arr = JSON.parse(rawActive);
            if (Array.isArray(arr)) {
              const nextActive = arr.filter((c: any) => String(c.id) !== String(id));
              sessionStorage.setItem(cacheKey, JSON.stringify(nextActive));
            }
          }

          // Append to archived list cache (best-effort stub, backend will refresh shortly)
          const rawArchived = sessionStorage.getItem(archivedKey);
          const archivedArr = rawArchived ? JSON.parse(rawArchived) : [];
          const toArchive = competitorToDelete
            ? {
                id: competitorToDelete.id,
                url: competitorToDelete.url,
                label: competitorToDelete.label,
                deleted_at: new Date().toISOString(),
                platform: (competitorToDelete as any).platform || 'unknown',
                domain: (() => { try { return new URL(competitorToDelete.url).hostname.replace('www.', ''); } catch { return undefined; } })(),
                last_successful_check: null,
                latest_snapshot_at: null,
                price_snapshots_count: 0,
              }
            : null;
          if (toArchive) {
            const nextArchived = [toArchive, ...(Array.isArray(archivedArr) ? archivedArr : [])];
            sessionStorage.setItem(archivedKey, JSON.stringify(nextArchived));
          }
        } catch (_) {
          // ignore session errors
        }

        // Also update in-memory cache map for active list
        try {
          cache.delete(cacheKey);
        } catch (_) {
          // Ignore cache deletion errors
        }

        // Refetch from server/Redis in background to reconcile with authoritative data
        setTimeout(async () => {
          await fetchData(true);
        }, 500);

        // Undo-able toast: restore puts the competitor (and its history) back
        toast.custom(
          (t) => (
            <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-[#e4e7eb] bg-white px-4 py-3 shadow-[0_20px_44px_-24px_rgba(16,24,32,0.4)]">
              <span className="text-sm font-semibold text-[#101820]">Competitor archived</span>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm font-bold text-[#2f5bea] transition-colors hover:bg-[#2f5bea]/10"
                onClick={async () => {
                  toast.dismiss(t.id);
                  try {
                    await fetchWithAuth(`/api/competitors/${id}/restore`, { method: 'POST' });
                    if (competitorToDelete) {
                      setCompetitors((prev) => [...prev, competitorToDelete]);
                    }
                    setArchivedRefreshTrigger((prev) => prev + 1);
                    setTimeout(() => fetchData(true), 400);
                    notifications.showSuccess('Competitor restored', { category: 'Competitors', showToast: true });
                  } catch {
                    notifications.showError('Could not restore competitor. Check the archived list.', {
                      category: 'Competitors',
                    });
                  }
                }}
              >
                Undo
              </button>
            </div>
          ),
          { duration: 6000 }
        );
        
      // Ensure archived list refreshed (second signal after API completes)
      setArchivedRefreshTrigger(prev => prev + 1);
        
        debugLog.info('Competitor deleted successfully', { 
          competitorId: id,
          competitorUrl: competitorToDelete?.url 
        }, 'CompetitorsPage');
        
      } catch (error) {
        console.error('Delete competitor error:', error);
        debugLog.error('Delete competitor failed', { 
          competitorId: id, 
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error
        }, 'CompetitorsPage');
        
        // Re-add the competitor to the UI since the API call failed
        if (competitorToDelete) {
          setCompetitors((prev) => [...prev, competitorToDelete]);
        }
        
        // Show appropriate error message based on error type
        let errorMessage = 'Unable to discontinue competitor tracking at this time. Please try again.';
        
        if (error instanceof Error) {
          // Check for specific error flags first
          if ((error as any).archivedCompetitorLimitExceeded) {
            errorMessage = 'You have reached the maximum archived competitor limit for your current subscription tier.';
          } else if ((error as any).competitorLimitExceeded) {
            errorMessage = 'You have reached the maximum competitor tracking limit for your current subscription tier.';
          } else if (error.message.includes('Authentication required') || error.message.includes('401')) {
            errorMessage = 'Your session has expired. Please refresh the page and try again.';
          } else if (error.message.includes('404') || error.message.includes('Not Found')) {
            errorMessage = 'Competitor not found. It may have already been deleted.';
          } else if (error.message.includes('timeout') || error.message.includes('Network Error')) {
            errorMessage = 'Request timed out. The competitor may have been deleted. Please refresh the page to confirm.';
          } else if (error.message.includes('Failed to delete competitor') || error.message.includes('Unable to delete competitor') || error.message.includes('Unable to remove competitor tracking')) {
            errorMessage = 'Unable to remove competitor tracking at this time. Please try again.';
          } else if (error.message.includes('foreign key') || error.message.includes('constraint') || error.message.includes('associated with other data')) {
            errorMessage = 'This competitor cannot be removed right now. It may be associated with other data. Please try again later.';
          } else if (error.message.includes('archived competitor limit') || error.message.includes('ARCHIVED_COMPETITOR_LIMIT_EXCEEDED')) {
            errorMessage = 'You have reached the maximum archived competitor limit for your current subscription tier.';
          } else if (error.message.includes('connection') || error.message.includes('database') || error.message.includes('Service temporarily unavailable')) {
            errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
          }
        }
        
        notifications.showError(errorMessage, {
          category: 'Competitors',
          showToast: true // Force toast to show
        });
      }
    } catch (error) {
      console.error('Unexpected error in handleDelete:', error);
      debugLog.error('Unexpected error in handleDelete', { 
        competitorId: id, 
        error: error instanceof Error ? error.message : String(error)
      }, 'CompetitorsPage');
      
      notifications.showError('An unexpected error occurred. Please try again.', {
        category: 'Competitors',
        showToast: true // Force toast to show
      });
    }
  }, [isDemoMode, shop, notifications, competitors]);

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

  // Polling removed - backend now handles immediate scraping with API fallbacks

  // Product association handlers
  const handleLinkProduct = useCallback((competitor: Competitor) => {
    setProductAssociationModal({
      open: true,
      competitor,
    });
  }, []);

  const handleCloseProductAssociationModal = useCallback(() => {
    setProductAssociationModal({
      open: false,
      competitor: null,
    });
  }, []);

  const handleProductAssociationChange = useCallback((change?: { competitorId: string; productId?: string; productTitle?: string }) => {
    if (change?.competitorId) {
      const { competitorId, productId, productTitle } = change;
      // Surgical write-through: update in-memory list immediately
      setCompetitors(prev => prev.map(c => {
        if (String(c.id) === String(competitorId)) {
          return {
            ...c,
            shopifyProductId: productId,
            productTitle: productTitle
          };
        }
        return c;
      }));
      // Update session cache entry immediately (L1)
      try {
        if (shop) {
          const cacheKey = `mi_competitors_${shop}`;
          const raw = sessionStorage.getItem(cacheKey);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              const next = arr.map((c: any) => String(c.id) === String(competitorId) ? {
                ...c,
                shopifyProductId: productId,
                productTitle: productTitle
              } : c);
              sessionStorage.setItem(cacheKey, JSON.stringify(next));
            }
          }
        }
      } catch (_) {
        // ignore session errors
      }
    } else {
      // Fallback: refetch if change payload missing
      fetchData(true);
    }
  }, [fetchData, shop]);

  // Callback for when a competitor is restored from archived section
  const handleCompetitorRestored = useCallback((competitorId?: string) => {
    console.log('Competitor restored, forcing refresh of active competitors');
    
    // Trigger highlighting for the restored competitor if ID is provided
    if (competitorId) {
      triggerHighlight(competitorId, 'restore');
    }
    
    // Force refresh to update active competitors list and clear search/filter that could hide it
    setFilterStatus('all');
    setSearchQuery('');
    fetchData(true).then(() => {
      if (competitorId) {
        // Re-trigger highlight once data is in the table so the row is visible
        setTimeout(() => triggerHighlight(competitorId, 'restore'), 100);
      }
    });
  }, [fetchData]);

  // Limit display component
  const LimitDisplay = () => {
    if (isDemoMode || !limits) return null;

    const { competitorLimit, archivedCompetitorLimit, suggestionLimit, discoveryLimit } = limits;
    
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
        
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">
              {competitorLimit.currentCount}/{competitorLimit.limit}
            </div>
            <div className="text-xs text-blue-600">Active Competitors</div>
            {competitorLimit.message && (
              <div className="text-xs text-blue-500 mt-1">{competitorLimit.message}</div>
            )}
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">
              {archivedCompetitorLimit.currentCount}/{archivedCompetitorLimit.limit}
            </div>
            <div className="text-xs text-blue-600">Archived Competitors</div>
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
        
        {(competitorLimit.currentCount >= competitorLimit.limit * 0.8 || 
          archivedCompetitorLimit.currentCount >= archivedCompetitorLimit.limit * 0.8) && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            You&apos;re approaching your competitor limits. Consider upgrading for unlimited tracking.
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
        category: 'Mode',
        showToast: true
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
        category: 'Mode',
        showToast: true
      });
      
      // No fetchData call needed for demo mode - everything is already set
    }
  }, [isDemoMode, notifications, fetchData, shop]);

  // Enhanced discovery trigger with better error handling and mobile support
  const triggerManualDiscovery = useCallback(async () => {
    if (isDemoMode) {
      notifications.showInfo('Discovery is not available in demo mode', {
        category: 'Discovery',
        showToast: true
      });
      return;
    }

    if (!shop) {
      notifications.showError('No shop connected', {
        category: 'Discovery',
        showToast: true
      });
      return;
    }

    const now = Date.now();
    if (now - lastDiscoveryTime < DISCOVERY_COOLDOWN) {
      const hoursRemaining = Math.ceil((DISCOVERY_COOLDOWN - (now - lastDiscoveryTime)) / (60 * 60 * 1000));
      notifications.showError(`Discovery is on cooldown. Please wait ${hoursRemaining} more hours.`, {
        category: 'Discovery',
        showToast: true
      });
      return;
    }

    setIsDiscovering(true);

    notifications.showInfo('Starting discovery process...', {
      category: 'Discovery',
      showToast: true,
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
              notifications.showError(errorMessage, { 
                category: 'Discovery',
                showToast: true
              });
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
        notifications.showError('Could not retrieve discovery configuration.', { 
          category: 'Discovery',
          showToast: true
        });
        return;
      }
      
      if (cfg.error) {
        console.error(`[Discovery] Configuration error:`, cfg.error);
        notifications.showError(`Discovery error: ${cfg.message || cfg.error}`, { 
          category: 'Discovery',
          showToast: true
        });
        return;
      }
      
      if (!cfg.enabled) {
        console.warn(`[Discovery] Discovery disabled. Config:`, cfg);
        const errorMessage = cfg.message || 'Competitor discovery is currently disabled. Please contact support.';
        if (cfg.debugInfo) {
          console.error('[Discovery] Debug info:', cfg.debugInfo);
        }
          notifications.showError(errorMessage, { 
            category: 'Discovery',
            showToast: true
          });
        return;
      }
      
      if (!cfg.configured) {
        console.warn(`[Discovery] Discovery not configured. Config:`, cfg);
        const errorMessage = cfg.message || 'Competitor discovery is not configured. Please set up your search API credentials.';
        if (cfg.debugInfo) {
          console.error('[Discovery] Debug info:', cfg.debugInfo);
        }
          notifications.showError(errorMessage, { 
            category: 'Discovery',
            showToast: true
          });
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
            notifications.showSuccess(result.message || 'Discovery started! Initial results may appear within hours.', { 
              category: 'Discovery',
              showToast: true
            });
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
      
              notifications.showError(userMessage, { 
          category: 'Discovery',
          showToast: true
        });
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

  const marketMetricCards = [
    {
      label: 'Total Competitors',
      value: insights.total,
      format: 'integer' as const,
      helper: `${filteredCompetitors.length} visible now`,
      delta: competitors.length > 0 ? 'Live watchlist' : 'Ready to track',
      accent: '#2f5bea',
      text: '#101820',
      icon: ChartBarIcon,
    },
    {
      label: 'In Stock',
      value: insights.inStock,
      format: 'integer' as const,
      helper: insights.total > 0 ? `${Math.round((insights.inStock / insights.total) * 100)}% availability` : 'No stock signal yet',
      delta: `${insights.outOfStock} out`,
      accent: '#15b87a',
      text: '#08734c',
      icon: CheckCircleIcon,
    },
    {
      label: 'Price Changes',
      value: insights.priceChanges,
      format: 'integer' as const,
      helper: `${insights.priceIncreases} up / ${insights.priceDecreases} down`,
      delta: 'Movement tracked',
      accent: '#f59e0b',
      text: '#b45309',
      icon: BoltIcon,
    },
    {
      label: 'Avg Price',
      value: insights.avgPrice,
      format: 'currency' as const,
      helper: 'Across visible prices',
      delta: 'Market average',
      accent: '#f9734d',
      text: '#c2410c',
      icon: ArrowTrendingUpIcon,
    },
  ];

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

  // Auto-trigger tutorial for demo mode users
  useEffect(() => {
    if (isDemoMode && shop && !authLoading && isAuthReady && competitors.length > 0) {
      const tutorialCompleted = localStorage.getItem(`tutorialCompleted_${shop}`);
      const demoTutorialShown = sessionStorage.getItem('demo_competitors_tutorial_shown');
      const dashboardTutorialShown = sessionStorage.getItem('demo_dashboard_tutorial_shown');
      
      console.log('Competitors: Auto-tutorial check', {
        isDemoMode,
        shop,
        authLoading,
        isAuthReady,
        competitorsCount: competitors.length,
        tutorialCompleted,
        demoTutorialShown,
        dashboardTutorialShown
      });
      
      // Auto-trigger tutorial for first-time demo users, but only if they've seen the dashboard tutorial
      // or if they landed directly on competitors page
      if (tutorialCompleted !== 'true' && demoTutorialShown !== 'true' && !showTutorial && 
          !tutorialAutoTriggerRef.current &&
          (dashboardTutorialShown === 'true' || window.location.pathname === '/competitors')) {
        console.log('Competitors: Auto-triggering tutorial for demo user');
        tutorialAutoTriggerRef.current = true; // Prevent multiple triggers
        // Small delay to let the page fully load and data populate
        setTimeout(() => {
          setShowTutorial(true);
          sessionStorage.setItem('demo_competitors_tutorial_shown', 'true');
          notifications.showInfo('Welcome to Market Intelligence! Let\'s explore how to monitor your competitors.', {
            category: 'Tutorial',
            duration: 4000
          });
        }, 1500); // 1.5-second delay for better UX
      }
    }
  }, [isDemoMode, shop, authLoading, isAuthReady, competitors.length, showTutorial]); // Removed 'notifications' to prevent re-triggering

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
    
    // Ensure desktop table is expanded before row-action steps
    if (type === 'step:before' && typeof index === 'number') {
      const stepId = TUTORIAL_STEPS[index]?.id;
      if (stepId && ['row-refresh','row-graph','row-archive','more-actions'].includes(stepId)) {
        try {
          const expander = document.querySelector('.competitor-table .desktop-table');
          if (expander) {
            // Ensure section is expanded if collapsible
            const collapse = expander.closest('[data-testid="competitor-section"]');
            if (collapse) {
              const toggle = collapse.querySelector('button');
              if (toggle && collapse.getAttribute('data-collapsed') === 'true') {
                (toggle as HTMLButtonElement).click();
              }
            }
          }
        } catch (_) {
          // Ignore errors when expanding section for tutorial
        }
      }
    }

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
        category: 'Tutorial',
        showToast: true
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
        category: 'Tutorial',
        showToast: true
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
      const stepId = TUTORIAL_STEPS[index]?.id;
      if (stepId === 'show-archived') {
        setShowDeletedCompetitors(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-4 py-6 sm:px-6">
      <DemoModeBanner />
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#101820] p-6 text-white">
          <p className="text-sm font-black uppercase text-[#9db4ff]">Market Intelligence</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-white">Competitor price command</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#c3ccd5]">
            Track price movement, stock status, and market pressure from one retail intelligence board.
          </p>
        </div>

        {/* Limit Display */}
        <LimitDisplay />
        
        {/* Market Insights Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 market-insights-cards">
          {marketMetricCards.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="group relative overflow-hidden rounded-lg border border-[#e4e7eb] bg-white p-4 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)] transition-all duration-200 animate-slideUp hover:-translate-y-px hover:border-[#2f5bea]/40 hover:shadow-[0_22px_48px_-36px_rgba(16,24,32,0.88)] motion-reduce:animate-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-20 blur-2xl"
                  style={{ backgroundColor: metric.accent }}
                />
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-black uppercase"
                    style={{ backgroundColor: `${metric.accent}18`, color: metric.text }}
                  >
                    {metric.delta}
                  </span>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg border"
                    style={{ backgroundColor: `${metric.accent}14`, borderColor: `${metric.accent}26` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: metric.accent }} />
                  </div>
                </div>
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[#5f6b76]">{metric.label}</p>
                <p
                  className="mt-1 text-3xl font-black text-[#101820]"
                  style={{ color: metric.text, fontFeatureSettings: '"tnum"' }}
                >
                  <AnimatedStatValue value={metric.value} format={metric.format} />
                </p>
                <p className="mt-2 text-sm font-semibold text-[#5f6b76]">{metric.helper}</p>
              </div>
            );
          })}
        </div>

        {/* Demo Mode Notice */}


        {/* Control Panel */}
        <div className="rounded-lg border border-[#e4e7eb] bg-[#ffffff] p-4 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left side - Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1 filter-controls">
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-5 w-5 text-gray-500" />
                <div className="relative filter-dropdown">
                  <button
                    onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                    className="flex items-center gap-2 rounded-md border border-[#cbd5ce] bg-white px-3 py-2 text-sm font-semibold text-[#5f6b76] outline-none transition-colors hover:border-[#2f5bea] hover:bg-[#fafbfc] focus:ring-2 focus:ring-[#2f5bea]/20"
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
                  className="w-full rounded-md border border-[#cbd5ce] bg-white py-2 pl-10 pr-4 text-sm font-medium text-[#101820] outline-none transition-colors placeholder:text-[#8b96a2] hover:border-[#2f5bea] focus:border-[#2f5bea] focus:ring-2 focus:ring-[#2f5bea]/20"
                />
              </div>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Demo Mode Toggle - Only show if not in demo store */}
              {!isDemoStore(shop) && (
                <button
                  onClick={() => {
                    toggleDemoMode();
                    trackDemoInteraction('demo_toggle');
                  }}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all demo-toggle-button ${
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
              )}

              {/* Manual Discovery Button with 24hr Cooldown */}
              <button
                onClick={() => {
                  triggerManualDiscovery();
                  trackDemoInteraction('discovery_button');
                }}
                disabled={isDiscovering || discoveryStatus.isOnCooldown}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all shadow-md discovery-button ${
                  discoveryStatus.isOnCooldown 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
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
                  className="suggestions-button relative flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-blue-700 border border-blue-300 shadow-sm transition-all hover:bg-blue-50"
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
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all shadow-md add-competitor-button ${
                  isAdding 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {isAdding ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <PlusIcon className="h-4 w-4" />
                )}
                {isAdding ? 'Adding...' : 'Add'}
              </button>

              {/* Enhanced Refresh Button with Progress */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || refreshCooldown > 0}
                className={`refresh-button flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all shadow-md ${
                  isRefreshing || refreshCooldown > 0
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
                title={
                  isRefreshing && refreshProgress 
                    ? `Processing ${refreshProgress.percentage}% complete • ${refreshProgress.estimatedTimeRemaining} remaining • ${refreshSession?.totalDomains} domains`
                    : refreshCooldown > 0 
                      ? `Refresh available in ${Math.floor(refreshCooldown / 60)}m ${refreshCooldown % 60}s • Updates prices >24h old`
                      : 'Refresh competitor data • Updates prices >24h old'
                }
              >
                {isRefreshing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <ArrowPathIcon className="h-4 w-4" />
                )}
                {isRefreshing && refreshProgress
                  ? `${refreshProgress.percentage}% (${refreshProgress.completed}/${refreshSession?.totalCompetitors || 0})`
                  : isRefreshing 
                    ? 'Starting...' 
                    : refreshCooldown > 0
                      ? `${Math.floor(refreshCooldown / 60)}m ${refreshCooldown % 60}s`
                      : 'Refresh'
                }
              </button>

              {/* Deleted Competitors Button */}
              <button
                onClick={() => setShowDeletedCompetitors(!showDeletedCompetitors)}
                className={`archived-competitors-button flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all shadow-md ${
                  showDeletedCompetitors
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
                }`}
                title="View and restore archived competitors"
              >
                <ArchiveBoxIcon className="h-4 w-4" />
                Show Archived
              </button>


            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-1/2 relative">
                  <div className="relative url-tooltip-container">
                    <input
                      type="text"
                      placeholder="Competitor URL (e.g., https://amazon.com/dp/B07D3HG1SD)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isAdding}
                      className={`w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm bg-white hover:bg-gray-50 transition-colors ${
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
                              <InformationCircleIcon className="h-3 w-3 text-white" />
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

                <div className="w-full sm:w-1/2 relative">
                  <ProductSelector
                  value={productId}
                    onChange={setProductId}
                  disabled={isAdding}
                    shop={shop || undefined}
                    isDemoMode={isDemoMode}
                />
                </div>
                <button 
                  type="submit" 
                  disabled={isAdding}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md ${
                    isAdding 
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                      : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
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
        <div className="relative overflow-hidden rounded-lg border border-[#e4e7eb] bg-[#ffffff] shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]">
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
          
          <div className="border-b border-[#e4e7eb] bg-white/55 p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-black text-[#101820]">
                Market Intelligence
              </h2>
              <div className="rounded-full border border-[#e4e7eb] bg-white px-3 py-1 text-sm font-bold text-[#5f6b76]">
                {filteredCompetitors.length} of {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          
          {filteredCompetitors.length === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-[#c9d4ff] bg-[#e7ecff] shadow-[0_18px_42px_-34px_rgba(47,91,234,0.65)]">
                <ChartBarIcon className="h-8 w-8 text-[#2f5bea]" />
              </div>
              <h3 className="text-xl font-black text-[#101820] mb-2">
                {competitors.length === 0 ? 'No competitors yet' : 'No matches found'}
              </h3>
              <p className="text-sm leading-6 text-[#5f6b76] mb-5">
                {competitors.length === 0 
                  ? isDemoMode 
                    ? 'Demo mode is active. Add your first competitor to start monitoring real market data.'
                    : 'Start tracking your competitors to monitor their pricing strategies.'
                  : 'Try adjusting your filters or search query.'
                }
              </p>
              {competitors.length === 0 && !isDemoMode && (
                <div className="bg-[#fff8e5] border border-[#f7d37a] rounded-lg p-3 mb-5 max-w-md mx-auto text-left">
                  <p className="text-sm text-[#8a5b08]">
                    <strong>Tip:</strong> If you get a "sync products" message, visit your Dashboard first to load your Shopify products.
                  </p>
                </div>
              )}
              {competitors.length === 0 && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="rounded-md bg-[#2f5bea] px-5 py-3 text-sm font-black text-white shadow-[0_18px_38px_-28px_rgba(47,91,234,0.9)] transition-all duration-200 hover:-translate-y-px hover:bg-[#254bd6] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Add Your First Competitor
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Competitors Section */}
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="competitor-table">
                  <CompetitorTable 
                    data={filteredCompetitors} 
                    onDelete={handleDelete} 
                    onLinkProduct={handleLinkProduct}
                    onViewGraph={(competitor) => {
                      setSelectedCompetitorForGraph(competitor);
                      setShowGraphView(true);
                    }}
                    sectionTitle="Active"
                    sectionCount={filteredCompetitors.length}
                    sectionColor="green"
                    onToggleCollapse={() => setActiveSectionCollapsed(!activeSectionCollapsed)}
                    isCollapsed={activeSectionCollapsed}
                    onRefreshPrices={() => {
                      // Refresh the competitors data
                      fetchData();
                    }}
                    highlightedCompetitorId={highlightedCompetitorId}
                    highlightAction={highlightAction}
                  />
                </div>
              </div>
              
              {/* Archived Competitors Panel */}
              {showDeletedCompetitors && (
                <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="competitor-table">
                    <ArchivedCompetitorsPanel
                      shopId={isDemoMode ? 'demo' : (shop || 'demo')}
                      onCountChange={setArchivedCount}
                      sectionTitle="Archived"
                      sectionCount={archivedCount}
                      sectionColor="orange"
                      onToggleCollapse={() => setDeletedSectionCollapsed(!deletedSectionCollapsed)}
                      isCollapsed={deletedSectionCollapsed}
                      onCompetitorRestored={handleCompetitorRestored}
                      archivedLimit={limits?.archivedCompetitorLimit?.limit}
                      archivedCurrent={limits?.archivedCompetitorLimit?.currentCount}
                      refreshTrigger={archivedRefreshTrigger}
                      highlightedCompetitorId={highlightedCompetitorId}
                      highlightAction={highlightAction}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
         </div>
       </div>
      
      {/* Graph View Modal */}
      {showGraphView && selectedCompetitorForGraph && (
        <PriceHistoryModal
          competitor={selectedCompetitorForGraph}
          onClose={() => {
            setShowGraphView(false);
            setSelectedCompetitorForGraph(null);
          }}
          isDemoMode={isDemoMode}
        />
      )}
      
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
            primaryColor: '#2f5bea',
            textColor: '#1e293b',
            backgroundColor: '#fff',
          },
          tooltip: {
            borderRadius: 16,
            boxShadow: '0 8px 32px 0 rgba(47,91,234,0.10)',
            padding: 0,
            fontFamily: 'Inter, sans-serif',
          },
          buttonNext: {
            backgroundColor: '#2f5bea',
            color: '#fff',
            borderRadius: 8,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
          },
          buttonBack: {
            color: '#2f5bea',
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
        tooltipComponent={props => <ThemedJoyrideTooltip {...props} accentColor="#2f5bea" />}
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
      {showDemoSettings && !isDemoStore(shop) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[1300] flex items-center justify-center">
          <div className="mx-4 max-h-[90vh] max-w-lg overflow-y-auto rounded-lg bg-white p-6">
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
            background: 'linear-gradient(135deg, #101820 0%, #2f5bea 100%)',
            color: 'white',
            boxShadow: '0 4px 20px rgba(47, 91, 234, 0.3)',
            transition: 'all 0.3s ease',
          }}
        >
          <HelpOutlineIcon size={24} />
        </button>
      </div>

      {/* Product Association Modal */}
      {productAssociationModal.competitor && (
        <ProductAssociationModal
          open={productAssociationModal.open}
          onClose={handleCloseProductAssociationModal}
          competitorId={productAssociationModal.competitor.id}
          competitorUrl={productAssociationModal.competitor.url}
          competitorLabel={productAssociationModal.competitor.label}
          currentProductId={productAssociationModal.competitor.shopifyProductId}
          currentProductTitle={productAssociationModal.competitor.productTitle}
          onAssociationChange={handleProductAssociationChange}
          isDemoMode={isDemoMode}
        />
      )}

    </div>
  );
}
