import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useNotifications } from '../hooks/useNotifications';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  Play,
  Share2,
  ShieldCheck,
  Store,
  Target,
  TrendingUp,
  Users,
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
    name: '— Alex, DTC Brand Owner',
    stat: 'Revenue forecasting accuracy: 94%',
  },
  {
    quote:
      'Love the color separation between historical and forecast data! The LinkedIn integration lets me share our growth milestones effortlessly with professional templates.',
    name: '— Priya, Shopify Merchant',
    stat: 'Social engagement increased 60%',
  },
  {
    quote:
      'The 7 chart types with predictive analytics give us insights we never had. The Executive template PDFs are perfect for investor updates!',
    name: '— Marcus, E-commerce Director',
    stat: 'Investment confidence improved dramatically',
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
      <section className="bg-[#101820] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:min-h-[calc(100vh-72px)] lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-14">
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

          <div className="rounded-lg border border-white/10 bg-[#0b1016] p-3 shadow-[0_34px_90px_-48px_rgba(0,0,0,0.9)]">
            <div className="grid overflow-hidden rounded-md border border-white/10 bg-[#161c24] lg:grid-cols-[76px_1fr]">
              <div className="hidden border-r border-white/10 bg-[#0d1218] p-3 lg:block">
                <div className="mb-6 h-9 w-9 rounded-md bg-[#2f5bea]" />
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className={item === 1 ? 'h-9 rounded-md bg-white/12' : 'h-9 rounded-md bg-white/[0.05]'} />
                  ))}
                </div>
              </div>
              <div className="bg-[#f6f7f9] p-4 text-[#101820]">
                <div className="flex flex-col gap-3 border-b border-[#e4e7eb] pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase text-[#5f6b76]">Today&apos;s command queue</p>
                    <p className="mt-1 text-xl font-black">Revenue pulse</p>
                  </div>
                  <span className="rounded-full border border-[#b3c4f5] bg-[#e8edff] px-3 py-1 text-xs font-black text-[#1d3db8]">
                    demo-shopgauge.myshopify.com
                  </span>
                </div>

                <div className="grid gap-3 py-4 sm:grid-cols-4">
                  {[
                    ['$26.9K', 'Revenue', '#2f5bea'],
                    ['187', 'Orders', '#15b87a'],
                    ['8', 'Low stock', '#f59e0b'],
                    ['8', 'Price moves', '#f9734d'],
                  ].map(([value, label, color]) => (
                    <div key={label} className="rounded-md border border-[#e4e7eb] bg-white p-3 shadow-sm">
                      <div className="mb-3 h-1.5 w-10 rounded-full" style={{ backgroundColor: color }} />
                      <p className="text-2xl font-black text-[#101820]">{value}</p>
                      <p className="mt-1 text-xs font-bold text-[#5f6b76]">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
                  <div className="rounded-md border border-[#e4e7eb] bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-black">Forecast curve</p>
                      <p className="text-xs font-bold text-[#15b87a]">+12.4% projected</p>
                    </div>
                    <div className="flex h-56 items-end gap-2">
                      {[36, 48, 42, 64, 58, 72, 68, 83, 78, 90, 86, 96].map((height, index) => (
                        <div key={index} className="flex h-full flex-1 flex-col justify-end">
                          <div
                            className={index > 8 ? 'rounded-t bg-[#15b87a]' : 'rounded-t bg-[#2f5bea]'}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {[
                      ['AI next action', 'Restock 8 low-inventory products before the weekend.', '#2f5bea'],
                      ['Market signal', 'Competitors moved prices on 8 tracked products.', '#7c9cff'],
                      ['Margin watch', 'Two products are under your safe floor.', '#f9734d'],
                    ].map(([label, text, color]) => (
                      <div key={label} className="rounded-md border border-[#e4e7eb] bg-white p-3 shadow-sm">
                        <div className="mb-2 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        <p className="text-xs font-black uppercase text-[#5f6b76]">{label}</p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-[#24312b]">{text}</p>
                      </div>
                    ))}
                  </div>
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

      {/* Feature Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <h2 className="text-3xl font-black text-[#101820]">Built for daily merchant decisions</h2>
          <p className="mt-3 text-[#5f6b76]">
            The product experience should put revenue, inventory, competition, and AI guidance within one scan.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {featureCategories.map(({ icon: Icon, title, items, note }) => (
            <div
              key={title}
              className="rounded-lg border border-[#e4e7eb] bg-[#ffffff] p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#e8edff] text-[#1d3db8]">
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
        <div className="border-y border-[#e4e7eb] py-8">
          <h3 className="mb-6 text-2xl font-black text-[#101820]">Complete feature set</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.slice(0, 9).map((f) => (
              <li key={f} className="flex items-start rounded-md bg-white/50 p-3 transition-colors hover:bg-white">
                <CheckCircle2 className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-[#15b87a]" />
                <span className="text-[#5f6b76]">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-black text-[#101820]">What merchants say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <figure key={t.name} className="rounded-lg border border-[#e4e7eb] bg-[#ffffff] p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]">
              <blockquote className="mb-4 text-[#5f6b76]">“{t.quote}”</blockquote>
              <figcaption>
                <div className="font-bold text-[#101820]">{t.name}</div>
                <div className="mt-1 text-sm text-[#5f6b76]">{t.stat}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-black text-[#101820]">Frequently asked questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-lg border border-[#e4e7eb] bg-[#ffffff] p-6 shadow-[0_18px_42px_-36px_rgba(16,24,32,0.75)]">
              <h3 className="mb-3 text-lg font-black text-[#101820]">{faq.question}</h3>
              <p className="text-[#5f6b76]">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
