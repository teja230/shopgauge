import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { shop, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isForceDisconnecting, setIsForceDisconnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [showPrivacyReport, setShowPrivacyReport] = useState(false);
  const [privacyReport, setPrivacyReport] = useState<any>(null);

  const handleReAuthenticate = async () => {
    try {
      setIsLoading(true);
      // Redirect to Shopify OAuth flow for re-authentication
      if (shop) {
        window.location.href = '/api/auth/shopify/login?shop=' + encodeURIComponent(shop);
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
      const res = await fetch('/api/auth/shopify/profile/force-disconnect', {
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
      const response = await fetch('/api/analytics/privacy/data-export', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `storesight-data-export-${shop}-${new Date().toISOString().split('T')[0]}.json`;
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
      const response = await fetch('/api/analytics/privacy/data-deletion', {
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
      const response = await fetch('/api/analytics/privacy/compliance-report', {
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile & Settings</h1>
      
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Store Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Shop Name</label>
            <div className="mt-1 text-gray-900">{shop}</div>
          </div>
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
            <a
              href="/PRIVACY_POLICY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              📋 Privacy Policy
            </a>
            
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

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              If you're experiencing permission issues or need to refresh your Shopify connection, 
              click the button below to re-authenticate with Shopify.
            </p>
            <button
              onClick={handleReAuthenticate}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Re-authenticating...' : 'Re-authenticate with Shopify'}
            </button>
          </div>
        </div>
      </div>

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