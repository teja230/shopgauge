import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { getInsights, fetchWithAuth } from '../api';
import { API_BASE_URL } from '../api';
import { useNotifications } from '../hooks/useNotifications';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const features = [
  'Real-time competitor price monitoring & alerts',
  'Advanced revenue analytics with 7 chart types',
  'Multi-session support for concurrent access',
  'Session-based notification system',
  'Automated price change notifications (Email & SMS)',
  'Shopify integration with comprehensive analytics',
  'Intelligent competitor discovery & tracking',
  'Admin dashboard with audit logging',
  'Enhanced security with session management',
  'Data export & privacy controls (GDPR/CCPA)',
  'Real-time dashboard with smart caching',
  'Debounced refresh controls for optimal performance'
];

const pricing = [
  {
    tier: 'Pro',
    price: '$19.99/month',
    features: [
      'Track unlimited competitors across multiple sessions',
      'Real-time price monitoring with instant alerts',
      '7 advanced chart types (Area, Bar, Candlestick, Waterfall, etc.)',
      'Multi-session concurrent access from any device',
      'Session-based notification system with privacy controls',
      'Automated alerts via Email & SMS with smart delivery',
      'Advanced analytics dashboard with intelligent caching',
      'AI-powered competitor discovery tools',
      'Comprehensive admin dashboard with audit logging',
      'Enhanced security with session isolation',
      'Full Shopify integration with real-time sync',
      'Data export capabilities with GDPR/CCPA compliance',
      'Priority support with dedicated assistance',
      'Enterprise-grade session management',
      'Advanced debugging and monitoring tools'
    ]
  }
];

const HomePage = () => {
  const [shopDomain, setShopDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isOAuthFlow, setIsOAuthFlow] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const { isAuthenticated, authLoading, logout, setShop } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();

  // Check if we're in an OAuth flow from Shopify or if there's an error
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const shopFromUrl = urlParams.get('shop');
    const errorFromUrl = urlParams.get('error');
    const errorMsgFromUrl = urlParams.get('error_message');
    
    if (shopFromUrl && !authLoading) {
      console.log('HomePage: Detected OAuth callback, shop will be processed by AuthContext');
      // Don't set isOAuthFlow here as AuthContext will handle the redirect
      // Just wait for the auth context to process the shop parameter
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
      
      // Reset OAuth flow if there was an error
      setIsOAuthFlow(false);
    }
  }, [location.search, authLoading, notifications]);

  // Handle navigation after authentication
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      console.log('HomePage: User authenticated, checking for redirect navigation');
      
      // Check for redirect parameter in URL
      const urlParams = new URLSearchParams(location.search);
      const redirectPath = urlParams.get('redirect');
      
      if (redirectPath) {
        console.log('HomePage: Found redirect parameter, navigating to:', redirectPath);
        navigate(redirectPath, { replace: true });
      } else if (location.pathname === '/' && isOAuthFlow) {
        console.log('HomePage: Navigating to dashboard after OAuth completion');
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, authLoading, navigate, location.pathname, location.search, isOAuthFlow]);

  // Determine if user is authenticated after auth check completes
  const showAuthConnected = isAuthenticated && !authLoading && !isOAuthFlow;

  const handleStartClick = () => {
    setShowForm(true);
    // Clear any previous errors when starting fresh
    setErrorMessage('');
    setErrorCode('');
  };

  const handleSwitchStore = async () => {
    try {
      // Clear current session first
      await logout();
      // Show the form for connecting a new store
      setShowForm(true);
      // Clear any previous errors
      setErrorMessage('');
      setErrorCode('');
    } catch (error) {
      console.error('Failed to switch store:', error);
      notifications.showError('Failed to switch store. Please try again.', {
        persistent: true,
        category: 'Connection'
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopDomain) {
      notifications.showError('Please enter your store name', {
        category: 'Validation'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Clean up the shop domain
      let cleanDomain = shopDomain.trim().toLowerCase();
      
      // Remove any protocol or www prefix
      cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '');
      
      // Remove any trailing slashes
      cleanDomain = cleanDomain.replace(/\/+$/, '');
      
      // If it doesn't end with .myshopify.com, add it
      if (!cleanDomain.endsWith('.myshopify.com')) {
        cleanDomain = `${cleanDomain}.myshopify.com`;
      }

      // Redirect to the login endpoint with the shop parameter
      window.location.href = `${API_BASE_URL}/api/auth/shopify/login?shop=${encodeURIComponent(cleanDomain)}`;
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

  // Show loading state for form submission only, not OAuth flow
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-blue-900 mb-2">Connecting to Shopify...</h2>
          <p className="text-blue-700">Please wait while we redirect you to Shopify for authentication.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center px-4 py-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-blue-900 mb-2">ShopGauge</h1>
        <p className="text-lg text-blue-700 mb-4 max-w-4xl mx-auto">
          Enterprise-grade analytics platform with multi-session support, 7 advanced chart types, and intelligent notifications. 
          Empower your team with concurrent access, comprehensive audit logging, and GDPR-compliant data management. 
          Transform your Shopify store with real-time insights and automated competitor monitoring.
        </p>
        {showAuthConnected ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="text-green-600 font-semibold mb-2">✓ You're already connected!</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center px-6 py-3 rounded-lg font-semibold shadow transition bg-[#5A31F4] hover:bg-[#4A2FD4] text-white"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.5 0C5.6 0 0 5.6 0 12.5S5.6 25 12.5 25 25 19.4 25 12.5 19.4 0 12.5 0zm0 4.2c4.6 0 8.3 3.7 8.3 8.3s-3.7 8.3-8.3 8.3-8.3-3.7-8.3-8.3 3.7-8.3 8.3-8.3z"/>
                  </svg>
                  Go to Dashboard
                </button>
                <button
                  onClick={handleSwitchStore}
                  className="inline-flex items-center px-6 py-3 rounded-lg font-semibold shadow transition border-2 border-[#5A31F4] text-[#5A31F4] bg-white hover:bg-[#5A31F4] hover:text-white"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Switch Store
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {!showForm ? (
              <button
                onClick={handleStartClick}
                className="inline-flex items-center px-6 py-3 rounded-lg font-semibold shadow transition bg-[#5A31F4] hover:bg-[#4A2FD4] text-white"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.5 0C5.6 0 0 5.6 0 12.5S5.6 25 12.5 25 25 19.4 25 12.5 19.4 0 12.5 0zm0 4.2c4.6 0 8.3 3.7 8.3 8.3s-3.7 8.3-8.3 8.3-8.3-3.7-8.3-8.3 3.7-8.3 8.3-8.3z"/>
                </svg>
                Start 3-Day Free Trial
              </button>
            ) : (
              <form onSubmit={handleLogin} className="flex flex-col items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
                  <input
                    type="text"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder="Enter your store name (e.g. mystore)"
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center px-6 py-2 rounded-lg font-semibold shadow transition bg-[#5A31F4] hover:bg-[#4A2FD4] text-white disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.5 0C5.6 0 0 5.6 0 12.5S5.6 25 12.5 25 25 19.4 25 12.5 19.4 0 12.5 0zm0 4.2c4.6 0 8.3 3.7 8.3 8.3s-3.7 8.3-8.3 8.3-8.3-3.7-8.3-8.3 3.7-8.3 8.3-8.3z"/>
                        </svg>
                        Connect Store
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500">Enter your store name without .myshopify.com</p>
              </form>
            )}
          </div>
        )}
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
                    onClick={handleStartClick}
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

      {/* Advanced Features Showcase */}
      <section className="mb-12 w-full max-w-6xl">
        <h2 className="text-3xl font-bold mb-8 text-blue-800 text-center">Enterprise-Grade Analytics Platform</h2>
        
        {/* Feature Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="text-blue-600 mb-4">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-blue-900 mb-3">Advanced Analytics</h3>
            <ul className="text-gray-700 space-y-2">
              <li>• 7 chart types (Area, Bar, Candlestick, Waterfall)</li>
              <li>• Real-time data with intelligent caching</li>
              <li>• Revenue trend analysis & forecasting</li>
              <li>• Performance metrics dashboard</li>
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

      {/* Pricing Section */}
      <section className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-4 text-blue-800 text-center">Simple, Transparent Pricing</h2>
        <div className="flex justify-center">
          <div className="bg-white rounded-lg shadow p-8 flex flex-col items-center border-2 border-blue-100 hover:border-blue-400 transition max-w-md w-full">
            <h3 className="text-2xl font-semibold mb-2 text-blue-900">{pricing[0].tier}</h3>
            <div className="text-4xl font-bold mb-6">{pricing[0].price}</div>
            <ul className="mb-6 space-y-3 w-full">
              {pricing[0].features.map((f) => (
                <li key={f} className="flex items-center text-gray-700">
                  <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" /> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={showAuthConnected ? () => navigate('/dashboard') : handleStartClick}
              className="w-full inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold shadow transition bg-[#5A31F4] hover:bg-[#4A2FD4] text-white"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.5 0C5.6 0 0 5.6 0 12.5S5.6 25 12.5 25 25 19.4 25 12.5 19.4 0 12.5 0zm0 4.2c4.6 0 8.3 3.7 8.3 8.3s-3.7 8.3-8.3 8.3-8.3-3.7-8.3-8.3 3.7-8.3 8.3-8.3z"/>
              </svg>
              {showAuthConnected ? 'Go to Dashboard' : 'Start 3-Day Free Trial'}
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full max-w-4xl my-12">
        <h2 className="text-2xl font-bold mb-6 text-blue-800 text-center">What Merchants Say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
            <p className="text-gray-700 italic mb-3">"ShopGauge's multi-session support lets my team work simultaneously from different locations. The advanced charts show trends we never saw before!"</p>
            <div className="font-semibold text-blue-900">— Alex, DTC Brand Owner</div>
            <div className="text-sm text-gray-500 mt-1">Revenue increased 25% in 3 months</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
            <p className="text-gray-700 italic mb-3">"The session-based notifications are brilliant! No more mixed alerts between team members. The waterfall charts reveal our growth patterns perfectly."</p>
            <div className="font-semibold text-blue-900">— Priya, Shopify Merchant</div>
            <div className="text-sm text-gray-500 mt-1">Improved team efficiency by 40%</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
            <p className="text-gray-700 italic mb-3">"The admin dashboard with audit logging gives us complete visibility. GDPR compliance made easy with comprehensive session management."</p>
            <div className="font-semibold text-blue-900">— Marcus, E-commerce Director</div>
            <div className="text-sm text-gray-500 mt-1">Enterprise-grade security & compliance</div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="w-full max-w-5xl mt-12">
        <h2 className="text-2xl font-bold mb-6 text-blue-800 text-center">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-blue-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">How does the 3-day free trial work?</h3>
            <p className="text-gray-700">Start with our 3-day free trial to explore all features including multi-session support, advanced charts, and notification system. No credit card required. Full access to enterprise-grade features.</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-green-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">What makes your analytics different?</h3>
            <p className="text-gray-700">We offer 7 advanced chart types (Area, Bar, Candlestick, Waterfall, etc.) with intelligent caching, real-time updates, and session-based data isolation for team collaboration.</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-purple-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">How does multi-session support work?</h3>
            <p className="text-gray-700">Multiple team members can access your shop simultaneously from different devices/browsers. Each session is isolated with private notifications and secure session management.</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-orange-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">Is my data secure and compliant?</h3>
            <p className="text-gray-700">Yes! We provide enterprise-grade security with audit logging, GDPR/CCPA compliance, session isolation, and comprehensive admin controls for complete data protection.</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-red-500">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">Can I change plans later?</h3>
            <p className="text-gray-700">Absolutely! Upgrade or downgrade anytime. Changes take effect immediately with prorated billing. All your data, sessions, and configurations are preserved.</p>
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
