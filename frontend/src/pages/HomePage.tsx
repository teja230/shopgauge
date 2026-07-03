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
  'inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold bg-white text-blue-700 shadow-lg transition-colors duration-200 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed';
const heroSecondaryButton =
  'inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold bg-white/10 border border-white/30 text-white transition-colors duration-200 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed';

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
        className="flex-1 px-4 py-3 rounded-xl border border-white/30 bg-white/95 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none"
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
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24 flex flex-col items-center text-center">
          <span className="inline-flex items-center rounded-full bg-white/15 border border-white/25 px-4 py-1.5 text-sm font-medium mb-6">
            3-day free trial · $19.99/month after · Cancel anytime
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">ShopGauge</h1>
          <p className="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto mb-10">
            AI-powered analytics for your Shopify store — predictive forecasting, professional shareable charts,
            automated competitor discovery, and enterprise-grade collaboration for data-driven decisions.
          </p>

          {showAuthConnected ? (
            showConnectForm ? (
              <ConnectStoreForm
                shopDomain={shopDomain}
                onShopDomainChange={setShopDomain}
                onSubmit={handleLogin}
                isLoading={isLoading}
              />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 bg-white/95 rounded-2xl px-8 py-4 shadow-lg">
                  <span className="flex items-center justify-center w-10 h-10 bg-green-100 text-green-600 rounded-full">
                    <CheckCircle2 className="w-6 h-6" />
                  </span>
                  <div className="text-left">
                    <p className="text-gray-900 font-bold text-lg">Successfully connected</p>
                    <p className="text-gray-600 text-sm">Your store is ready for analytics</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => navigate('/dashboard')} className={heroPrimaryButton}>
                    <LayoutDashboard className="w-5 h-5 mr-2" />
                    Go to Dashboard
                  </button>
                  <button onClick={handleSwitchStore} className={heroSecondaryButton}>
                    <ArrowRightLeft className="w-5 h-5 mr-2" />
                    Switch Store
                  </button>
                </div>
              </div>
            )
          ) : showConnectForm ? (
            <ConnectStoreForm
              shopDomain={shopDomain}
              onShopDomainChange={setShopDomain}
              onSubmit={handleLogin}
              isLoading={isLoading}
            />
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button onClick={() => setShowConnectForm(true)} className={heroPrimaryButton}>
                <Store className="w-5 h-5 mr-2" />
                Connect Store
              </button>
              <button onClick={handleDemoMode} disabled={isLoading} className={heroSecondaryButton}>
                {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />}
                Try Demo
              </button>
            </div>
          )}
          <p className="text-sm text-blue-100/90 mt-6">
            No credit card required for trial · Explore instantly with sample data
          </p>
        </div>
      </section>

      {/* Error Display */}
      {errorMessage && (
        <div className="max-w-2xl mx-auto px-4 mt-10">
          <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-500 flex-shrink-0">
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
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Enterprise-Grade Analytics Platform</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {featureCategories.map(({ icon: Icon, title, items, note }) => (
            <div
              key={title}
              className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 text-primary-600 mb-4">
                <Icon className="w-6 h-6" />
              </span>
              <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
              <ul className="space-y-2 text-sm leading-relaxed text-gray-600">
                {items.map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="mt-1.5 mr-2 h-1.5 w-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
                {note && (
                  <li className="flex items-start font-medium text-primary-600">
                    <span className="mt-1.5 mr-2 h-1.5 w-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                    {note}
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* Core Features List */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <h3 className="text-2xl font-bold mb-6 text-gray-900 text-center">Complete Feature Set</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((f) => (
              <li key={f} className="flex items-start p-3 rounded-xl hover:bg-blue-50/60 transition-colors">
                <CheckCircle2 className="w-5 h-5 text-primary-500 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold mb-8 text-gray-900 text-center">What Merchants Say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <figure key={t.name} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <blockquote className="text-gray-600 mb-4">“{t.quote}”</blockquote>
              <figcaption>
                <div className="font-semibold text-gray-900">{t.name}</div>
                <div className="text-sm text-gray-500 mt-1">{t.stat}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold mb-8 text-gray-900 text-center">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {faqs.map((faq) => (
            <div key={faq.question} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-3 text-gray-900">{faq.question}</h3>
              <p className="text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
