import React, { useEffect, useState } from 'react';
import { CompetitorTable } from '../components/ui/CompetitorTable';
import type { Competitor } from '../components/ui/CompetitorTable';
import { SuggestionDrawer } from '../components/ui/SuggestionDrawer';
import { getCompetitors, addCompetitor, deleteCompetitor, getSuggestionCount } from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { 
  SparklesIcon, 
  PlusIcon, 
  EyeIcon, 
  ChartBarIcon,
  PlayIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import type { CompetitorSuggestion } from '../api';

// Demo data for when SerpAPI is not configured
const DEMO_COMPETITORS: Competitor[] = [
  {
    name: 'Amazon - Echo Dot (4th Gen)',
    website: 'https://amazon.com/dp/B08N5WRWNW',
    status: 'active',
    lastChecked: '2 hours ago',
    metrics: {
      revenue: 1500000,
      products: 1250,
      traffic: 50000
    }
  },
  {
    name: 'Amazon - Fire TV Stick 4K',
    website: 'https://amazon.com/dp/B08C7W5L7D',
    status: 'active',
    lastChecked: '1 hour ago',
    metrics: {
      revenue: 890000,
      products: 890,
      traffic: 35000
    }
  },
  {
    name: 'Amazon - Echo Show 8',
    website: 'https://amazon.com/dp/B08N5KWB9H',
    status: 'inactive',
    lastChecked: '30 minutes ago',
    metrics: {
      revenue: 0,
      products: 0,
      traffic: 0
    }
  },
  {
    name: 'Amazon - Echo Plus (2nd Gen)',
    website: 'https://amazon.com/dp/B07FZ8S74R',
    status: 'active',
    lastChecked: '15 minutes ago',
    metrics: {
      revenue: 750000,
      products: 600,
      traffic: 25000
    }
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [url, setUrl] = useState('');
  const [productId, setProductId] = useState('');

  useEffect(() => {
    // Clear data if no shop (logout/disconnect)
    if (!shop) {
      setCompetitors([]);
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
          getSuggestionCount()
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

  // Cleanup effect when component unmounts
  useEffect(() => {
    return () => {
      setCompetitors([]);
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
      toast.success('Competitor added successfully');
      setUrl('');
      setProductId('');
      setShowAddForm(false);
    } catch {
      toast.error('Failed to add competitor');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isDemoMode) {
        // For demo mode, just remove from local state
        setCompetitors((prev) => prev.filter((c) => c.name !== id));
        toast.success('Demo competitor removed');
        return;
      }
      
      await deleteCompetitor(id);
      setCompetitors((prev) => prev.filter((c) => c.name !== id));
      toast.success('Competitor deleted successfully');
    } catch {
      toast.error('Failed to delete competitor');
    }
  };

  const refreshSuggestionCount = async () => {
    try {
      if (isDemoMode) {
        // In demo mode, just refresh the demo count
        setSuggestionCount(DEMO_SUGGESTIONS.length);
        return;
      }
      
      const response = await getSuggestionCount();
      setSuggestionCount(response.newSuggestions);
    } catch (error) {
      console.error('Error refreshing suggestion count:', error);
    }
  };

  const toggleDemoMode = () => {
    if (isDemoMode) {
      setCompetitors([]);
      setIsDemoMode(false);
      setSuggestionCount(0);
      toast.success('Demo mode disabled');
    } else {
      setCompetitors(DEMO_COMPETITORS);
      setIsDemoMode(true);
      setSuggestionCount(DEMO_SUGGESTIONS.length);
      toast.success('Demo mode enabled');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Page Header */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Competitor Analysis</h1>
                  <p className="text-gray-600 text-sm">Track competitor prices and market positioning</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Demo Mode Toggle */}
                <button
                  onClick={toggleDemoMode}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    isDemoMode 
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isDemoMode ? <PlayIcon className="h-3.5 w-3.5" /> : <StopIcon className="h-3.5 w-3.5" />}
                  {isDemoMode ? 'Demo' : 'Live'}
                </button>

                {/* Suggestions Button */}
                {suggestionCount > 0 && (
                  <button
                    onClick={() => setShowSuggestions(true)}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5"
                  >
                    <SparklesIcon className="h-4 w-4" />
                    {suggestionCount} New
                  </button>
                )}

                {/* Add Competitor Button */}
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1.5"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Competitor URL (e.g., https://amazon.com/dp/...)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 outline-none transition text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Product ID (optional)"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 outline-none transition text-sm"
                  />
                  <button 
                    type="submit" 
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Add
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Demo Mode Notice */}
          {isDemoMode && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <EyeIcon className="h-4 w-4 text-orange-600" />
                <div>
                  <h3 className="font-medium text-orange-800 text-sm">Demo Mode Active</h3>
                  <p className="text-orange-700 text-xs">
                    Showing sample competitor data. Configure SerpAPI to enable live competitor discovery.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Competitors Table */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Tracked Competitors</h2>
              <div className="text-sm text-gray-500">
                {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : competitors.length === 0 ? (
              <div className="text-center py-12">
                <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No competitors yet</h3>
                <p className="text-gray-500 mb-4">Start tracking your competitors to monitor their pricing strategies.</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  Add Your First Competitor
                </button>
              </div>
            ) : (
              <CompetitorTable data={competitors} onDelete={handleDelete} />
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

// Inside CompetitorTable component (assuming it's a custom component), update the row rendering to include Avatar/Icon
/*
{competitors.map((competitor) => (
  <TableRow key={competitor.name}>
    <TableCell>
      <Avatar sx={{ bgcolor: '#e0e7ff', color: '#3730a3', mr: 1 }}>
        <GroupIcon />
      </Avatar>
      {competitor.name || competitor.website}
    </TableCell>
    ...
  </TableRow>
))}
*/
