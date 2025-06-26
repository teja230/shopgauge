import React, { useEffect, useState } from 'react';
import { CompetitorTable } from '../components/ui/CompetitorTable';
import type { Competitor } from '../components/ui/CompetitorTable';
import { SuggestionDrawer } from '../components/ui/SuggestionDrawer';
import { 
  getCompetitors, 
  addCompetitor, 
  deleteCompetitor, 
  getCompetitorSuggestions, 
  getSuggestionCount, 
  refreshSuggestionCount as refreshSuggestionCountAPI,
  getDebouncedSuggestionCount,
  approveSuggestion, 
  ignoreSuggestion 
} from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { 
  SparklesIcon, 
  PlusIcon, 
  EyeIcon, 
  ChartBarIcon,
  PlayIcon,
  StopIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import type { CompetitorSuggestion } from '../api';
import { useNotifications } from '../hooks/useNotifications';

// Demo data for when SerpAPI is not configured
const DEMO_COMPETITORS: Competitor[] = [
  {
    id: '1',
    url: 'https://amazon.com/dp/B08N5WRWNW',
    label: 'Amazon - Echo Dot (4th Gen)',
    price: 49.99,
    inStock: true,
    percentDiff: 0,
    lastChecked: '2 hours ago'
  },
  {
    id: '2',
    url: 'https://amazon.com/dp/B08C7W5L7D',
    label: 'Amazon - Fire TV Stick 4K',
    price: 39.99,
    inStock: true,
    percentDiff: -15.2,
    lastChecked: '1 hour ago'
  },
  {
    id: '3',
    url: 'https://amazon.com/dp/B08N5KWB9H',
    label: 'Amazon - Echo Show 8',
    price: 0,
    inStock: false,
    percentDiff: 0,
    lastChecked: '30 minutes ago'
  },
  {
    id: '4',
    url: 'https://amazon.com/dp/B07FZ8S74R',
    label: 'Amazon - Echo Plus (2nd Gen)',
    price: 149.99,
    inStock: true,
    percentDiff: 8.5,
    lastChecked: '15 minutes ago'
  }
];

// Demo suggestions for when SerpAPI is not configured
const DEMO_SUGGESTIONS: CompetitorSuggestion[] = [
  {
    id: 1,
    suggestedUrl: 'https://amazon.com/dp/B09B9Y6Y7H',
    title: 'Amazon - Echo Dot (5th Gen) - Smart Speaker',
    price: 49.99,
    source: 'GOOGLE_SHOPPING',
    discoveredAt: '2024-01-15T10:30:00Z',
    status: 'NEW'
  },
  {
    id: 2,
    suggestedUrl: 'https://amazon.com/dp/B08N5WRWNW',
    title: 'Amazon - Echo Dot (4th Gen) - Smart Speaker with Alexa',
    price: 39.99,
    source: 'GOOGLE_SHOPPING',
    discoveredAt: '2024-01-15T09:15:00Z',
    status: 'NEW'
  },
  {
    id: 3,
    suggestedUrl: 'https://amazon.com/dp/B07FZ8S74R',
    title: 'Amazon - Echo Plus (2nd Gen) - Premium Smart Speaker',
    price: 149.99,
    source: 'GOOGLE_SHOPPING',
    discoveredAt: '2024-01-15T08:45:00Z',
    status: 'NEW'
  }
];

export default function CompetitorsPage() {
  const { shop } = useAuth();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [filteredCompetitors, setFilteredCompetitors] = useState<Competitor[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [url, setUrl] = useState('');
  const [productId, setProductId] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'inStock' | 'outOfStock'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const notifications = useNotifications();

  useEffect(() => {
    // Clear data if no shop (logout/disconnect)
    if (!shop) {
      setCompetitors([]);
      setFilteredCompetitors([]);
      setUrl('');
      setProductId('');
      setIsDemoMode(false);
      return;
    }

    async function fetchData() {
      try {
        setIsLoading(true);
        const [competitorsData, suggestionCountData] = await Promise.all([
          getCompetitors(),
          getDebouncedSuggestionCount()
        ]);
        
        // If no competitors and no suggestions, enable demo mode
        if (competitorsData.length === 0 && suggestionCountData.newSuggestions === 0) {
          setIsDemoMode(true);
          setCompetitors(DEMO_COMPETITORS);
          setSuggestionCount(DEMO_SUGGESTIONS.length); // Show demo suggestions count
        } else {
        setCompetitors(competitorsData);
          setSuggestionCount(suggestionCountData.newSuggestions);
        }
      } catch (e) {
        console.log('API not available, using demo mode');
        setIsDemoMode(true);
        setCompetitors(DEMO_COMPETITORS);
        setSuggestionCount(DEMO_SUGGESTIONS.length); // Show demo suggestions count
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [shop]);

  // Filter competitors based on status and search query
  useEffect(() => {
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
    
    setFilteredCompetitors(filtered);
  }, [competitors, filterStatus, searchQuery]);

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      setCompetitors([]);
      setFilteredCompetitors([]);
      setUrl('');
      setProductId('');
      setIsDemoMode(false);
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newComp = await addCompetitor(url, productId);
      setCompetitors((prev) => [...prev, newComp]);
      notifications.showSuccess('Competitor added successfully', {
        category: 'Competitors'
      });
      setUrl('');
      setProductId('');
      setShowAddForm(false);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to add competitor';
      notifications.showError(errorMessage, {
        category: 'Competitors'
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isDemoMode) {
        // For demo mode, just remove from local state
        setCompetitors((prev) => prev.filter((c) => c.id !== id));
        notifications.showSuccess('Demo competitor removed', {
          category: 'Competitors'
        });
        return;
      }
      
      await deleteCompetitor(id);
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      notifications.showSuccess('Competitor deleted successfully', {
        category: 'Competitors'
      });
    } catch {
      notifications.showError('Failed to delete competitor', {
        category: 'Competitors'
      });
    }
  };

  const refreshSuggestionCount = async () => {
    try {
      if (isDemoMode) {
        // In demo mode, just refresh the demo count
        setSuggestionCount(DEMO_SUGGESTIONS.length);
        return;
      }
      
      // Use manual refresh endpoint for immediate update
      const response = await refreshSuggestionCountAPI();
      setSuggestionCount(response.newSuggestions);
    } catch (error) {
      console.error('Error refreshing suggestion count:', error);
      // Fallback to regular debounced call
      try {
        const response = await getDebouncedSuggestionCount();
        setSuggestionCount(response.newSuggestions);
      } catch (fallbackError) {
        console.error('Fallback suggestion count also failed:', fallbackError);
      }
    }
  };

  const toggleDemoMode = () => {
    if (isDemoMode) {
      setCompetitors([]);
      setIsDemoMode(false);
      setSuggestionCount(0);
      notifications.showSuccess('Demo mode disabled', {
        category: 'Demo'
      });
    } else {
      setCompetitors(DEMO_COMPETITORS);
      setIsDemoMode(true);
      setSuggestionCount(DEMO_SUGGESTIONS.length);
      notifications.showSuccess('Demo mode enabled', {
        category: 'Demo'
      });
    }
  };

  const triggerManualDiscovery = async () => {
    if (isDemoMode) {
      notifications.showInfo('Manual discovery not available in demo mode', {
        category: 'Discovery'
      });
      return;
    }

    setIsDiscovering(true);
    try {
      // Trigger discovery for current shop
      const response = await fetch('/api/competitors/discovery/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        notifications.showSuccess('Competitor discovery started! Check back in a few minutes for new suggestions.', {
          category: 'Discovery'
        });
        // Refresh suggestion count after a delay
        setTimeout(refreshSuggestionCount, 30000);
      } else {
        throw new Error('Discovery trigger failed');
      }
    } catch (error) {
      notifications.showError('Failed to trigger competitor discovery', {
        category: 'Discovery'
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  // Calculate insights
  const insights = React.useMemo(() => {
    const total = filteredCompetitors.length;
    const inStock = filteredCompetitors.filter(c => c.inStock).length;
    const outOfStock = total - inStock;
    const priceChanges = filteredCompetitors.filter(c => c.percentDiff !== 0).length;
    const priceIncreases = filteredCompetitors.filter(c => c.percentDiff > 0).length;
    const priceDecreases = filteredCompetitors.filter(c => c.percentDiff < 0).length;
    const avgPrice = filteredCompetitors.length > 0 ? 
      filteredCompetitors.reduce((sum, c) => sum + (c.price || 0), 0) / filteredCompetitors.filter(c => c.price > 0).length : 0;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Page Header */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl">
                  <ChartBarIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Market Intelligence</h1>
                  <p className="text-gray-600 text-lg">Track competitor prices and discover market opportunities</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Demo Mode Toggle */}
                <button
                  onClick={toggleDemoMode}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isDemoMode 
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 shadow-md' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isDemoMode ? <PlayIcon className="h-4 w-4" /> : <StopIcon className="h-4 w-4" />}
                  {isDemoMode ? 'Demo Mode' : 'Live Mode'}
                </button>

                {/* Manual Discovery Button */}
                <button
                  onClick={triggerManualDiscovery}
                  disabled={isDiscovering}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {isDiscovering ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <MagnifyingGlassIcon className="h-4 w-4" />
                  )}
                  {isDiscovering ? 'Discovering...' : 'Discover Now'}
                </button>

                {/* Suggestions Button */}
                {suggestionCount > 0 && (
                  <button
                    onClick={() => setShowSuggestions(true)}
                    className="relative flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-md"
                  >
                    <SparklesIcon className="h-4 w-4" />
                    <span>{suggestionCount} New Suggestions</span>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  </button>
                )}

                {/* Add Competitor Button */}
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all shadow-md"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Competitor
                </button>
              </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Competitor URL (e.g., https://amazon.com/dp/...)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Product ID (optional)"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition"
                  />
                  <button 
                    type="submit" 
                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-all shadow-md"
                  >
                    Add
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="bg-gray-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-600 transition-all"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Market Insights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Competitors</p>
                  <p className="text-2xl font-bold text-gray-900">{insights.total}</p>
                </div>
                <div className="bg-blue-100 p-2 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Stock</p>
                  <p className="text-2xl font-bold text-green-600">{insights.inStock}</p>
                </div>
                <div className="bg-green-100 p-2 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Price Changes</p>
                  <p className="text-2xl font-bold text-orange-600">{insights.priceChanges}</p>
                </div>
                <div className="bg-orange-100 p-2 rounded-lg">
                  <BoltIcon className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Price</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {insights.avgPrice > 0 ? `$${insights.avgPrice.toFixed(2)}` : 'N/A'}
                  </p>
                </div>
                <div className="bg-purple-100 p-2 rounded-lg">
                  <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Demo Mode Notice */}
          {isDemoMode && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <EyeIcon className="h-6 w-6 text-orange-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-orange-800">Demo Mode Active</h3>
                  <p className="text-orange-700">
                    Showing sample competitor data. Configure your search API to enable live competitor discovery and price monitoring.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filters and Search */}
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex items-center gap-2">
                <FunnelIcon className="h-5 w-5 text-gray-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                >
                  <option value="all">All Competitors</option>
                  <option value="inStock">In Stock Only</option>
                  <option value="outOfStock">Out of Stock</option>
                </select>
              </div>
              
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search competitors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Competitors Table */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">Tracked Competitors</h2>
                <div className="text-sm text-gray-500">
                  {filteredCompetitors.length} of {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredCompetitors.length === 0 ? (
              <div className="text-center py-16">
                <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {competitors.length === 0 ? 'No competitors yet' : 'No matches found'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {competitors.length === 0 
                    ? 'Start tracking your competitors to monitor their pricing strategies.'
                    : 'Try adjusting your filters or search query.'
                  }
                </p>
                {competitors.length === 0 && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all shadow-md"
                  >
                    Add Your First Competitor
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <CompetitorTable data={filteredCompetitors} onDelete={handleDelete} />
              </div>
            )}
          </div>
        </div>
      </div>
      
      <SuggestionDrawer
        isOpen={showSuggestions}
        onClose={() => setShowSuggestions(false)}
        onSuggestionUpdate={refreshSuggestionCount}
        isDemoMode={isDemoMode}
        demoSuggestions={DEMO_SUGGESTIONS}
      />
    </div>
  );
}
