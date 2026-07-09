import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useNotifications } from '../hooks/useNotifications';
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  LayoutDashboard,
  LineChart,
  Loader2,
  PackageCheck,
  Play,
  RefreshCw,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { normalizeShopDomain } from '../utils/normalizeShopDomain';
import IntelligentLoadingScreen from '../components/ui/IntelligentLoadingScreen';

const features = [
  'AI-Powered Revenue Forecasting with 7-60 day predictions and confidence intervals',
  'Professional Export Options: PNG (3 quality levels), PDF (templates), Excel (full data series)',
  '7 Advanced Chart Types including Area, Line, Bar, Candlestick, Waterfall, Stacked, and Composed views with predictive analytics',
  'Intelligent Color Separation for Historical vs Forecast data visualization',
  'Track up to 10 competitors with intelligent monitoring and price alerts',
  'Real-time price monitoring with automated competitor discovery',
  'Multi-session concurrent access from up to 5 devices with team collaboration',
  'Session-based notification system with granular privacy controls',
  'Social Media Integration: LinkedIn, Twitter, Email, Slack, Teams with chart-relevant messaging',
  'Enhanced Mobile Experience with optimized chart loading and responsive design',
  'Advanced analytics dashboard with intelligent caching and 120-minute retention',
  'AI-powered market intelligence with automated competitor suggestions',
  'Comprehensive admin dashboard with audit logging and compliance monitoring',
  'Enhanced security with session isolation and enterprise-grade data protection',
  'Full Shopify integration with real-time sync and OAuth 2.0 authentication',
  'GDPR/CCPA compliance with automated data export and privacy reporting',
  'Instant file downloads with professional templates and auto-generated messaging',
  'Enterprise-grade session management with automatic cleanup and optimization'
];

const featureCategories = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard Experience',
    accent: '#2f5bea',
    tint: '#e7ecff',
    items: [
      'Beautiful, intuitive dashboard with instant insights',
      'Real-time revenue, orders, and conversion tracking',
      'One-click chart switching between 7 visualization types',
      'Mobile-optimized interface for on-the-go monitoring',
      'Smart notifications for important business milestones',
    ],
  },
  {
    icon: TrendingUp,
    title: 'AI-Powered Forecasting',
    accent: '#15b87a',
    tint: '#dff8ea',
    items: [
      '7 advanced chart types with predictive analytics',
      '7-60 day revenue forecasting with confidence intervals',
      'Intelligent color separation for historical vs forecast data',
      'Professional shareable charts with PNG/PDF export',
      'Enhanced mobile experience with optimized loading',
    ],
  },
  {
    icon: Share2,
    title: 'Professional Sharing & Export',
    accent: '#f59e0b',
    tint: '#fff1cf',
    items: [
      'Export in PNG (Standard/High/Ultra quality), PDF (professional templates), Excel (full data series)',
      'Share on LinkedIn, Twitter, Email, Slack, Teams with chart-relevant messaging',
      'Professional Templates: Executive, Investor, Marketing PDF formats with metadata',
      'Chart-Relevant Messaging: Auto-generated professional content for social sharing',
    ],
  },
  {
    icon: Target,
    title: 'Market Intelligence',
    accent: '#f9734d',
    tint: '#ffe4d8',
    items: [
      'AI-powered competitor discovery and analysis',
      'Real-time price monitoring with automated alerts',
      'Strategic positioning insights and recommendations',
      'Track up to 10 competitors with intelligent monitoring',
    ],
    note: 'Unlimited competitor tracking coming soon!',
  },
  {
    icon: Users,
    title: 'Multi-Session Support',
    accent: '#2f5bea',
    tint: '#e7ecff',
    items: [
      'Concurrent access from up to 5 devices',
      'Session-based notification privacy',
      'Team collaboration without conflicts',
      'Secure session isolation & management',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    accent: '#101820',
    tint: '#eef1f4',
    items: [
      'Comprehensive audit logging',
      'GDPR/CCPA compliance built-in',
      'Admin dashboard with full control',
      'Advanced debugging & monitoring',
    ],
  },
];

const testimonials = [
  {
    quote:
      'The AI-powered forecasting with confidence intervals helps us plan inventory perfectly. The professional chart exports made our board presentation look incredible!',
    name: 'Alex, DTC Brand Owner',
    stat: 'Revenue forecasting accuracy: 94%',
  },
  {
    quote:
      'Love the color separation between historical and forecast data! The LinkedIn integration lets me share our growth milestones effortlessly with professional templates.',
    name: 'Priya, Shopify Merchant',
    stat: 'Social engagement increased 60%',
  },
  {
    quote:
      'The 7 chart types with predictive analytics give us insights we never had. The Executive template PDFs are perfect for investor updates!',
    name: 'Marcus, E-commerce Director',
    stat: 'Investment confidence improved dramatically',
  },
];

const socialProofStats = [
  {
    value: '10',
    label: 'competitors tracked',
    description: 'per store with intelligent monitoring',
    icon: Store,
  },
  {
    value: '7-60',
    label: 'day forecasts',
    description: 'revenue, order, and conversion outlooks',
    icon: TrendingUp,
  },
  {
    value: '85-95%',
    label: 'planning accuracy',
    description: 'typical range with clean historical data',
    icon: CheckCircle2,
  },
];

const faqs = [
  {
    question: 'How accurate is the AI forecasting?',
    answer:
      'Our AI-powered forecasting uses advanced algorithms with confidence intervals to predict revenue, orders, and conversion rates 7-60 days ahead. Historical accuracy averages 85-95% depending on data quality and market conditions.',
  },
  {
    question: 'What export and sharing options are available?',
    answer:
      'Export charts as PNG (3 quality levels), PDF (professional templates with metadata), and Excel (full data series). Share directly on LinkedIn, Twitter, Email, Slack, and Teams with auto-generated professional messaging. All files download instantly with no waiting time.',
  },
  {
    question: 'How do the 7 chart types work?',
    answer:
      'Choose from Line, Area, Bar, Candlestick, Waterfall, Stacked, and Composed charts. Each chart type offers unique insights with intelligent color separation between historical (blue/green/amber) and forecast (lighter/dashed) data.',
  },
  {
    question: 'Is my data secure and compliant?',
    answer:
      'Yes! We provide enterprise-grade security with audit logging, GDPR/CCPA compliance, session isolation, and comprehensive admin controls for complete data protection.',
  },
  {
    question: 'What happens after my free trial?',
    answer:
      "After your 3-day free trial, you'll be automatically enrolled in our Pro plan at $19.99/month. You can cancel anytime with no commitment. All your data, sessions, and configurations are preserved.",
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards, PayPal, and enterprise billing options. All transactions are processed securely with industry-standard encryption and audit trails.',
  },
];

const heroPrimaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-[#2f5bea] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_34px_-24px_rgba(47,91,234,0.9)] transition-colors duration-200 hover:bg-[#244bd4] disabled:cursor-not-allowed disabled:opacity-50';
const heroSecondaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-colors duration-200 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50';

interface ConnectStoreFormProps {
  shopDomain: string;
  onShopDomainChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

const ConnectStoreForm: React.FC<ConnectStoreFormProps> = ({
  shopDomain,
  onShopDomainChange,
  onSubmit,
  isLoading,
}) => (
  <form onSubmit={onSubmit} className="flex flex-col items-center gap-4 w-full">
    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
      <input
        type="text"
        value={shopDomain}
        onChange={(e) => onShopDomainChange(e.target.value)}
        placeholder="Enter your store name or full URL"
        className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading || !normalizeShopDomain(shopDomain)} className={heroPrimaryButton}>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Store className="w-5 h-5 mr-2" />
            Connect Store
          </>
        )}
      </button>
    </div>
  </form>
);

const Reveal: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-500 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'
      }`}
    >
      {children}
    </div>
  );
};

const HomePage = () => {
  const [shopDomain, setShopDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const { isAuthenticated, shop, authLoading, logout, setShop, hasInitiallyLoaded } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();

  // Check if we're in an OAuth flow from Shopify or if there's an error
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const shopFromUrl = urlParams.get('shop');
    const errorFromUrl = urlParams.get('error');
    const errorMsgFromUrl = urlParams.get('error_message');
    
    if (shopFromUrl && hasInitiallyLoaded) {
      console.log('HomePage: Detected OAuth callback, shop will be processed by AuthContext');
      // The AuthContext will handle the OAuth flow
      return;
    }
    
    if (errorFromUrl && errorMsgFromUrl) {
      setErrorCode(errorFromUrl);
      setErrorMessage(decodeURIComponent(errorMsgFromUrl));
      console.log('HomePage: Detected error from OAuth callback:', errorFromUrl, errorMsgFromUrl);
      
      // Show error toast
      notifications.showError(decodeURIComponent(errorMsgFromUrl), {
        persistent: true,
        category: 'Connection',
        duration: 8000
      });
      
      // Clear URL parameters after showing error
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [location.search, hasInitiallyLoaded, notifications]);

  // Handle redirect after successful authentication (only when explicitly requested)
  useEffect(() => {
    if (isAuthenticated && hasInitiallyLoaded && !authLoading) {
      console.log('HomePage: User authenticated, checking for explicit redirect');
      
      // Only handle explicit redirect parameters, don't auto-redirect
      const urlParams = new URLSearchParams(location.search);
      const redirectPath = urlParams.get('redirect');
      
      if (redirectPath) {
        console.log('HomePage: Found explicit redirect parameter, navigating to:', redirectPath);
        // Clean up URL parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('redirect');
        window.history.replaceState({}, '', newUrl.toString());
        
        // Navigate to the requested path
        navigate(redirectPath, { replace: true });
      } else {
        console.log('HomePage: No explicit redirect requested, staying on home page');
      }
    }
  }, [isAuthenticated, hasInitiallyLoaded, authLoading, navigate, location.search]);

  // Determine if user is authenticated and ready to show connected state
  const showAuthConnected = isAuthenticated && hasInitiallyLoaded && !authLoading;

  const handleSwitchStore = () => {
    // Show the connect form for switching stores
    setShowConnectForm(true);
    setShopDomain(''); // Clear any existing domain
  };

  // Utility: comprehensive dashboard cache clearing (same logic as in AuthContext)
  const clearAllDashboardCache = () => {
    sessionStorage.removeItem('dashboard_cache_v1.1');
    sessionStorage.removeItem('dashboard_cache_v2');
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('dashboard_cache') || key.includes('unified_analytics_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    console.log('HomePage: Cleared all dashboard and unified analytics cache keys');
  };

  const handleDemoMode = async () => {
    setIsLoading(true);
    try {
      console.log('🚀 HomePage: Starting UI-only demo mode (no backend calls)');
      
      // Clear any existing cache before demo
      sessionStorage.clear();
      localStorage.clear();
      
      // UI-only demo mode - no backend API calls to reduce Redis/DB load
      // All data comes from embedded DEMO_DATA_BUNDLE
      const demoShop = 'demo-shopgauge.myshopify.com';
      
      // Set up demo session for tutorial system
      sessionStorage.setItem('demo_session_started', new Date().toISOString());
      sessionStorage.setItem('demo_mode_active', 'true');
      
      // Clear any previous tutorial completion for fresh demo experience
      localStorage.removeItem(`dashboard_tutorial_completed_${demoShop}`);
      localStorage.removeItem(`tutorialCompleted_${demoShop}`);
      
      // Set demo mode flags (UI-only, no backend session)
      localStorage.setItem('demo_mode_active', 'true');
      localStorage.setItem('isAuthenticated', 'true');
      
      console.log('✅ HomePage: UI-only demo mode activated');
      
      // Navigate to dashboard in demo mode
      window.location.href = '/dashboard?demo=true';
      
    } catch (error) {
      console.error('❌ Demo mode error:', error);
      notifications.showError(
        error instanceof Error ? error.message : 'Failed to start demo mode. Please try again.',
        {
          persistent: true,
          category: 'Demo'
        }
      );
      setIsLoading(false); // Only reset loading on error (success will redirect)
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDomain = normalizeShopDomain(shopDomain);
    if (!cleanDomain) {
      notifications.showError('Please enter a valid Shopify store URL or name', {
        category: 'Validation'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Smart cache preservation: Preserve session storage for optimal cache strategy
      const currentShop = shop; // From AuthContext
      if (currentShop && currentShop !== cleanDomain) {
        console.log(`🔄 Switching from ${currentShop} to ${cleanDomain} - clearing session storage for new shop`);
        clearAllDashboardCache(); // Clear sessionStorage for different shop
      } else if (currentShop === cleanDomain) {
        console.log(`✅ Same shop (${cleanDomain}) - preserving session storage for optimal cache strategy`);
        // Don't clear session storage for same shop login - let the optimal strategy handle it
      } else {
        console.log(`🆕 New shop login (${cleanDomain}) - preserving session storage for optimal cache strategy`);
        // Don't clear session storage for new shop login - let the optimal strategy handle it
      }

      // Build return URL for post-OAuth loading
      const baseUrl = `${window.location.origin}/dashboard`;
      const returnUrl = encodeURIComponent(`${baseUrl}?connected=true&skip_loading=true`);

      // Show immediate feedback before redirect
      notifications.showInfo('Connecting to Shopify...', {
        category: 'Store Connection',
        duration: 2000
      });

      // Redirect to the login endpoint
      window.location.href = `${API_BASE_URL}/api/auth/shopify/login?shop=${encodeURIComponent(cleanDomain)}&return_url=${returnUrl}`;
    } catch (error) {
      console.error('Login failed:', error);
      notifications.showError('Failed to connect to Shopify. Please try again.', {
        persistent: true,
        category: 'Connection'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state for form submission only
  if (isLoading) {
    return <IntelligentLoadingScreen message="Connecting to Shopify..." fastMode={true} />;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#101820]">
      {/* Hero */}
      <section
        className="relative overflow-hidden bg-[#101820] text-white"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 12%, rgba(47, 91, 234, 0.28), transparent 30%), radial-gradient(circle at 82% 18%, rgba(21, 184, 122, 0.18), transparent 26%), linear-gradient(180deg, #101820 0%, #0b1016 100%)',
        }}
      >
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:min-h-[calc(100vh-152px)] lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-12">
          <div>
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-bold text-[#b9c8ff]">
              Commerce command center · 3-day trial
            </span>
            <h1 className="mt-6 text-5xl font-black leading-none text-white sm:text-6xl lg:text-7xl">
              ShopGauge
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#c3ccd5]">
              A focused operating room for Shopify merchants: forecast revenue, watch competitors,
              spot inventory risk, and ask AI what to do next.
            </p>

            <div className="mt-7 grid max-w-xl grid-cols-3 gap-3 text-sm">
              {[
                ['Forecast', '7-60 day outlook'],
                ['Monitor', 'Price movement'],
                ['Act', 'AI next steps'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                  <p className="font-bold text-white">{label}</p>
                  <p className="mt-1 text-xs text-[#9aa5b1]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              {showAuthConnected ? (
                showConnectForm ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
                    <ConnectStoreForm
                      shopDomain={shopDomain}
                      onShopDomainChange={setShopDomain}
                      onSubmit={handleLogin}
                      isLoading={isLoading}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex max-w-md items-center gap-3 rounded-lg border border-[#15b87a]/40 bg-[#15b87a]/15 px-4 py-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#15b87a] text-white">
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-bold text-white">Store connected</p>
                        <p className="text-sm text-[#aab5c0]">Your command center is ready.</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button onClick={() => navigate('/dashboard')} className={heroPrimaryButton}>
                        <LayoutDashboard className="mr-2 h-5 w-5" />
                        Go to Dashboard
                      </button>
                      <button onClick={handleSwitchStore} className={heroSecondaryButton}>
                        <ArrowRightLeft className="mr-2 h-5 w-5" />
                        Switch Store
                      </button>
                    </div>
                  </div>
                )
              ) : showConnectForm ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
                  <ConnectStoreForm
                    shopDomain={shopDomain}
                    onShopDomainChange={setShopDomain}
                    onSubmit={handleLogin}
                    isLoading={isLoading}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button onClick={() => setShowConnectForm(true)} className={heroPrimaryButton}>
                    <Store className="mr-2 h-5 w-5" />
                    Connect Store
                  </button>
                  <button onClick={handleDemoMode} disabled={isLoading} className={heroSecondaryButton}>
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                    Try Demo
                  </button>
                </div>
              )}
            </div>

            <p className="mt-5 text-sm text-[#8b96a2]">
              No credit card required for trial. Explore instantly with sample data.
            </p>
          </div>

          <div
            className="animate-float rounded-lg border border-white/10 bg-[#0b1016] p-3 shadow-[0_42px_110px_-52px_rgba(0,0,0,0.95),0_0_80px_-44px_rgba(47,91,234,0.95)] motion-reduce:animate-none"
            style={{ animationDuration: '6s' }}
          >
            <div className="grid overflow-hidden rounded-md border border-white/10 bg-[#161c24] lg:grid-cols-[76px_1fr]">
              <div className="hidden border-r border-white/10 bg-[#0d1218] p-3 lg:block">
                <div className="mb-6 h-9 w-9 rounded-md bg-[#2f5bea]" />
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className={item === 1 ? 'h-9 rounded-md bg-white/12' : 'h-9 rounded-md bg-white/[0.05]'} />
                  ))}
                </div>
              </div>
              <div className="space-y-3 bg-[#f6f7f9] p-4 text-[#101820]">
                {/* Header */}
                <div
                  className="flex flex-col gap-3 rounded-md border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                  style={{ backgroundImage: 'linear-gradient(135deg, #101820 0%, #0b1016 100%)' }}
                >
                  <div>
                    <p className="text-[11px] font-black uppercase text-[#9db4ff]">Operating overview</p>
                    <p className="mt-1 text-lg font-black text-white">Dashboard</p>
                    <p className="mt-1 text-xs text-[#c3ccd5]">
                      Revenue, orders, inventory risk, and forecast signals for demo-shopgauge.myshopify.com.
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 self-start rounded-md border border-white/25 px-3 py-1.5 text-xs font-bold text-white">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </span>
                </div>

                {/* Metric cards */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {([
                    [TrendingUp, '$26.9K', 'Total Revenue', '30.0% last 7d', 'up'],
                    [BarChart3, '2.50%', 'Conversion Rate', '3.4% vs previous', 'up'],
                    [ClipboardList, '14', 'Abandoned Carts', '3.8% attention', 'down'],
                    [PackageCheck, '8', 'Low Inventory', '8 items', 'down'],
                    [Store, '3', 'New Products', 'New catalog', 'up'],
                  ] as const).map(([Icon, value, label, delta, direction]) => (
                    <div key={label as string} className="rounded-md border border-[#e4e7eb] bg-white p-2.5 shadow-sm">
                      <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-full border border-[#2f5bea]/20 bg-[#2f5bea]/[0.08] text-[#2f5bea]">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-[10px] font-bold uppercase text-[#5f6b76]">{label}</p>
                      <p className="mt-0.5 text-lg font-black text-[#101820]">{value}</p>
                      <p className={`mt-0.5 text-[10px] font-bold ${direction === 'up' ? 'text-[#15b87a]' : 'text-[#f9734d]'}`}>
                        {delta}
                      </p>
                      <div className="mt-2 grid grid-cols-8 items-end gap-0.5">
                        {[10, 14, 12, 20, 18, 26, 22, 30].map((height, barIndex) => (
                          <div
                            key={barIndex}
                            className={`h-6 rounded-sm ${barIndex < 4 ? 'bg-[#2f5bea]' : 'bg-[#15b87a]'} opacity-55`}
                            style={{ height: `${height}px`, alignSelf: 'end' }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action queue */}
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    [PackageCheck, '8 products low on stock', 'Restock before you miss sales.', 'Review products', '#b45309', 'rgba(245,158,11,0.10)', 'rgba(245,158,11,0.35)'],
                    [ShoppingCart, '24 abandoned checkouts', 'Recover potential revenue with follow-ups.', 'View checkouts', '#1d3db8', 'rgba(47,91,234,0.08)', 'rgba(47,91,234,0.30)'],
                    [Sparkles, 'Not sure what to tackle first?', 'Ask ShopGPT for a prioritized plan.', 'Ask ShopGPT', '#0f766e', 'rgba(14,165,166,0.08)', 'rgba(14,165,166,0.30)'],
                  ] as const).map(([Icon, title, sub, cta, fg, bg, border]) => (
                    <div
                      key={title as string}
                      className="relative rounded-md border bg-white p-3 shadow-sm"
                      style={{ borderColor: border as string }}
                    >
                      <span className="absolute right-2 top-2 text-[#98a1ab]">
                        <X className="h-3.5 w-3.5" />
                      </span>
                      <span
                        className="mb-2 flex h-8 w-8 items-center justify-center rounded-md"
                        style={{ backgroundColor: bg as string, color: fg as string }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="pr-4 text-xs font-black text-[#101820]">{title}</p>
                      <p className="mt-0.5 text-[11px] text-[#5f6b76]">{sub}</p>
                      <p className="mt-1.5 text-[11px] font-bold" style={{ color: fg as string }}>
                        {cta}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Forecasting workspace */}
                <div className="flex flex-col gap-2 rounded-md border border-[#e4e7eb] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e8edff] text-[#2f5bea]">
                      <LineChart className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[11px] font-black uppercase text-[#2f5bea]">Forecasting workspace</p>
                      <p className="text-[11px] text-[#5f6b76]">Classic trends or AI-powered forecasting.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-md border border-[#e4e7eb] bg-[#f6f7f9] p-0.5 text-[10px] font-bold">
                      <span className="rounded-md bg-white px-2 py-1 text-[#101820] shadow-sm">Classic</span>
                      <span className="px-2 py-1 text-[#5f6b76]">AI forecasts</span>
                    </div>
                    <span className="flex items-center gap-1 rounded-md bg-[#2f5bea] px-2.5 py-1.5 text-[10px] font-bold text-white">
                      <Sparkles className="h-3 w-3" />
                      Try AI
                    </span>
                  </div>
                </div>

                {/* Revenue chart */}
                <div className="rounded-md border border-[#e4e7eb] bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#e4e7eb] pb-2">
                    <p className="flex items-center gap-1.5 text-sm font-black text-[#101820]">
                      <TrendingUp className="h-4 w-4 text-[#2f5bea]" />
                      Revenue Chart
                    </p>
                    <div className="flex gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2f5bea] text-white">
                        <Share2 className="h-3 w-3" />
                      </span>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#15b87a] text-white">
                        <Download className="h-3 w-3" />
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {[
                      ['Total Revenue', '$29,862.43'],
                      ['Average Daily', '$995.41'],
                      ['Peak Day', '$1,180.26'],
                      ['Latest', '$1,153.81'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-[#e4e7eb] bg-[#f6f7f9] p-1.5">
                        <p className="text-[9px] font-bold uppercase text-[#5f6b76]">{label}</p>
                        <p className="text-[11px] font-black text-[#101820]">{value}</p>
                      </div>
                    ))}
                  </div>

                  <svg viewBox="0 0 300 90" className="mt-3 h-24 w-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2f5bea" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#2f5bea" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,60 L20,40 L40,52 L60,30 L80,58 L100,44 L120,20 L140,34 L160,54 L180,26 L200,46 L220,58 L240,24 L260,42 L280,16 L300,36 L300,90 L0,90 Z"
                      fill="url(#revenueFill)"
                    />
                    <path
                      d="M0,60 L20,40 L40,52 L60,30 L80,58 L100,44 L120,20 L140,34 L160,54 L180,26 L200,46 L220,58 L240,24 L260,42 L280,16 L300,36"
                      fill="none"
                      stroke="#2f5bea"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error Display */}
      {errorMessage && (
        <div className="mx-auto mt-10 max-w-2xl px-4">
          <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <div className="flex items-start">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-red-50 text-red-500">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {errorCode === 'code_used' ? 'Authorization Link Expired' : 'Connection Error'}
                </h3>
                <p className="mt-1 text-gray-600">{errorMessage}</p>
                <button
                  onClick={() => {
                    setErrorMessage('');
                    setErrorCode('');
                  }}
                  className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social Proof */}
      <section className="border-b border-[#e4e7eb] bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
          {socialProofStats.map(({ value, label, description, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-lg border border-[#e4e7eb] bg-[#fbfcfd] p-4 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.72)]"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-[#c9d4ff] bg-[#e7ecff] text-[#2f5bea]">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-black text-[#101820]" style={{ fontFeatureSettings: '"tnum"' }}>{value}</p>
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[#5f6b76]">{label}</p>
                <p className="mt-1 text-sm text-[#5f6b76]">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Categories */}
      <Reveal>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#2f5bea]">Merchant workflows</p>
          <h2 className="mt-2 text-3xl font-black text-[#101820]">Built for daily merchant decisions</h2>
          <p className="mt-3 text-[#5f6b76]">
            The product experience should put revenue, inventory, competition, and AI guidance within one scan.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {featureCategories.map(({ icon: Icon, title, items, note, accent, tint }) => (
            <div
              key={title}
              className="group rounded-lg border border-[#e4e7eb] bg-[#ffffff] p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)] transition-all duration-200 hover:-translate-y-px hover:border-[#2f5bea]/35 hover:shadow-[0_22px_48px_-36px_rgba(16,24,32,0.88)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md border transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                style={{ backgroundColor: tint, borderColor: `${accent}33`, color: accent }}
              >
                <Icon className="w-6 h-6" />
              </span>
              <h3 className="mb-3 text-lg font-black text-[#101820]">{title}</h3>
              <ul className="space-y-2 text-sm leading-relaxed text-[#5f6b76]">
                {items.slice(0, 3).map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="mr-2 mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#15b87a]" />
                    {item}
                  </li>
                ))}
                {note && (
                  <li className="flex items-start font-bold text-[#2f5bea]">
                    <span className="mr-2 mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#2f5bea]" />
                    {note}
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* Core Features List */}
        <div className="border-y border-[#e4e7eb] py-10">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#2f5bea]">Included capabilities</p>
          <h3 className="mb-6 mt-2 text-2xl font-black text-[#101820]">Complete feature set</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.slice(0, 9).map((f) => (
              <li key={f} className="flex items-start rounded-md border border-transparent bg-white/50 p-3 transition-all duration-200 hover:border-[#e4e7eb] hover:bg-white motion-reduce:transition-none">
                <CheckCircle2 className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-[#15b87a]" />
                <span className="text-[#5f6b76]">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      </Reveal>

      {/* Testimonials */}
      <Reveal>
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#2f5bea]">Merchant proof</p>
          <h2 className="mt-2 text-2xl font-black text-[#101820]">What merchants say</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="rounded-lg border border-[#e4e7eb] bg-[#ffffff] p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)] transition-all duration-200 hover:-translate-y-px hover:border-[#2f5bea]/35 hover:shadow-[0_22px_48px_-36px_rgba(16,24,32,0.88)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <blockquote className="mb-5 text-[#5f6b76]">&quot;{t.quote}&quot;</blockquote>
              <figcaption className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#101820] text-sm font-black text-white">
                  {t.name
                    .split(',')[0]
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <div>
                  <div className="font-bold text-[#101820]">{t.name}</div>
                  <div className="mt-1 text-sm text-[#5f6b76]">{t.stat}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      </Reveal>

      {/* FAQ */}
      <Reveal>
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#2f5bea]">Details</p>
          <h2 className="mt-2 text-2xl font-black text-[#101820]">Frequently asked questions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-lg border border-[#e4e7eb] bg-[#ffffff] p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]">
              <h3 className="mb-3 text-lg font-black text-[#101820]">{faq.question}</h3>
              <p className="text-[#5f6b76]">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
      </Reveal>
    </div>
  );
};

export default HomePage;
