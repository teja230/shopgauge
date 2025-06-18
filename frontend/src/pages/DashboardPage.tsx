import React, { useEffect, useState } from 'react';
import { MetricCard } from '../components/ui/MetricCard';
import { InsightBanner } from '../components/ui/InsightBanner';
import { getInsights, fetchWithAuth } from '../api';
import type { Insight } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip as RechartsTooltip, Line, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Tooltip } from '../components/ui/Tooltip';
import { Dialog } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Alert, Snackbar, Box, Chip, IconButton, Link as MuiLink, Button, Menu, MenuItem, Grid, Card, Typography, List, ListItem, ListItemText, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { TrendingUp, TrendingDown, ShoppingCart, Inventory, AddBox, OpenInNew, Refresh, MoreVert, Timeline, Add, Storefront, ListAlt, Person } from '@mui/icons-material';
import { format } from 'date-fns';
import { AppBar, Toolbar } from '@mui/material';
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material';

const DashboardContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.default,
  minHeight: '100vh'
}));

const GridContainer = styled(Grid)(({ theme }: { theme: Theme }) => ({
  marginTop: theme.spacing(2),
}));

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

const CardTitle = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: theme.palette.primary.main,
  fontWeight: 600,
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '200px'
}));

const ErrorContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  color: theme.palette.error.main,
  textAlign: 'center'
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(2),
  fontSize: '2rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

const MetricDelta = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0, 2, 2),
}));

const ChartContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  height: '400px',
}));

const ProductLink = styled(Link)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  color: theme.palette.primary.main,
  textDecoration: 'none',
  '&:hover': {
    textDecoration: 'underline',
  },
}));

const DashboardHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  marginBottom: theme.spacing(4),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
}));

const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.875rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const HeaderActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const StyledLink = styled(Link)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    textDecoration: 'none',
  },
}));

const StyledGrid = styled(Grid)(({ theme }) => ({
  '&.MuiGrid-item': {
    padding: theme.spacing(2),
  },
}));

interface Product {
  id: string;
  title: string;
  quantity: number;
  total_price: number;
  variants: Array<{
    id: string;
    title: string;
    price: string;
  }>;
}

interface InventoryItem {
  id: string;
  title: string;
  quantity: number;
}

interface Order {
  id: string;
  name: string;
  created_at: string;
  total_price: string;
  customer?: {
    first_name: string;
    last_name: string;
  };
  financial_status?: string;
  fulfillment_status?: string;
  order_status_url?: string;
}

interface RevenueData {
  revenue: number;
}

interface RevenueTSData {
  timeseries: Array<{
    created_at: string;
    total_price: number;
  }>;
}

interface AbandonedCartsData {
  abandonedCarts: number;
}

interface LowInventoryData {
  lowInventory: InventoryItem[];
}

interface NewProductsData {
  newProducts: number;
}

interface TopProductsData {
  products: Product[];
}

interface OrdersData {
  timeseries: Order[];
  page: number;
  limit: number;
  has_more: boolean;
}

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

interface GridItemProps {
  xs?: number;
  md?: number;
  lg?: number;
  children: React.ReactNode;
}

const GridItem = ({ xs, md, lg, children }: GridItemProps) => {
  const gridProps = {
    xs,
    md,
    lg,
    item: true as const
  };

  return (
    <Grid {...gridProps}>
      <Box sx={{ p: 2 }}>
        {children}
      </Box>
    </Grid>
  );
};

export default function DashboardPage() {
  const { shop, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [revenueTSData, setRevenueTSData] = useState<RevenueTSData | null>(null);
  const [revenueTSLoading, setRevenueTSLoading] = useState(true);
  const [revenueTSError, setRevenueTSError] = useState<string | null>(null);

  // Onboarding/help banner
  const [showHelp, setShowHelp] = useState(true);

  // Product-level analytics
  const [topProductsData, setTopProductsData] = useState<TopProductsData | null>(null);
  const [topProductsLoading, setTopProductsLoading] = useState(true);
  const [topProductsError, setTopProductsError] = useState<string | null>(null);

  // Low inventory
  const [lowInventoryData, setLowInventoryData] = useState<LowInventoryData | null>(null);
  const [lowInventoryLoading, setLowInventoryLoading] = useState(true);
  const [lowInventoryError, setLowInventoryError] = useState<string | null>(null);

  // New products
  const [newProductsData, setNewProductsData] = useState<NewProductsData | null>(null);
  const [newProductsLoading, setNewProductsLoading] = useState(true);
  const [newProductsError, setNewProductsError] = useState<string | null>(null);

  // Abandoned carts
  const [abandonedCartsData, setAbandonedCartsData] = useState<AbandonedCartsData | null>(null);
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

  // Debug auth state
  useEffect(() => {
    console.log('Dashboard: Auth state changed', { shop, authLoading });
  }, [shop, authLoading]);

  useEffect(() => {
    if (!shop || authLoading) {
      console.log('Dashboard: Skipping data fetch - no shop or auth loading', { shop, authLoading });
      return;
    }

    console.log('Dashboard: Shop authenticated, fetching data');
    async function fetchData() {
      try {
        setLoading(true);
        const [insightsData] = await Promise.all([
          getInsights(),
        ]);
        console.log('Dashboard: Got insights data:', insightsData);
        setInsights(insightsData);
      } catch (e: any) {
        console.error('Dashboard: Error fetching insights:', e);
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
    if (!shop || authLoading) {
      console.log('Dashboard: Skipping revenue fetch - no shop or auth loading');
      return;
    }

    console.log('Dashboard: Fetching revenue data');
    async function fetchRevenue() {
      try {
        setRevenueLoading(true);
        setRevenueError(null);
        const res = await fetchWithAuth('/api/analytics/revenue');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch revenue');
        }
        console.log('Dashboard: Revenue data:', data);
        setRevenueData(data);
      } catch (e: any) {
        console.error('Dashboard: Revenue fetch error:', e);
        setRevenueError(e.message);
        setRevenueData(null);
      } finally {
        setRevenueLoading(false);
      }
    }
    fetchRevenue();
  }, [shop, authLoading]);

  useEffect(() => {
    if (!shop || authLoading) {
      console.log('Dashboard: Skipping revenue timeseries fetch - no shop or auth loading');
      return;
    }

    console.log('Dashboard: Fetching revenue timeseries');
    async function fetchRevenueTS() {
      try {
        setRevenueTSLoading(true);
        setRevenueTSError(null);
        const res = await fetchWithAuth('/api/analytics/revenue/timeseries');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch revenue timeseries');
        }
        console.log('Dashboard: Revenue timeseries data:', data);
        setRevenueTSData(data);
      } catch (e: any) {
        console.error('Dashboard: Revenue timeseries fetch error:', e);
        setRevenueTSError(e.message);
        setRevenueTSData(null);
      } finally {
        setRevenueTSLoading(false);
      }
    }
    fetchRevenueTS();
  }, [shop, authLoading]);

  const [ordersTimeseries, setOrdersTimeseries] = useState<Order[]>([]);
  const [ordersTSLoading, setOrdersTSLoading] = useState(true);
  const [ordersTSError, setOrdersTSError] = useState<string | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (!shop || authLoading) return;

    async function fetchOrdersTS() {
      try {
        setOrdersTSLoading(true);
        setOrdersTSError(null);
        const res = await fetchWithAuth(`/api/analytics/orders/timeseries?page=${ordersPage}&limit=10`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch orders timeseries');
        }
        console.log('Dashboard: Orders timeseries data:', data);
        setOrdersTimeseries(data.timeseries || []);
        setHasMoreOrders(data.has_more);
      } catch (e: any) {
        console.error('Dashboard: Orders timeseries error:', e);
        setOrdersTSError(e.message);
        setOrdersTimeseries([]);
      } finally {
        setOrdersTSLoading(false);
      }
    }
    fetchOrdersTS();
  }, [shop, authLoading, ordersPage]);

  const loadMoreOrders = () => {
    setOrdersPage(prev => prev + 1);
  };

  useEffect(() => {
    if (!shop || authLoading) return;

    async function fetchTopProducts() {
      try {
        setTopProductsLoading(true);
        setTopProductsError(null);
        const res = await fetchWithAuth('/api/analytics/products');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch top products');
        }
        console.log('Dashboard: Top products data:', data);
        setTopProductsData(data);
      } catch (e: any) {
        console.error('Dashboard: Top products error:', e);
        setTopProductsError(e.message);
        setTopProductsData(null);
      } finally {
        setTopProductsLoading(false);
      }
    }
    fetchTopProducts();
  }, [shop, authLoading]);

  useEffect(() => {
    if (!shop || authLoading) return;

    async function fetchLowInventory() {
      try {
        setLowInventoryLoading(true);
        setLowInventoryError(null);
        const res = await fetchWithAuth('/api/analytics/inventory/low');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch low inventory');
        }
        console.log('Dashboard: Low inventory data:', data);
        setLowInventoryData(data);
      } catch (e: any) {
        console.error('Dashboard: Low inventory error:', e);
        setLowInventoryError(e.message);
        setLowInventoryData(null);
      } finally {
        setLowInventoryLoading(false);
      }
    }
    fetchLowInventory();
  }, [shop, authLoading]);

  useEffect(() => {
    if (!shop || authLoading) return;

    async function fetchNewProducts() {
      try {
        setNewProductsLoading(true);
        setNewProductsError(null);
        const res = await fetchWithAuth('/api/analytics/new_products');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch new products');
        }
        console.log('Dashboard: New products data:', data);
        setNewProductsData(data);
      } catch (e: any) {
        console.error('Dashboard: New products error:', e);
        setNewProductsError(e.message);
        setNewProductsData(null);
      } finally {
        setNewProductsLoading(false);
      }
    }
    fetchNewProducts();
  }, [shop, authLoading]);

  useEffect(() => {
    if (!shop || authLoading) return;

    async function fetchAbandonedCarts() {
      try {
        setAbandonedCartsLoading(true);
        setAbandonedCartsError(null);
        const res = await fetchWithAuth('/api/analytics/abandoned_carts');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch abandoned carts');
        }
        console.log('Dashboard: Abandoned carts data:', data);
        setAbandonedCartsData(data);
      } catch (e: any) {
        console.error('Dashboard: Abandoned carts error:', e);
        setAbandonedCartsError(e.message);
        setAbandonedCartsData(null);
      } finally {
        setAbandonedCartsLoading(false);
      }
    }
    fetchAbandonedCarts();
  }, [shop, authLoading]);

  useEffect(() => {
    if (!shop || authLoading) {
      console.log('Dashboard: Skipping report schedule fetch - no shop or auth loading');
      return;
    }

    console.log('Dashboard: Fetching report schedule');
    async function fetchSchedule() {
      try {
        setReportScheduleLoading(true);
        const res = await fetchWithAuth('/api/analytics/report/schedule');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch report schedule');
        }
        console.log('Dashboard: Report schedule data:', data);
        setReportSchedule(data.schedule || 'none');
      } catch (e: any) {
        console.error('Dashboard: Report schedule error:', e);
        setReportSchedule('none');
      } finally {
        setReportScheduleLoading(false);
      }
    }
    fetchSchedule();
  }, [shop, authLoading]);

  const handleScheduleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setReportSchedule(value);
    setReportScheduleStatus(null);
    try {
      const res = await fetchWithAuth('/api/analytics/report/schedule', {
        method: 'POST',
        body: JSON.stringify({ schedule: value }),
      });
      if (!res.ok) throw new Error('Failed to save schedule');
      setReportScheduleStatus('Saved!');
    } catch {
      setReportScheduleStatus('Failed to save');
    }
    setTimeout(() => setReportScheduleStatus(null), 2000);
  };

  const [error, setError] = useState<string | null>(null);

  const handleError = (error: Error) => {
    setError(error.message);
    setTimeout(() => setError(null), 5000);
  };

  const formatCurrency = (value: number) => {
    if (isNaN(value) || value === null || value === undefined) {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const getShopifyProductUrl = (productId: string) => {
    return `https://${shop}/admin/products/${productId}`;
  };

  const getShopifyOrderUrl = (orderId: string) => {
    return `https://${shop}/admin/orders/${orderId}`;
  };

  const getShopifyCartUrl = (cartId: string) => {
    return `https://${shop}/admin/checkouts/${cartId}`;
  };

  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie'>('line');
  const [chartMenuAnchor, setChartMenuAnchor] = useState<null | HTMLElement>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const handleChartMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setChartMenuAnchor(event.currentTarget);
  };

  const handleChartMenuClose = () => {
    setChartMenuAnchor(null);
  };

  const handleChartTypeChange = (type: 'line' | 'bar' | 'pie') => {
    setChartType(type);
    handleChartMenuClose();
  };

  const renderChart = () => {
    if (!revenueTSData?.timeseries) return <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography>No data available</Typography>
    </Box>;

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueTSData.timeseries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="created_at" tickFormatter={formatDate} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <RechartsTooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={formatDate}
              />
              <Line
                type="monotone"
                dataKey="total_price"
                stroke="#8884d8"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueTSData.timeseries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="created_at" tickFormatter={formatDate} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <RechartsTooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={formatDate}
              />
              <Bar dataKey="total_price" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={revenueTSData.timeseries}
                dataKey="total_price"
                nameKey="created_at"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${formatDate(name)}: ${formatCurrency(value)}`}
              >
                {revenueTSData.timeseries.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={formatDate}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  // Quick actions
  const quickActions = [
    {
      icon: <Add />, name: 'Create Product', onClick: () => window.open(`https://${shop}/admin/products/new`, '_blank')
    },
    {
      icon: <Storefront />, name: 'View All Products', onClick: () => window.open(`https://${shop}/admin/products`, '_blank')
    },
    {
      icon: <ListAlt />, name: 'View Orders', onClick: () => window.open(`https://${shop}/admin/orders`, '_blank')
    },
    {
      icon: <Person />, name: 'Profile', onClick: () => window.open(`https://${shop}/admin/settings/account`, '_blank')
    },
  ];

  // Recent orders section
  const renderRecentOrders = () => (
    <StyledCard>
      <CardTitle variant="h6">Recent Orders</CardTitle>
      {ordersTimeseries && ordersTimeseries.length > 0 ? (
        <>
          <List>
            {ordersTimeseries.map((order: Order) => (
              <ListItem 
                key={order.id}
                sx={{
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': {
                    borderBottom: 'none'
                  }
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip 
                      label={order.financial_status || 'pending'} 
                      color={order.financial_status === 'paid' ? 'success' : 'warning'}
                      size="small"
                    />
                    <MuiLink
                      href={`https://${shop}/admin/orders/${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                    >
                      <OpenInNew fontSize="small" />
                    </MuiLink>
                  </Box>
                }
              >
                <ListItemText
                  primary={
                    <Typography variant="subtitle1" fontWeight="medium">
                      #{order.name}
                      {order.customer && (
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          • {order.customer.first_name} {order.customer.last_name}
                        </Typography>
                      )}
                    </Typography>
                  }
                  secondary={
                    <Typography component="span" variant="body2" color="text.secondary">
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                        <span>{formatDate(order.created_at)}</span>
                        <Typography component="span" color="primary" fontWeight="medium">
                          {formatCurrency(Number(order.total_price) || 0)}
                        </Typography>
                        {order.fulfillment_status && (
                          <Chip 
                            label={order.fulfillment_status} 
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
          {hasMoreOrders && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
              <Button
                variant="outlined"
                onClick={loadMoreOrders}
                disabled={ordersLoading}
                startIcon={ordersLoading ? <CircularProgress size={20} /> : <Add />}
              >
                Load More Orders
              </Button>
            </Box>
          )}
        </>
      ) : (
        <Typography color="text.secondary" sx={{ p: 2 }}>No recent orders found.</Typography>
      )}
    </StyledCard>
  );

  if (authLoading || loading) {
    return (
      <LoadingContainer>
        <CircularProgress />
      </LoadingContainer>
    );
  }

  if (!shop) {
    return null; // Will be redirected by the useEffect
  }

  return (
    <DashboardContainer>
      <AppBar position="static" color="default" elevation={1} sx={{ mb: 4 }}>
        <Toolbar>
          <Box display="flex" alignItems="center" flexGrow={1}>
            <img src="/logo.svg" alt="StoreSight" style={{ height: 32, marginRight: 12 }} />
            <Typography variant="h6" color="primary" fontWeight={700}>Dashboard</Typography>
          </Box>
          <Button
            color="primary"
            variant="outlined"
            startIcon={<OpenInNew />}
            href={`https://${shop}/admin`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mr: 2 }}
          >
            Shopify Admin
          </Button>
          <IconButton onClick={() => window.location.reload()}><Refresh /></IconButton>
          <SpeedDial
            ariaLabel="Quick Actions"
            icon={<SpeedDialIcon />}
            direction="down"
            sx={{ ml: 2 }}
          >
            {quickActions.map((action) => (
              <SpeedDialAction
                key={action.name}
                icon={action.icon}
                tooltipTitle={action.name}
                onClick={action.onClick}
              />
            ))}
          </SpeedDial>
        </Toolbar>
      </AppBar>

      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Grid container spacing={3}>
        <GridItem xs={12} md={6} lg={3}>
          <StyledCard>
            <CardTitle variant="h6">Total Revenue</CardTitle>
            <MetricValue>
              {formatCurrency(revenueData?.revenue || 0)}
            </MetricValue>
          </StyledCard>
        </GridItem>

        <GridItem xs={12} md={6} lg={3}>
          <StyledCard>
            <CardTitle variant="h6">Abandoned Carts</CardTitle>
            {abandonedCartsData ? (
              <>
                <MetricValue color="error">
                  {abandonedCartsData.abandonedCarts}
                </MetricValue>
                <MetricDelta>
                  <TrendingDown color="error" />
                  <Typography color="error.main" variant="body2">
                    {abandonedCartsData.abandonedCarts > 5 ? 'High' : 'Normal'} abandonment rate
                  </Typography>
                </MetricDelta>
              </>
            ) : (
              <ErrorContainer>Failed to load abandoned carts data</ErrorContainer>
            )}
          </StyledCard>
        </GridItem>

        <GridItem xs={12} md={6} lg={3}>
          <StyledCard>
            <CardTitle variant="h6">Low Inventory</CardTitle>
            {lowInventoryData ? (
              <>
                <MetricValue color="warning.main">
                  {lowInventoryData.lowInventory.length}
                </MetricValue>
                <MetricDelta>
                  <Inventory color="warning" />
                  <Typography color="warning.main" variant="body2">
                    Products need attention
                  </Typography>
                </MetricDelta>
              </>
            ) : (
              <ErrorContainer>Failed to load inventory data</ErrorContainer>
            )}
          </StyledCard>
        </GridItem>

        <GridItem xs={12} md={6} lg={3}>
          <StyledCard>
            <CardTitle variant="h6">New Products</CardTitle>
            {newProductsData ? (
              <>
                <MetricValue color="success.main">
                  {newProductsData.newProducts}
                </MetricValue>
                <MetricDelta>
                  <AddBox color="success" />
                  <Typography color="success.main" variant="body2">
                    Added this month
                  </Typography>
                </MetricDelta>
              </>
            ) : (
              <ErrorContainer>Failed to load new products data</ErrorContainer>
            )}
          </StyledCard>
        </GridItem>

        <GridItem xs={12}>
          <StyledCard>
            <CardTitle variant="h6">Revenue Trend</CardTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2 }}>
              <Box>
                <Button
                  variant={chartType === 'line' ? 'contained' : 'outlined'}
                  onClick={() => handleChartTypeChange('line')}
                  sx={{ mr: 1 }}
                >
                  Line
                </Button>
                <Button
                  variant={chartType === 'bar' ? 'contained' : 'outlined'}
                  onClick={() => handleChartTypeChange('bar')}
                  sx={{ mr: 1 }}
                >
                  Bar
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'contained' : 'outlined'}
                  onClick={() => handleChartTypeChange('pie')}
                >
                  Pie
                </Button>
              </Box>
            </Box>
            <ChartContainer>
              {renderChart()}
            </ChartContainer>
          </StyledCard>
        </GridItem>

        <GridItem xs={12}>
          <StyledCard>
            <CardTitle variant="h6">Top Products</CardTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2 }}>
              <Chip label="Last 30 Days" size="small" />
            </Box>
            {topProductsData ? (
              <List>
                {topProductsData.products.map((product: Product) => (
                  <ListItem
                    key={product.id}
                    secondaryAction={
                      <MuiLink
                        href={getShopifyProductUrl(product.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        component="a"
                      >
                        View in Shopify
                        <OpenInNew fontSize="small" />
                      </MuiLink>
                    }
                  >
                    <ListItemText
                      primary={product.title}
                      secondary={
                        <Typography component="span" variant="body2" color="text.secondary">
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <span>{product.quantity || 0} units sold</span>
                            <Typography component="span" color="primary" fontWeight="medium">
                              {formatCurrency(Number(product.total_price))}
                            </Typography>
                          </Box>
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <ErrorContainer>Failed to load top products data</ErrorContainer>
            )}
          </StyledCard>
        </GridItem>

        <GridItem xs={12} md={6}>
          <StyledCard>
            <CardTitle variant="h6">Low Inventory Items</CardTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2 }}>
              <Chip label="Need Attention" size="small" color="warning" />
            </Box>
            {lowInventoryData ? (
              <List>
                {lowInventoryData.lowInventory.map((item: InventoryItem) => (
                  <ListItem
                    key={item.id}
                    secondaryAction={
                      <MuiLink
                        href={getShopifyProductUrl(item.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        component="a"
                      >
                        Restock
                        <OpenInNew fontSize="small" />
                      </MuiLink>
                    }
                  >
                    <ListItemText
                      primary={item.title}
                      secondary={`Only ${item.quantity} units left`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <ErrorContainer>Failed to load low inventory data</ErrorContainer>
            )}
          </StyledCard>
        </GridItem>

        <GridItem xs={12} md={6}>
          <StyledCard>
            <CardTitle variant="h6">Cohort & Funnel Analysis</CardTitle>
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
          </StyledCard>
        </GridItem>

        <GridItem xs={12} md={6}>
          <StyledCard>
            <CardTitle variant="h6">Export & Reporting</CardTitle>
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
          </StyledCard>
        </GridItem>

        <GridItem xs={12}>
          <StyledCard>
            <CardTitle variant="h6">Event-driven Automations</CardTitle>
            <ul className="list-disc pl-6 text-gray-700">
              <li>Competitor price change &rarr; Email/Slack/SMS alert</li>
              <li>Low inventory &rarr; Email/Slack/SMS alert</li>
              <li>Sales milestone &rarr; Email/Slack/SMS alert</li>
              <li>New product added &rarr; Email/Slack/SMS alert</li>
            </ul>
            <div className="mt-2 text-xs text-gray-500">Automations are managed in your notification settings.</div>
          </StyledCard>
        </GridItem>

        <GridItem xs={12}>
          <StyledCard>
            <CardTitle variant="h6">Walkthrough</CardTitle>
            {showWalkthrough && (
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
            )}
          </StyledCard>
        </GridItem>

        <GridItem xs={12}>
          {renderRecentOrders()}
        </GridItem>
      </Grid>
    </DashboardContainer>
  );
}
