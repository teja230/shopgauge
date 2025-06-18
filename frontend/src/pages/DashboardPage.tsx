import React, { useEffect, useState } from 'react';
import { MetricCard } from '../components/ui/MetricCard';
import { InsightBanner } from '../components/ui/InsightBanner';
import { getInsights } from '../api';
import type { Insight } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip as RechartsTooltip, Line, BarChart, Bar } from 'recharts';
import { Tooltip } from '../components/ui/Tooltip';
import { Dialog } from '@headlessui/react';
import { useAuth } from '../App';

export default function DashboardPage() {
  const { shop, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<{ revenue: number, orderCount: number } | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [revenueTimeseries, setRevenueTimeseries] = useState<any[]>([]);
  const [revenueTSLoading, setRevenueTSLoading] = useState(true);
  const [revenueTSError, setRevenueTSError] = useState<string | null>(null);

  // Onboarding/help banner
  const [showHelp, setShowHelp] = useState(true);

  // Product-level analytics
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topProductsLoading, setTopProductsLoading] = useState(true);
  const [topProductsError, setTopProductsError] = useState<string | null>(null);

  // Low inventory
  const [lowInventory, setLowInventory] = useState<any[]>([]);
  const [lowInventoryLoading, setLowInventoryLoading] = useState(true);
  const [lowInventoryError, setLowInventoryError] = useState<string | null>(null);

  // New products
  const [newProducts, setNewProducts] = useState<any[]>([]);
  const [newProductsLoading, setNewProductsLoading] = useState(true);
  const [newProductsError, setNewProductsError] = useState<string | null>(null);

  // Abandoned carts
  const [abandonedCarts, setAbandonedCarts] = useState<number | null>(null);
  const [abandonedCartsLoading, setAbandonedCartsLoading] = useState(true);
  const [abandonedCartsError, setAbandonedCartsError] = useState<string | null>(null);

  // Cohort/funnel analysis (mock data for now)
  const [funnelData] = useState([
    { stage: 'Visited', count: 1000 },
    { stage: 'Added to Cart', count: 300 },
    { stage: 'Checkout Started', count: 120 },
    { stage: 'Purchased', count: 80 },
  ]);

  // Walkthrough modal
  const [showWalkthrough, setShowWalkthrough] = useState(() => {
    return localStorage.getItem('storesight_walkthrough_complete') !== 'true';
  });
  const [walkStep, setWalkStep] = useState(0);
  const walkthroughSteps = [
    {
      title: 'Welcome to StoreSight!',
      desc: 'This quick tour will show you how to get the most out of your analytics dashboard.',
    },
    {
      title: 'Revenue & Orders',
      desc: 'See your total revenue and order count for the last 30 days, plus daily trends.',
    },
    {
      title: 'Top Products & Inventory',
      desc: 'Track your best sellers and spot low inventory before it becomes a problem.',
    },
    {
      title: 'Competitor Price Watcher',
      desc: 'Monitor competitor prices and get instant alerts for changes.',
    },
    {
      title: 'Automated Alerts & Reports',
      desc: 'Set up notifications and export reports to stay on top of your business.',
    },
    {
      title: "You're all set!",
      desc: 'Explore the dashboard and reach out via the help links if you need anything.',
    },
  ];
  const completeWalkthrough = () => {
    setShowWalkthrough(false);
    localStorage.setItem('storesight_walkthrough_complete', 'true');
  };

  // Report schedule UI
  const [reportSchedule, setReportSchedule] = useState('none');
  const [reportScheduleLoading, setReportScheduleLoading] = useState(true);
  const [reportScheduleStatus, setReportScheduleStatus] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!shop) {
      navigate('/');
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        const [insightsData] = await Promise.all([
          getInsights(),
        ]);
        setInsights(insightsData);
      } catch (e: any) {
        if (e.message.includes('Please log in')) {
          navigate('/');
        } else {
          toast.error(e.message || 'Failed to load data');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [shop, authLoading, navigate]);

  useEffect(() => {
    async function fetchRevenue() {
      try {
        setRevenueLoading(true);
        setRevenueError(null);
        const res = await fetch('/api/analytics/revenue', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch revenue');
        setRevenueData(await res.json());
      } catch (e: any) {
        setRevenueError(e.message);
      } finally {
        setRevenueLoading(false);
      }
    }
    fetchRevenue();
  }, []);

  useEffect(() => {
    async function fetchRevenueTS() {
      try {
        setRevenueTSLoading(true);
        setRevenueTSError(null);
        const res = await fetch('/api/analytics/revenue/timeseries', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch revenue timeseries');
        const data = await res.json();
        setRevenueTimeseries(data.timeseries || []);
      } catch (e: any) {
        setRevenueTSError(e.message);
      } finally {
        setRevenueTSLoading(false);
      }
    }
    fetchRevenueTS();
  }, []);

  const [ordersTimeseries, setOrdersTimeseries] = useState<any[]>([]);
  const [ordersTSLoading, setOrdersTSLoading] = useState(true);
  const [ordersTSError, setOrdersTSError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrdersTS() {
      try {
        setOrdersTSLoading(true);
        setOrdersTSError(null);
        const res = await fetch('/api/analytics/orders/timeseries', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch orders timeseries');
        const data = await res.json();
        setOrdersTimeseries(data.timeseries || []);
      } catch (e: any) {
        setOrdersTSError(e.message);
      } finally {
        setOrdersTSLoading(false);
      }
    }
    fetchOrdersTS();
  }, []);

  useEffect(() => {
    async function fetchTopProducts() {
      try {
        setTopProductsLoading(true);
        setTopProductsError(null);
        const res = await fetch('/api/analytics/products', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch top products');
        const data = await res.json();
        setTopProducts(data.topProducts || []);
      } catch (e: any) {
        setTopProductsError(e.message);
      } finally {
        setTopProductsLoading(false);
      }
    }
    fetchTopProducts();
  }, []);

  useEffect(() => {
    async function fetchLowInventory() {
      try {
        setLowInventoryLoading(true);
        setLowInventoryError(null);
        const res = await fetch('/api/analytics/inventory/low', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch low inventory');
        const data = await res.json();
        setLowInventory(data.lowInventory || []);
      } catch (e: any) {
        setLowInventoryError(e.message);
      } finally {
        setLowInventoryLoading(false);
      }
    }
    fetchLowInventory();
  }, []);

  useEffect(() => {
    async function fetchNewProducts() {
      try {
        setNewProductsLoading(true);
        setNewProductsError(null);
        const res = await fetch('/api/analytics/new_products', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch new products');
        const data = await res.json();
        setNewProducts(data.products || []);
      } catch (e: any) {
        setNewProductsError(e.message);
      } finally {
        setNewProductsLoading(false);
      }
    }
    fetchNewProducts();
  }, []);

  useEffect(() => {
    async function fetchAbandonedCarts() {
      try {
        setAbandonedCartsLoading(true);
        setAbandonedCartsError(null);
        const res = await fetch('/api/analytics/abandoned_carts', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch abandoned carts');
        const data = await res.json();
        setAbandonedCarts(data.abandonedCarts ?? null);
      } catch (e: any) {
        setAbandonedCartsError(e.message);
      } finally {
        setAbandonedCartsLoading(false);
      }
    }
    fetchAbandonedCarts();
  }, []);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        setReportScheduleLoading(true);
        const res = await fetch('/api/analytics/report/schedule', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch report schedule');
        const data = await res.json();
        setReportSchedule(data.schedule || 'none');
      } catch {}
      setReportScheduleLoading(false);
    }
    fetchSchedule();
  }, []);

  const handleScheduleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setReportSchedule(value);
    setReportScheduleStatus(null);
    try {
      const res = await fetch('/api/analytics/report/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ schedule: value }),
      });
      if (!res.ok) throw new Error('Failed to save schedule');
      setReportScheduleStatus('Saved!');
    } catch {
      setReportScheduleStatus('Failed to save');
    }
    setTimeout(() => setReportScheduleStatus(null), 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!shop) {
    return null; // Will be redirected by the useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
      <Toaster position="top-right" />
      <nav className="w-full max-w-3xl flex justify-between items-center mb-6">
        <Link to="/" className="text-blue-700 font-bold text-lg hover:underline">StoreSight</Link>
        <div className="space-x-4">
          <Link to="/dashboard" className="text-blue-700 font-semibold hover:underline">Dashboard</Link>
          <Link to="/competitors" className="text-blue-700 font-semibold hover:underline">Competitors</Link>
        </div>
      </nav>
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        {insights && <InsightBanner message={insights.insightText} />}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <MetricCard
            label="Conversion Rate"
            value={`${insights?.conversionRate.toFixed(2) ?? '--'}%`}
            delta={insights ? `${insights.conversionRateDelta > 0 ? '+' : ''}${insights.conversionRateDelta.toFixed(2)}%` : ''}
            deltaType={insights ? (insights.conversionRateDelta > 0 ? 'up' : insights.conversionRateDelta < 0 ? 'down' : 'neutral') : 'neutral'}
          />
          <MetricCard
            label="Top Product (7d)"
            value={insights?.topSellingProducts[0]?.title ?? '--'}
            delta={insights?.topSellingProducts[0] ? `${insights.topSellingProducts[0].delta > 0 ? '+' : ''}${insights.topSellingProducts[0].delta.toFixed(1)}%` : ''}
            deltaType={insights?.topSellingProducts[0] ? (insights.topSellingProducts[0].delta > 0 ? 'up' : insights.topSellingProducts[0].delta < 0 ? 'down' : 'neutral') : 'neutral'}
          />
          <MetricCard
            label="Abandoned Carts (7d)"
            value={insights?.abandonedCartCount ?? '--'}
          />
        </div>
      </div>
      {/* Revenue/Orders Analytics */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Revenue & Orders (Last 30 Days)</h2>
        {revenueLoading ? (
          <div>Loading...</div>
        ) : revenueError ? (
          <div className="text-red-600">{revenueError}</div>
        ) : revenueData ? (
          <div className="flex flex-col sm:flex-row gap-8 items-center">
            <div className="flex-1">
              <div className="text-2xl font-bold text-blue-900 mb-2">${revenueData.revenue.toFixed(2)}</div>
              <div className="text-gray-600">Total Revenue</div>
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold text-green-700 mb-2">{revenueData.orderCount}</div>
              <div className="text-gray-600">Orders</div>
            </div>
          </div>
        ) : null}
      </div>
      {/* Revenue/Orders Time Series Charts */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Revenue (Last 30 Days)</h2>
        {revenueTSLoading ? <div>Loading...</div> : revenueTSError ? <div className="text-red-600">{revenueTSError}</div> : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueTimeseries} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `$${v}`} width={70} />
              <RechartsTooltip formatter={v => `$${v}`} />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Order Count (Last 30 Days)</h2>
        {ordersTSLoading ? <div>Loading...</div> : ordersTSError ? <div className="text-red-600">{ordersTSError}</div> : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ordersTimeseries} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis width={50} />
              <RechartsTooltip />
              <Line type="monotone" dataKey="orderCount" stroke="#16a34a" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* Chart Section */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Sales Trend (Last 7 Days)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={[
            { day: 'Mon', sales: 120 },
            { day: 'Tue', sales: 210 },
            { day: 'Wed', sales: 180 },
            { day: 'Thu', sales: 250 },
            { day: 'Fri', sales: 200 },
            { day: 'Sat', sales: 300 },
            { day: 'Sun', sales: 280 },
          ]}>
            <XAxis dataKey="day" />
            <YAxis />
            <RechartsTooltip />
            <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Competitor Price Trend Chart */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Competitor Price Trend (Last 7 Days)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={[
            { day: 'Mon', price: 29.99 },
            { day: 'Tue', price: 28.99 },
            { day: 'Wed', price: 27.99 },
            { day: 'Thu', price: 27.49 },
            { day: 'Fri', price: 28.49 },
            { day: 'Sat', price: 29.49 },
            { day: 'Sun', price: 29.99 },
          ]}>
            <XAxis dataKey="day" />
            <YAxis domain={[26, 31]} />
            <RechartsTooltip />
            <Line type="monotone" dataKey="price" stroke="#16a34a" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Onboarding/Help Banner */}
      {showHelp && (
        <div className="w-full max-w-3xl bg-blue-50 border border-blue-200 rounded p-4 mb-6 flex items-center justify-between animate-fadeIn">
          <div>
            <b>Welcome to StoreSight!</b> Use the dashboard to monitor sales, products, inventory, and competitors. Need help? <a href="#" className="underline text-blue-700">Read the guide</a> or <a href="#" className="underline text-blue-700">contact support</a>.
          </div>
          <div className="flex items-center gap-4">
            <button className="text-blue-700 hover:underline" onClick={() => setShowHelp(false)}>Dismiss</button>
            <button className="text-blue-700 hover:underline" onClick={() => { setShowWalkthrough(true); setWalkStep(0); }}>Show me again</button>
          </div>
        </div>
      )}
      {/* Abandoned Carts Banner */}
      <div className="w-full max-w-3xl mb-4">
        {abandonedCartsLoading ? null : abandonedCartsError ? (
          <div className="text-red-600">{abandonedCartsError}</div>
        ) : abandonedCarts !== null && abandonedCarts > 0 ? (
          <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 rounded p-3 mb-2">
            <b>Heads up!</b> You have {abandonedCarts} abandoned carts in the last 30 days.
          </div>
        ) : null}
      </div>
      {/* Top Products Bar Chart */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Top Products (Last 30 Days)</h2>
        {topProductsLoading ? <div>Loading...</div> : topProductsError ? <div className="text-red-600">{topProductsError}</div> : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="title" type="category" width={150} tick={{ fontSize: 12 }} />
              <RechartsTooltip />
              <Bar dataKey="quantity" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* Low Inventory List */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Low Inventory Products</h2>
        {lowInventoryLoading ? <div>Loading...</div> : lowInventoryError ? <div className="text-red-600">{lowInventoryError}</div> : lowInventory.length === 0 ? <div className="text-gray-500">No low inventory products!</div> : (
          <ul className="divide-y divide-gray-200">
            {lowInventory.map((item, i) => (
              <li key={i} className="py-2 flex justify-between items-center">
                <span>{item.title} <span className="text-xs text-gray-400">({item.variant})</span></span>
                <span className="font-bold text-red-600">{item.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* New Products List */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">New Products (Last 30 Days)</h2>
        {newProductsLoading ? <div>Loading...</div> : newProductsError ? <div className="text-red-600">{newProductsError}</div> : newProducts.length === 0 ? <div className="text-gray-500">No new products in the last 30 days.</div> : (
          <ul className="divide-y divide-gray-200">
            {newProducts.slice(0, 10).map((item, i) => (
              <li key={i} className="py-2 flex justify-between items-center">
                <span>{item.title}</span>
                <span className="text-xs text-gray-400">{item.created_at?.substring(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Cohort/Funnel Analysis */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <div className="flex items-center mb-4">
          <h2 className="text-lg font-semibold mr-2">Cohort & Funnel Analysis</h2>
          <Tooltip text="See how users move through your store funnel. Pro/Enterprise feature.">
            <span className="ml-1 text-blue-500 cursor-help">&#9432;</span>
          </Tooltip>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {funnelData.map((stage, i) => (
            <div key={stage.stage} className="flex-1 flex flex-col items-center">
              <div className="bg-blue-100 text-blue-900 rounded-full w-20 h-20 flex items-center justify-center text-2xl font-bold mb-2">
                {stage.count}
              </div>
              <div className="text-sm font-medium text-center">{stage.stage}</div>
              {i < funnelData.length - 1 && <div className="h-8 w-1 bg-blue-200 mx-auto my-2 rounded" />}
            </div>
          ))}
        </div>
      </div>
      {/* Export/Reporting UI */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <div className="flex items-center mb-4">
          <h2 className="text-lg font-semibold mr-2">Export & Reporting</h2>
          <Tooltip text="Download CSV reports or schedule automated email reports (Pro/Enterprise)">
            <span className="ml-1 text-blue-500 cursor-help">&#9432;</span>
          </Tooltip>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onClick={() => window.open('/api/analytics/export/csv', '_blank')}>Download CSV</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <label className="font-medium">Scheduled Email Report:</label>
          {reportScheduleLoading ? <span>Loading...</span> : (
            <select value={reportSchedule} onChange={handleScheduleChange} className="border rounded px-2 py-1">
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          )}
          {reportScheduleStatus && <span className="ml-2 text-green-600">{reportScheduleStatus}</span>}
        </div>
      </div>
      {/* Event-driven Automations */}
      <div className="w-full max-w-3xl bg-white rounded shadow p-6 mb-8">
        <div className="flex items-center mb-4">
          <h2 className="text-lg font-semibold mr-2">Event-driven Automations</h2>
          <Tooltip text="Automate alerts and actions for price changes, sales milestones, low inventory, and more.">
            <span className="ml-1 text-blue-500 cursor-help">&#9432;</span>
          </Tooltip>
        </div>
        <ul className="list-disc pl-6 text-gray-700">
          <li>Competitor price change &rarr; Email/Slack/SMS alert</li>
          <li>Low inventory &rarr; Email/Slack/SMS alert</li>
          <li>Sales milestone &rarr; Email/Slack/SMS alert</li>
          <li>New product added &rarr; Email/Slack/SMS alert</li>
        </ul>
        <div className="mt-2 text-xs text-gray-500">Automations are managed in your notification settings.</div>
      </div>
      {/* Walkthrough Modal */}
      <Dialog open={showWalkthrough} onClose={completeWalkthrough} className="fixed z-50 inset-0 flex items-center justify-center">
        <div className="fixed inset-0 bg-black bg-opacity-30" />
        <div className="relative bg-white rounded-lg shadow-xl p-8 max-w-md mx-auto z-10 animate-fadeIn">
          <Dialog.Title className="text-xl font-bold mb-2">{walkthroughSteps[walkStep].title}</Dialog.Title>
          <Dialog.Description className="mb-4 text-gray-700">{walkthroughSteps[walkStep].desc}</Dialog.Description>
          <div className="flex justify-between items-center mt-4">
            <button className="text-blue-600 underline" onClick={completeWalkthrough}>Skip</button>
            <div className="flex gap-2">
              {walkStep > 0 && <button className="px-3 py-1 rounded bg-gray-100" onClick={() => setWalkStep(walkStep - 1)}>Back</button>}
              {walkStep < walkthroughSteps.length - 1 ? (
                <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={() => setWalkStep(walkStep + 1)}>Next</button>
              ) : (
                <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={completeWalkthrough}>Finish</button>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
