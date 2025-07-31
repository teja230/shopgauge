import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChartBarIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';
import { fetchWithAuth } from '../../api';

interface PriceHistoryData {
  checked_at: string;
  price: number;
  in_stock: boolean;
  price_change_percent?: number;
}

interface PriceHistoryModalProps {
  competitor: {
    id: string;
    label: string;
    url: string;
    price: number;
    lastChecked: string;
  };
  onClose: () => void;
  isDemoMode?: boolean;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  competitor,
  onClose,
  isDemoMode = false
}) => {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      if (isDemoMode) {
        // Demo data with varying prices to show min/max
        const demoHistory: PriceHistoryData[] = [
          { checked_at: '2025-01-22T02:27:30Z', price: 999.00, in_stock: true },
          { checked_at: '2025-01-21T02:27:30Z', price: 899.00, in_stock: true },
          { checked_at: '2025-01-20T02:27:30Z', price: 949.00, in_stock: true },
          { checked_at: '2025-01-19T02:27:30Z', price: 879.00, in_stock: true },
          { checked_at: '2025-01-18T02:27:30Z', price: 929.00, in_stock: true },
        ];
        setPriceHistory(demoHistory);
        setStatistics({
          min_price: 879.00,
          max_price: 999.00,
          avg_price: 930.80,
          total_snapshots: 5
        });
        setLoading(false);
        return;
      }

      try {
        const response = await fetchWithAuth(`/api/competitors/${competitor.id}/price-history?days=90`);
        if (response.ok) {
          const data = await response.json();
          setPriceHistory(data.priceHistory || []);
          setStatistics(data.statistics || {});
        } else {
          setError('Failed to load price history');
        }
      } catch (err) {
        setError('Failed to load price history');
      } finally {
        setLoading(false);
      }
    };

    fetchPriceHistory();
  }, [competitor.id, isDemoMode]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const getPriceChangeColor = (change: number) => {
    if (change > 0) return 'text-red-600';
    if (change < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getPriceChangeIcon = (change: number) => {
    if (change > 0) return '↗';
    if (change < 0) return '↘';
    return '→';
  };

  // Transform data for Recharts
  const chartData = priceHistory.map((entry, index) => {
    const prevPrice = index < priceHistory.length - 1 ? priceHistory[index + 1].price : entry.price;
    const change = entry.price - prevPrice;
    const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
    
    return {
      date: new Date(entry.checked_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      price: entry.price,
      change: changePercent,
      inStock: entry.in_stock,
      timestamp: new Date(entry.checked_at).getTime()
    };
  }).reverse(); // Reverse to show oldest to newest

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-blue-600 font-semibold">
            Price: {formatPrice(data.price)}
          </p>
          {data.change !== 0 && (
            <p className={`text-sm ${data.change > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.change > 0 ? '+' : ''}{data.change.toFixed(1)}% change
            </p>
          )}
          <p className="text-sm text-gray-500">
            Status: {data.inStock ? 'In Stock' : 'Out of Stock'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            Price History: {competitor.label}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600">
            Price history for {competitor.label} over the last 90 days.
            This shows price trends and helps identify patterns in competitor pricing.
          </p>
        </div>

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-500">Loading price history...</p>
          </div>
        ) : error ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="text-red-500 mb-4">
              <ChartBarIcon className="h-16 w-16 mx-auto" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h4>
            <p className="text-gray-500">{error}</p>
          </div>
        ) : priceHistory.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Price History</h4>
            <p className="text-gray-500 mb-4">
              No price history data available for this competitor yet.
            </p>
            <div className="text-sm text-gray-400">
              Price history will appear here once the competitor has been monitored for a few days.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Statistics Cards */}
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CurrencyDollarIcon className="h-5 w-5 text-blue-600 mr-2" />
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Current Price</p>
                      <p className="text-lg font-semibold text-blue-900">{formatPrice(competitor.price)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <ChartBarIcon className="h-5 w-5 text-green-600 mr-2" />
                    <div>
                      <p className="text-sm text-green-600 font-medium">Lowest Price</p>
                      <p className="text-lg font-semibold text-green-900">
                        {statistics.min_price ? formatPrice(statistics.min_price) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <ChartBarIcon className="h-5 w-5 text-red-600 mr-2" />
                    <div>
                      <p className="text-sm text-red-600 font-medium">Highest Price</p>
                      <p className="text-lg font-semibold text-red-900">
                        {statistics.max_price ? formatPrice(statistics.max_price) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <ClockIcon className="h-5 w-5 text-purple-600 mr-2" />
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Data Points</p>
                      <p className="text-lg font-semibold text-purple-900">
                        {statistics.total_snapshots || priceHistory.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Price History Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="text-lg font-medium text-gray-900">Price History</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Change
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {priceHistory.map((entry, index) => {
                      const prevPrice = index < priceHistory.length - 1 ? priceHistory[index + 1].price : entry.price;
                      const change = entry.price - prevPrice;
                      const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(entry.checked_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatPrice(entry.price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {index < priceHistory.length - 1 ? (
                              <span className={`flex items-center ${getPriceChangeColor(changePercent)}`}>
                                <span className="mr-1">{getPriceChangeIcon(changePercent)}</span>
                                {changePercent !== 0 && `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`}
                                {changePercent === 0 && 'No change'}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              entry.in_stock 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {entry.in_stock ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Price Trend Chart */}
            {priceHistory.length > 1 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Price Trend</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#priceGradient)"
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center text-sm text-gray-500 mt-4">
                  {formatDate(priceHistory[priceHistory.length - 1].checked_at)} - {formatDate(priceHistory[0].checked_at)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 