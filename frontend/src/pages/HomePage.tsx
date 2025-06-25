import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useNavigate, useLocation } from 'react-router-dom';
import { getInsights, fetchWithAuth } from '../api';
import { API_BASE_URL } from '../api';

const features = [
  'Real-time competitor price monitoring',
  'Automated price change alerts',
  'Shopify integration & analytics',
  'Competitor discovery & tracking',
  'Email & SMS notifications',
  'Custom dashboard & reports',
  'Data export & privacy controls',
  'GDPR/CCPA compliance'
];

const pricing = [
  {
    tier: 'Pro',
    price: '$19.99/month',
    features: [
      'Track unlimited competitors',
      'Real-time price monitoring',
      'Automated alerts (Email & SMS)',
      'Advanced analytics dashboard',
      'Competitor discovery tools',
      'Shopify integration',
      'Data export capabilities',
      'Priority support',
      'GDPR/CCPA compliance'
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
  const { isAuthenticated, authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      toast.error(decodeURIComponent(errorMsgFromUrl), {
        duration: 8000,
        position: 'top-center',
      });
      
      // Clear URL parameters after showing error
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Reset OAuth flow if there was an error
      setIsOAuthFlow(false);
    }
  }, [location.search, authLoading]);

  // Handle navigation after authentication
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      console.log('HomePage: User authenticated, checking for dashboard navigation');
      // If user is authenticated and we were waiting for auth, navigate to dashboard
      if (location.pathname === '/' && isOAuthFlow) {
        console.log('HomePage: Navigating to dashboard after OAuth completion');
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, authLoading, navigate, location.pathname, isOAuthFlow]);

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
      toast.error('Failed to switch store. Please try again.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopDomain) {
      toast.error('Please enter your store name');
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
      toast.error('Failed to connect to Shopify. Please try again.');
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
        <p className="text-lg text-blue-700 mb-4 max-w-2xl mx-auto">
          Unlock actionable analytics, competitor price alerts, and automated notifications for your Shopify store. 
          Grow faster with ShopGauge's all-in-one dashboard and automation suite.
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

      {/* Features Grid */}
      <section className="mb-12 w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-4 text-blue-800 text-center">Why ShopGauge?</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <li key={f} className="flex items-start bg-white rounded shadow p-4">
              <CheckCircleIcon className="w-6 h-6 text-blue-500 mr-2 mt-1" />
              <span className="text-gray-800">{f}</span>
            </li>
          ))}
        </ul>
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
      <section className="w-full max-w-3xl my-12">
        <h2 className="text-2xl font-bold mb-4 text-blue-800">What Merchants Say</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-700 italic mb-2">"ShopGauge helped us spot price changes instantly. Our margins are up 15%!"</p>
            <div className="font-semibold text-blue-900">— Alex, DTC Brand Owner</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-700 italic mb-2">"The dashboard is a game changer. I love the competitor alerts!"</p>
            <div className="font-semibold text-blue-900">— Priya, Shopify Merchant</div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="w-full max-w-4xl mt-12">
        <h2 className="text-2xl font-bold mb-4 text-blue-800 text-center">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2 text-blue-900">How does the 3-day free trial work?</h3>
            <p className="text-gray-700">Start with our 3-day free trial to explore all features. No credit card required. After the trial, choose a plan that fits your needs.</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2 text-blue-900">Can I change plans later?</h3>
            <p className="text-gray-700">Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2 text-blue-900">What payment methods do you accept?</h3>
            <p className="text-gray-700">We accept all major credit cards and PayPal. All payments are processed securely through our payment partners.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
