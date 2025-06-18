import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const features = [
  'Real-time competitor price tracking',
  'Automated price change alerts',
  'Customizable dashboard',
  'Performance analytics',
  'Inventory management',
  'Sales forecasting'
];

const pricing = [
  {
    tier: 'Basic',
    price: '$29/month',
    features: [
      'Up to 5 competitors',
      'Basic analytics',
      'Email alerts',
      '24/7 support'
    ]
  },
  {
    tier: 'Pro',
    price: '$79/month',
    features: [
      'Up to 20 competitors',
      'Advanced analytics',
      'SMS & email alerts',
      'Priority support',
      'Custom reports'
    ]
  },
  {
    tier: 'Enterprise',
    price: '$199/month',
    features: [
      'Unlimited competitors',
      'Enterprise analytics',
      'API access',
      'Dedicated support',
      'Custom integrations',
      'White-label reports'
    ]
  }
];

const HomePage = () => {
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, logout } = useAuth();

  const handleLogin = () => {
    console.log('Login button clicked');
    setShowLoginForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with domain:', shopDomain);
    
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

      console.log('Redirecting to login with domain:', cleanDomain);
      
      // Add a small delay to ensure the loading state is visible
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect to the login endpoint
      window.location.href = `/api/auth/shopify/login?shop=${encodeURIComponent(cleanDomain)}`;
    } catch (error) {
      console.error('Error during login:', error);
      toast.error('Failed to initiate login. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center px-4 py-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-blue-900 mb-2">StoreSight</h1>
        <p className="text-lg text-blue-700 mb-4 max-w-2xl mx-auto">
          Unlock actionable analytics, competitor price alerts, and automated notifications for your Shopify store. 
          Grow faster with StoreSight's all-in-one dashboard and automation suite.
        </p>
        {!isAuthenticated && !showLoginForm && (
          <button 
            onClick={handleLogin}
            className="inline-flex items-center px-6 py-3 rounded-lg font-semibold shadow transition mb-2 bg-[#5A31F4] hover:bg-[#4A2FD4] text-white"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.5 0C5.6 0 0 5.6 0 12.5S5.6 25 12.5 25 25 19.4 25 12.5 19.4 0 12.5 0zm0 4.2c4.6 0 8.3 3.7 8.3 8.3s-3.7 8.3-8.3 8.3-8.3-3.7-8.3-8.3 3.7-8.3 8.3-8.3z"/>
            </svg>
            Start 3-Day Free Trial
          </button>
        )}
      </header>

      {/* Features Grid */}
      <section className="mb-12 w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-4 text-blue-800 text-center">Why StoreSight?</h2>
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
        <h2 className="text-2xl font-bold mb-4 text-blue-800 text-center">Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pricing.map((tier) => (
            <div key={tier.tier} className="bg-white rounded-lg shadow p-6 flex flex-col items-center border-2 border-blue-100 hover:border-blue-400 transition">
              <h3 className="text-xl font-semibold mb-2 text-blue-900">{tier.tier}</h3>
              <div className="text-3xl font-bold mb-4">{tier.price}</div>
              <ul className="mb-4 space-y-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center text-gray-700">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mr-1" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full max-w-3xl my-12">
        <h2 className="text-2xl font-bold mb-4 text-blue-800">What Merchants Say</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-700 italic mb-2">"StoreSight helped us spot price changes instantly. Our margins are up 15%!"</p>
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

      {/* Login Form Modal */}
      {showLoginForm && !isAuthenticated && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Connect Your Shopify Store</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="shopDomain" className="block text-sm font-medium text-gray-700">
                  Enter your Shopify store name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="shopDomain"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder="your-store-name"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    disabled={isLoading}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Just enter your store name (e.g., "your-store-name")
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowLoginForm(false)}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  disabled={isLoading}
                >
                  {isLoading ? 'Connecting...' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
