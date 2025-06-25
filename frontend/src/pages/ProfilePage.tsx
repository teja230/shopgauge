import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../api';

export default function ProfilePage() {
  const { shop, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isForceDisconnecting, setIsForceDisconnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [showPrivacyReport, setShowPrivacyReport] = useState(false);
  const [privacyReport, setPrivacyReport] = useState<any>(null);
  const [showStoreSwitcher, setShowStoreSwitcher] = useState(false);
  const [newStoreDomain, setNewStoreDomain] = useState('');
  const [isConnectingStore, setIsConnectingStore] = useState(false);
  const navigate = useNavigate();

  const handleReAuthenticate = async () => {
    try {
      setIsLoading(true);
      // Redirect to Shopify OAuth flow for re-authentication
      if (shop) {
        window.location.href = `${API_BASE_URL}/api/auth/shopify/login?shop=${encodeURIComponent(shop)}`;
      } else {
        toast.error('No shop found. Please disconnect and reconnect.');
      }
    } catch (error) {
      console.error('Re-authentication failed:', error);
      toast.error('Failed to re-authenticate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShopDisconnect = async () => {
    try {
      // Use the AuthContext logout function which properly handles state clearing
      await logout();
    } catch (error) {
      console.error('Error disconnecting shop:', error);
      toast.error('Failed to disconnect shop');
    }
  };

  const handleForceDisconnect = async () => {
    setIsForceDisconnecting(true);
    console.log('Force disconnect: Starting with shop:', shop);
    
    if (!shop) {
      toast.error('No shop found to disconnect');
      setIsForceDisconnecting(false);
      return;
    }
    
    try {
      console.log('Force disconnect: Calling API with shop:', shop);
      const res = await fetch(`${API_BASE_URL}/api/auth/shopify/profile/force-disconnect`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      });
      
      console.log('Force disconnect: Response status:', res.status);
      const data = await res.json();
      console.log('Force disconnect: Response data:', data);
      
      if (res.ok) {
        toast.success('Force disconnect successful! All tokens and cookies cleared.');
        console.log('Force disconnect: Success, redirecting to home');
        // Clear local state immediately
        // Note: We can't call logout here as it would cause a loop
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        console.error('Force disconnect: API error:', data);
        toast.error('Force disconnect failed: ' + (data?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Force disconnect: Network error:', error);
      toast.error('Force disconnect failed: Network error');
    } finally {
      setIsForceDisconnecting(false);
    }
  };

  const handleDataExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/privacy/data-export`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shopgauge-data-export-${shop}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Data export completed successfully!');
      } else {
        const error = await response.json();
        toast.error('Data export failed: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Data export failed:', error);
      toast.error('Data export failed: Network error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDataDeletion = async () => {
    if (!confirm('⚠️ This will permanently delete all your data from our systems. This action cannot be undone. Are you sure?')) {
      return;
    }

    setIsDeletingData(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/privacy/data-deletion`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: 'ALL_SHOP_DATA' }),
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success('All data has been permanently deleted from our systems!');
        console.log('Data deletion completed:', result);
        // Logout after successful deletion
        setTimeout(() => {
          logout();
        }, 2000);
      } else {
        const error = await response.json();
        toast.error('Data deletion failed: ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Data deletion failed:', error);
      toast.error('Data deletion failed: Network error');
    } finally {
      setIsDeletingData(false);
    }
  };

  const handlePrivacyReport = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/privacy/compliance-report`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const report = await response.json();
        setPrivacyReport(report);
        setShowPrivacyReport(true);
      } else {
        toast.error('Failed to load privacy report');
      }
    } catch (error) {
      console.error('Privacy report failed:', error);
      toast.error('Privacy report failed: Network error');
    }
  };

  const handleConnectNewStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreDomain) {
      toast.error('Please enter a store domain');
      return;
    }

    setIsConnectingStore(true);
    try {
      // Clean up the shop domain
      let cleanDomain = newStoreDomain.trim().toLowerCase();
      
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
      console.error('Failed to connect new store:', error);
      toast.error('Failed to connect store. Please try again.');
    } finally {
      setIsConnectingStore(false);
    }
  };

  const handleSwitchStore = () => {
    // Clear current session and show store connection form
    logout();
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile & Settings</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🏪</span>
          Store Information
        </h2>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Store</label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-50 px-3 py-2 rounded-md border">
                    <span className="text-gray-900 font-mono text-sm">{shop}</span>
                  </div>
                  <div className="flex items-center text-green-600">
                    <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">Active</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connection Status</label>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Active Shopify Integration</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Data Sync</label>
                <div className="text-sm text-gray-600">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Collection</label>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Orders, Analytics, & Metrics</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Need to update your store connection?</span>
                <p className="text-xs text-gray-500 mt-1">Re-authenticate with Shopify if you're experiencing issues</p>
              </div>
              <button
                onClick={handleReAuthenticate}
                disabled={isLoading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Re-authenticating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Re-authenticate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Store Management Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <span className="mr-2">🔄</span>
          Store Management
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Switch Store</h3>
              <p className="text-sm text-gray-600">Connect additional stores or switch between connected stores</p>
            </div>
            <button
              onClick={() => setShowStoreSwitcher(!showStoreSwitcher)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {showStoreSwitcher ? 'Hide' : 'Manage Stores'}
            </button>
          </div>
          
          {showStoreSwitcher && (
            <div className="border-t pt-4 space-y-4">
              {/* Current Store */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900">Current Store</h4>
                    <p className="text-sm text-blue-700">{shop}</p>
                  </div>
                  <div className="flex items-center text-blue-600">
                    <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">Active</span>
                  </div>
                </div>
              </div>
              
              {/* Connect New Store */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Connect New Store</h4>
                <form onSubmit={handleConnectNewStore} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newStoreDomain}
                    onChange={(e) => setNewStoreDomain(e.target.value)}
                    placeholder="Enter store name (e.g. mystore)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isConnectingStore}
                  />
                  <button
                    type="submit"
                    disabled={isConnectingStore}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isConnectingStore ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Connect Store
                      </>
                    )}
                  </button>
                </form>
                <p className="text-xs text-gray-500 mt-1">Enter your store name without .myshopify.com</p>
              </div>
              
              {/* Quick Actions */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => window.location.href = '/'}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Go to Home
                  </button>
                  <button
                    onClick={() => window.location.href = '/dashboard'}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Privacy & Data Rights Section */}
      <div className="bg-blue-50 shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🔒 Privacy & Data Rights</h2>
        <p className="text-sm text-gray-600 mb-4">
          StoreSignt respects your privacy and provides full transparency about data processing. 
          Exercise your data rights using the controls below.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <button
              onClick={handlePrivacyReport}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              📊 View Privacy Report
            </button>
            
            <button
              onClick={handleDataExport}
              disabled={isExporting}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isExporting ? '⏳ Exporting...' : '📥 Export My Data'}
            </button>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate('/privacy-policy')}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              📋 Privacy Policy
            </button>
            
            <button
              onClick={handleDataDeletion}
              disabled={isDeletingData}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {isDeletingData ? '⏳ Deleting...' : '🗑️ Delete All My Data'}
            </button>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-gray-500">
          <p><strong>Data Retention:</strong> Order data (60 days), Analytics (90 days), Audit logs (365 days)</p>
          <p><strong>Your Rights:</strong> Access, Export, Delete, Opt-out (GDPR/CCPA compliant)</p>
        </div>
      </div>

      {/* Privacy Report Modal */}
      {showPrivacyReport && privacyReport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Privacy Compliance Report</h3>
                <button
                  onClick={() => setShowPrivacyReport(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div className="bg-green-50 p-3 rounded-md">
                  <h4 className="font-medium text-green-800">Compliance Status</h4>
                  <p className="text-green-700">{privacyReport.compliance_status}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-md">
                    <h5 className="font-medium text-gray-800">Data Minimization</h5>
                    <p className="text-sm text-gray-600">{privacyReport.data_minimization}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <h5 className="font-medium text-gray-800">Purpose Limitation</h5>
                    <p className="text-sm text-gray-600">{privacyReport.purpose_limitation}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <h5 className="font-medium text-gray-800">Retention Policy</h5>
                    <p className="text-sm text-gray-600">{privacyReport.retention_policy}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <h5 className="font-medium text-gray-800">Encryption</h5>
                    <p className="text-sm text-gray-600">{privacyReport.encryption}</p>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-md">
                  <h5 className="font-medium text-blue-800">Today's Audit Logs</h5>
                  <p className="text-sm text-blue-600">{privacyReport.audit_logs_today} access events logged</p>
                </div>
                
                <div className="text-xs text-gray-500">
                  <p>Last Updated: {privacyReport.last_updated}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Danger Zone</h2>
        <div className="space-y-4">
          <div>
            <button
              onClick={handleShopDisconnect}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Disconnect Store
            </button>
          </div>
          <div>
            <button
              onClick={handleForceDisconnect}
              disabled={isForceDisconnecting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
            >
              {isForceDisconnecting ? 'Force Disconnecting...' : 'Force Disconnect (Clear All)'}
            </button>
            <p className="text-xs text-yellow-700 mt-2">Use this if normal disconnect does not fully log you out or clear backend data.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 