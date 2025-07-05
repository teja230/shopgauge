import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { useNotifications } from '../hooks/useNotifications';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { normalizeShopDomain } from '../utils/normalizeShopDomain';
import IntelligentLoadingScreen from '../components/ui/IntelligentLoadingScreen';

const features = [
  'AI-Powered Revenue Forecasting with 7-60 day predictions and confidence intervals',
  'Professional Shareable Charts with PNG, PDF export and social media integration',
  '9 Advanced Chart Types including Line, Area, Bar, Candlestick, Waterfall, and Composed views',
  'Intelligent Color Separation for Historical vs Forecast data visualization',
  'Track up to 10 competitors with intelligent monitoring and price alerts',
  'Real-time price monitoring with automated competitor discovery',
  'Multi-session concurrent access from any device with team collaboration',
  'Session-based notification system with granular privacy controls',
  'Professional Chart Templates for Executive, Investor, and Marketing presentations',
  'Enhanced Mobile Experience with optimized chart loading and responsive design',
  'Advanced analytics dashboard with intelligent caching and 120-minute retention',
  'AI-powered market intelligence with automated competitor suggestions',
  'Comprehensive admin dashboard with audit logging and compliance monitoring',
  'Enhanced security with session isolation and enterprise-grade data protection',
  'Full Shopify integration with real-time sync and OAuth 2.0 authentication',
  'GDPR/CCPA compliance with automated data export and privacy reporting',
  'Priority support with dedicated assistance and comprehensive documentation',
  'Enterprise-grade session management with automatic cleanup and optimization'
];

const HomePage = () => {
  const [shopDomain, setShopDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const { isAuthenticated, authLoading, logout, setShop, hasInitiallyLoaded } = useAuth();
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
      // Clear any existing dashboard cache before switching stores
      clearAllDashboardCache();

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center px-4 py-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-blue-900 mb-2">ShopGauge</h1>
        <p className="text-lg text-blue-700 mb-4 max-w-4xl mx-auto">
          AI-Powered Analytics Platform with predictive forecasting, professional shareable charts, and intelligent visualization. 
          Generate executive-ready reports, share insights on social media, and make data-driven decisions with confidence intervals and trend analysis.
          Transform your Shopify store with advanced chart types, automated competitor discovery, and enterprise-grade team collaboration.
        </p>
      </header>

      {/* Error Display Section */}
      {errorMessage && (
        <div className="mb-8 w-full max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-red-800">
                  {errorCode === 'code_used' ? 'Authorization Link Expired' : 'Connection Error'}
                </h3>
                <p className="mt-2 text-red-700">{errorMessage}</p>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setErrorMessage('');
                      setErrorCode('');
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Section */}
      <section className="mb-12 w-full max-w-4xl">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">🚀 Limited Time Offer</h2>
          <p className="text-xl mb-6 opacity-90">Start your 3-day free trial today and unlock enterprise-grade analytics!</p>
          
          {/* Pricing Display */}
          <div className="mb-6">
            <div className="text-3xl font-bold mb-2">$19.99/month</div>
            <div className="text-lg opacity-80">after 3-day free trial</div>
          </div>
          
          {/* Action section */}
          <div className="mt-8 flex flex-col items-center">
            {showAuthConnected ? (
              showConnectForm ? (
                <form onSubmit={handleLogin} className="flex flex-col items-center gap-4 w-full">
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                    <input
                      type="text"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      placeholder="Enter your store name or full URL"
                      className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-white/90 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !normalizeShopDomain(shopDomain)}
                      className="inline-flex items-center px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-300 bg-white/90 backdrop-blur-sm border border-white/20 text-blue-600 hover:bg-white hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          Connect Store
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm border-2 border-green-500 rounded-xl px-8 py-4 shadow-xl">
                    <div className="flex items-center justify-center w-10 h-10 bg-green-500 rounded-full shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-green-800 font-bold text-xl drop-shadow-sm">Successfully Connected!</p>
                      <p className="text-green-700 text-base font-semibold">Your store is ready for analytics</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="inline-flex items-center px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-300 bg-white/90 backdrop-blur-sm border border-white/20 text-blue-600 hover:bg-white hover:shadow-xl"
                    >
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                      </svg>
                      Go to Dashboard
                    </button>
                    <button
                      onClick={handleSwitchStore}
                      className="inline-flex items-center px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-300 bg-white/90 backdrop-blur-sm border border-white/20 text-blue-600 hover:bg-white hover:shadow-xl"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Switch Store
                    </button>
                  </div>
                </div>
              )
            ) : (
              showConnectForm ? (
                <form onSubmit={handleLogin} className="flex flex-col items-center gap-4 w-full">
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                    <input
                      type="text"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      placeholder="Enter your store name or full URL"
                      className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-white/90 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !normalizeShopDomain(shopDomain)}
                      className="inline-flex items-center px-6 py-3 rounded-xl font-semibold shadow-lg transition-all duration-300 bg-white/90 backdrop-blur-sm border border-white/20 text-blue-600 hover:bg-white hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          Connect Store
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowConnectForm(true)}
                  className="inline-flex items-center px-8 py-4 rounded-xl font-semibold shadow-xl transition-all duration-300 bg-white/90 backdrop-blur-sm border border-white/20 text-blue-600 hover:bg-white hover:shadow-2xl transform hover:scale-105 active:scale-95"
                >
                  <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Connect Store
                </button>
              )
            )}
            <p className="text-sm opacity-90 mt-6 text-white">No credit card required • Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* Advanced Features Showcase */}
      <section className="mb-12 w-full max-w-6xl">
        <h2 className="text-3xl font-bold mb-8 text-blue-800 text-center">Enterprise-Grade Analytics Platform</h2>
        
        {/* Feature Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="text-blue-600 mb-4">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-blue-900 mb-3">🚀 AI-Powered Forecasting</h3>
            <ul className="text-gray-700 space-y-2">
              <li>• 9 advanced chart types with predictive analytics</li>
              <li>• 7-60 day revenue forecasting with confidence intervals</li>
              <li>• Intelligent color separation for historical vs forecast data</li>
              <li>• Professional shareable charts with PNG/PDF export</li>
              <li>• Enhanced mobile experience with optimized loading</li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
            <div className="text-green-600 mb-4">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-green-900 mb-3">Multi-Session Support</h3>
            <ul className="text-gray-700 space-y-2">
              <li>• Concurrent access from multiple devices</li>
              <li>• Session-based notification privacy</li>
              <li>• Team collaboration without conflicts</li>
              <li>• Secure session isolation & management</li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
            <div className="text-orange-600 mb-4">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-orange-900 mb-3">📊 Professional Sharing</h3>
            <ul className="text-gray-700 space-y-2">
              <li>• Executive, Investor, and Marketing chart templates</li>
              <li>• LinkedIn, Twitter, and Email social integration</li>
              <li>• High-resolution PNG and professional PDF exports</li>
              <li>• Auto-generated professional messaging templates</li>
              <li>• Privacy controls with data anonymization options</li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
            <div className="text-red-600 mb-4">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-red-900 mb-3">🎯 Market Intelligence</h3>
            <ul className="text-gray-700 space-y-2">
              <li>• AI-powered competitor discovery and analysis</li>
              <li>• Real-time price monitoring with automated alerts</li>
              <li>• Strategic positioning insights and recommendations</li>
              <li>• Track up to 10 competitors with intelligent monitoring</li>
              <li className="text-red-600 font-medium">• Unlimited competitor tracking coming soon!</li>
            </ul>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
            <div className="text-purple-600 mb-4">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-purple-900 mb-3">Enterprise Security</h3>
            <ul className="text-gray-700 space-y-2">
              <li>• Comprehensive audit logging</li>
              <li>• GDPR/CCPA compliance built-in</li>
              <li>• Admin dashboard with full control</li>
              <li>• Advanced debugging & monitoring</li>
            </ul>
          </div>
        </div>

        {/* Core Features List */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
          <h3 className="text-2xl font-bold mb-6 text-blue-900 text-center">Complete Feature Set</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <li key={f} className="flex items-start p-3 rounded-lg hover:bg-blue-50 transition-colors">
                <CheckCircleIcon className="w-5 h-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-gray-800 font-medium">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full max-w-4xl my-12">
        <h2 className="text-2xl font-bold mb-6 text-blue-800 text-center">What Merchants Say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
            <p className="text-gray-700 italic mb-3">"The AI-powered forecasting with confidence intervals helps us plan inventory perfectly. The professional chart exports made our board presentation look incredible!"</p>
            <div className="font-semibold text-blue-900">— Alex, DTC Brand Owner</div>
            <div className="text-sm text-gray-500 mt-1">Revenue forecasting accuracy: 94%</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
            <p className="text-gray-700 italic mb-3">"Love the color separation between historical and forecast data! The LinkedIn integration lets me share our growth milestones effortlessly with professional templates."</p>
            <div className="font-semibold text-blue-900">— Priya, Shopify Merchant</div>
            <div className="text-sm text-gray-500 mt-1">Social engagement increased 60%</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
                            <p className="text-gray-700 italic mb-3">"The 7 chart types with predictive analytics give us insights we never had. The Executive template PDFs are perfect for investor updates!"</p>
            <div className="font-semibold text-blue-900">— Marcus, E-commerce Director</div>
            <div className="text-sm text-gray-500 mt-1">Investment confidence improved dramatically</div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="w-full max-w-5xl mt-12">
        <h2 className="text-2xl font-bold mb-6 text-blue-800 text-center">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-blue-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">How accurate is the AI forecasting?</h3>
            <p className="text-gray-700">Our AI-powered forecasting uses advanced algorithms with confidence intervals to predict revenue, orders, and conversion rates 7-60 days ahead. Historical accuracy averages 85-95% depending on data quality and market conditions.</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-green-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">What export formats are available?</h3>
            <p className="text-gray-700">Export your charts as high-resolution PNG images, professional PDF reports, or share directly on LinkedIn and Twitter. Choose from Executive, Investor, and Marketing templates with auto-generated messaging.</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-purple-500">
                            <h3 className="text-lg font-semibold mb-3 text-blue-900">How do the 7 chart types work?</h3>
            <p className="text-gray-700">Choose from Line, Area, Bar, Candlestick, Waterfall, Stacked, Composed, and more. Each chart type offers unique insights with intelligent color separation between historical (blue/green/amber) and forecast (purple/pink/orange) data.</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-orange-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">Is my data secure and compliant?</h3>
            <p className="text-gray-700">Yes! We provide enterprise-grade security with audit logging, GDPR/CCPA compliance, session isolation, and comprehensive admin controls for complete data protection.</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-red-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">What happens after my free trial?</h3>
            <p className="text-gray-700">After your 3-day free trial, you'll be automatically enrolled in our Pro plan at $19.99/month. You can cancel anytime with no commitment. All your data, sessions, and configurations are preserved.</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-indigo-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">What payment methods do you accept?</h3>
            <p className="text-gray-700">We accept all major credit cards, PayPal, and enterprise billing options. All transactions are processed securely with industry-standard encryption and audit trails.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
