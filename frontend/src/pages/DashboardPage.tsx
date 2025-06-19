import React, { useEffect, useState } from 'react';
import { MetricCard } from '../components/ui/MetricCard';
import { fetchWithAuth } from '../api';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, XAxis, YAxis, Legend, Tooltip as RechartsTooltip, Line, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Tooltip } from '../components/ui/Tooltip';
import { Dialog } from '@headlessui/react';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Alert, Snackbar, Box, Chip, IconButton, Link as MuiLink, Button, Menu, MenuItem, Grid, Card, Typography, List, ListItem, ListItemText, Paper, CardContent } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { TrendingUp, TrendingDown, ShoppingCart, Inventory, AddBox, OpenInNew, Refresh, MoreVert, Timeline, Add, Storefront, ListAlt, Person, RemoveShoppingCart, Warning, Close, Logout } from '@mui/icons-material';
import { format } from 'date-fns';
import { AppBar, Toolbar } from '@mui/material';
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material';
import Avatar from '@mui/material/Avatar';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { useTheme, useMediaQuery } from '@mui/material';

// Modern, elegant, and professional dashboard UI improvements
const DashboardContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  display: 'flex',
  flexDirection: 'column'
}));

const DashboardHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    padding: theme.spacing(2)
  }
}));

const HeaderContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2)
}));

const HeaderIcon = styled(Storefront)(({ theme }) => ({
  fontSize: 32,
  color: theme.palette.primary.main
}));

const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.5rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5)
}));

const HeaderSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary
}));

const ShopLink = styled('a')(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  '&:hover': {
    textDecoration: 'underline'
  }
}));

const HeaderActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    width: '100%',
    justifyContent: 'space-between'
  }
}));

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: theme.shape.borderRadius,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[8],
  },
}));

const CardTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(2),
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
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
  padding: theme.spacing(3),
  fontSize: '2.75rem',
  fontWeight: 700,
  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  letterSpacing: '-1px',
}));

const MetricLabel = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(0, 3, 3),
  color: theme.palette.text.secondary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  fontWeight: 500,
  fontSize: '1rem',
}));

const ChartContainer = styled(Box)(({ theme }) => ({
  height: 300,
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

const ProductLink = styled(MuiLink)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '&:hover': {
    textDecoration: 'underline',
  },
}));

const OrderLink = styled(MuiLink)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '&:hover': {
    textDecoration: 'underline',
  },
}));

interface Product {
  id: string;
  title: string;
  quantity: number;
  total_price: number;
}

interface Order {
  id: string;
  created_at: string;
  total_price: number;
  customer?: {
    first_name: string;
    last_name: string;
  };
}

interface RevenueData {
  created_at: string;
  total_price: number;
}

interface DashboardInsight {
  totalRevenue: number;
  revenue?: number;
  newProducts: number;
  abandonedCarts: number;
  lowInventory: number;
  topProducts: any[];
  orders: any[];
  recentOrders: any[];
  timeseries: any[];
  conversionRate?: number;
  conversionRateDelta?: number;
  abandonedCartCount?: number;
}

interface InventoryItem {
  id: string;
  title: string;
  quantity: number;
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

// Add a modern SaaS hero section at the top of the dashboard
const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(90deg, #f5f7fa 0%, #c3cfe2 100%)',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(4, 4, 4, 4),
  marginBottom: theme.spacing(5),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  boxShadow: theme.shadows[1],
  gap: theme.spacing(4),
}));

const HeroText = styled(Box)(({ theme }) => ({
  flex: 1,
}));

const HeroTitle = styled(Typography)(({ theme }) => ({
  fontSize: '2.5rem',
  fontWeight: 800,
  color: theme.palette.primary.main,
  marginBottom: theme.spacing(1),
  letterSpacing: '-1px',
}));

const HeroSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(2),
}));

const HeroImage = styled('img')(() => ({
  width: 180,
  height: 180,
  objectFit: 'contain',
  borderRadius: 24,
  boxShadow: '0 4px 24px 0 rgba(80, 112, 255, 0.10)',
}));

const GridContainer = styled(Grid)(({ theme }) => ({
  marginTop: theme.spacing(2),
  gap: theme.spacing(3),
}));

const ProductList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  maxHeight: '400px',
  overflowY: 'auto',
  padding: theme.spacing(1),
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(0, 0, 0, 0.05)',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(0, 0, 0, 0.1)',
    borderRadius: '4px',
    '&:hover': {
      background: 'rgba(0, 0, 0, 0.2)',
    },
  },
}));

const ProductItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: 'rgba(0, 0, 0, 0.02)',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    transform: 'translateY(-1px)',
  },
}));

const ProductInfo = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 8,
}));

const ProductName = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '0.95rem',
  color: theme.palette.text.primary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginBottom: theme.spacing(0.5),
}));

const ProductStats = styled(Typography)(({ theme }) => ({
  fontSize: '0.85rem',
  color: theme.palette.text.secondary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const OrderList = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  maxHeight: '400px',
  overflowY: 'auto',
  padding: theme.spacing(1),
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(0, 0, 0, 0.05)',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(0, 0, 0, 0.1)',
    borderRadius: '4px',
    '&:hover': {
      background: 'rgba(0, 0, 0, 0.2)',
    },
  },
}));

const OrderItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: 'rgba(0, 0, 0, 0.02)',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    transform: 'translateY(-1px)',
  },
}));

const OrderInfo = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 8,
}));

const OrderTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '0.95rem',
  color: theme.palette.text.primary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginBottom: theme.spacing(0.5),
}));

const OrderDetails = styled(Typography)(({ theme }) => ({
  fontSize: '0.85rem',
  color: theme.palette.text.secondary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const ProductAvatar = styled(Avatar)(({ theme }) => ({
  width: 48,
  height: 48,
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.primary.main,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
}));

const OrderAvatar = styled(Avatar)(({ theme }) => ({
  width: 48,
  height: 48,
  backgroundColor: theme.palette.warning.light,
  color: theme.palette.warning.dark,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
}));

const StatusChip = styled(Chip)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  fontWeight: 500,
  '&.MuiChip-colorSuccess': {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  '&.MuiChip-colorWarning': {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
  paddingBottom: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const GraphContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
}));

const GraphHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
}));

const GraphTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const GraphLink = styled(MuiLink)(({ theme }) => ({
  color: theme.palette.primary.main,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  fontSize: '0.875rem',
  '&:hover': {
    textDecoration: 'underline',
  },
}));

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'MMM d, yyyy');
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { shop, loading: authLoading, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [insights, setInsights] = useState<DashboardInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!shop) {
        setError('No shop selected');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch single page of orders first to check for permission issues
        const orderResponse = await fetchWithAuth('/api/analytics/orders/timeseries?page=1&limit=50');
        const firstOrderData = await orderResponse.json();
        
        let allOrders = [];
        let permissionError = null;
        
        // Check if we got permission error
        console.log('First order data response:', firstOrderData);
        if (firstOrderData.error_code === 'INSUFFICIENT_PERMISSIONS') {
          permissionError = firstOrderData.error;
          console.warn('Orders permission issue:', firstOrderData.error);
        } else if (firstOrderData.timeseries) {
          // If first page worked, fetch more pages
          const additionalOrderPromises = Array.from({ length: 4 }, (_, i) => 
            fetchWithAuth(`/api/analytics/orders/timeseries?page=${i + 2}&limit=50`)
          );
          
          try {
            const additionalOrderResponses = await Promise.all(additionalOrderPromises);
            const additionalOrderData = await Promise.all(additionalOrderResponses.map(r => r.json()));
            
            // Combine all orders
            allOrders = [firstOrderData, ...additionalOrderData]
              .flatMap(data => data.timeseries || [])
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          } catch (err) {
            console.warn('Error fetching additional order pages:', err);
            allOrders = firstOrderData.timeseries || [];
          }
        }

        // Get other data from the remaining responses
        const [revenueResponse, productsResponse, lowInventoryResponse, newProductsResponse, insightsResponse] = 
          await Promise.all([
            fetchWithAuth('/api/analytics/revenue'),
            fetchWithAuth('/api/analytics/products'),
            fetchWithAuth('/api/analytics/inventory/low'),
            fetchWithAuth('/api/analytics/new_products'),
            fetchWithAuth('/api/insights')
          ]);

        const [
          revenueData,
          productsData,
          lowInventoryData,
          newProductsData,
          insightsData
        ] = await Promise.all([
          revenueResponse.json(),
          productsResponse.json(),
          lowInventoryResponse.json(),
          newProductsResponse.json(),
          insightsResponse.json()
        ]);

        // Check for revenue permission error
        if (revenueData.error_code === 'INSUFFICIENT_PERMISSIONS') {
          console.log('Revenue permission issue:', revenueData.error);
          if (!permissionError) {
            permissionError = revenueData.error;
          }
        }

        // Process revenue data for chart
        let revenueTimeseries = [];
        if (revenueData.timeseries) {
          revenueTimeseries = revenueData.timeseries;
        } else if (allOrders.length > 0) {
          // Create revenue timeseries from orders if not available
          revenueTimeseries = allOrders.map((order: any) => ({
            created_at: order.created_at,
            total_price: parseFloat(order.total_price) || 0
          }));
        }

        // Set insights with available data
        setInsights({
          totalRevenue: revenueData.totalRevenue || revenueData.revenue || 0,
          newProducts: newProductsData.newProducts || 0,
          abandonedCarts: insightsData?.abandoned_cart_count || 0,
          lowInventory: Array.isArray(lowInventoryData.lowInventory) ? lowInventoryData.lowInventory.length : (lowInventoryData.lowInventoryCount || 0),
          topProducts: productsData.products || [],
          orders: allOrders,
          recentOrders: allOrders.slice(0, 5),
          timeseries: revenueTimeseries,
          conversionRate: insightsData?.conversion_rate || 0,
          conversionRateDelta: insightsData?.conversion_rate_delta || 0,
          abandonedCartCount: insightsData?.abandoned_cart_count || 0,
        });

        // Check for permission errors
        if (permissionError) {
          console.log('Setting permission error:', permissionError);
          setError(permissionError);
        } else {
          // Clear any previous non-permission error (no generic "no data" banner)
          setError(null);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        if (error instanceof Error) {
          if (error.message.includes('Unauthorized')) {
            setError('Please log in to view your dashboard');
          } else {
            setError('Failed to load dashboard data. Please try again later.');
          }
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shop]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  // Check if this is a permission error that should show the dashboard with alerts
  const isPermissionError = error && (
    error.includes('re-authentication') || 
    error.includes('requires re-authentication') ||
    error.includes('Orders access requires') ||
    error.includes('INSUFFICIENT_PERMISSIONS')
  );
  
  // Debug logging
  console.log('Dashboard error state:', { error, isPermissionError });
  
  // Additional check for specific error message as fallback
  const hasReauthError = error && error.includes('Orders access requires re-authentication');
  console.log('Has reauth error:', hasReauthError);
  
  // TEMPORARY: Force permission error for testing
  // const isPermissionError = true;
  
  if (error && !isPermissionError) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <Typography variant="h6" color="text.secondary">
          {error}
        </Typography>
        {error === 'No data available yet. Check back soon!' && (
          <Typography variant="body2" color="text.secondary" component="div">
            Your dashboard will populate with data once you start making sales
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <DashboardContainer>
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: { xs: 2, md: 3 },
          width: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          px: { xs: 2, md: 3 },
          pt: 3
        }}
      >
        {/* Single Unified Re-authentication Banner */}
        {isPermissionError && (
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 3,
              p: 3,
              '& .MuiAlert-message': {
                width: '100%'
              }
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Box>
                <Typography variant="h6" component="div" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔒 Store Re-authentication Required
                </Typography>
                <Typography variant="body1" component="div" sx={{ mb: 1 }}>
                  Your Shopify store needs updated permissions to display orders and revenue data.
                </Typography>
                <Typography variant="body2" color="text.secondary" component="div">
                  This will redirect you to Shopify to grant the necessary permissions, then bring you back here.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, ml: 3 }}>
                <Button
                  variant="contained"
                  color="warning"
                  size="large"
                  component="a"
                  href={`/api/auth/shopify/reauth?shop=${encodeURIComponent(shop ?? '')}`}
                  target="_self"
                  sx={{
                    minWidth: 180,
                    fontWeight: 600,
                    fontSize: '1rem',
                    py: 1.5,
                  }}
                >
                  Re-authenticate Store
                </Button>
                
                {/* Debug: Test buttons */}
                <Button 
                  variant="outlined" 
                  color="info"
                  size="small"
                  onClick={async () => {
                    console.log('Testing backend connectivity...');
                    try {
                      const response = await fetch('/api/auth/shopify/me', {
                        credentials: 'include'
                      });
                      const data = await response.json();
                      console.log('Backend response:', data);
                      alert(`Backend test: ${response.status} - ${JSON.stringify(data)}`);
                    } catch (error) {
                      console.error('Backend test failed:', error);
                      alert(`Backend test failed: ${error}`);
                    }
                  }}
                  sx={{ fontSize: '0.8rem', py: 1 }}
                >
                  Test Backend
                </Button>
                
                <Button 
                  variant="outlined" 
                  color="warning"
                  size="large"
                  component="a"
                  href={`/api/auth/shopify/reauth?shop=${encodeURIComponent(shop ?? '')}`}
                  target="_self"
                  sx={{ 
                    minWidth: 120,
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    py: 1.5
                  }}
                >
                  Direct Link
                </Button>
              </Box>
            </Box>
          </Alert>
        )}

        {/* Regular error alert for non-permission errors */}
        {error && !isPermissionError && (
          <Alert 
            severity="info" 
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {/* Metrics Overview */}
        <Box 
          sx={{ 
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
            gap: 2
          }}
        >
          <MetricCard
            key="conversion-rate"
            label="Conversion Rate"
            value={`${insights?.conversionRate?.toFixed(2) || '0'}%`}
            delta={insights?.conversionRateDelta?.toString() || '0'}
            deltaType={insights?.conversionRateDelta && insights.conversionRateDelta > 0 ? 'up' : 'down'}
          />
          <MetricCard
            key="abandoned-carts"
            label="Abandoned Carts"
            value={insights?.abandonedCarts?.toString() || '0'}
            delta="0"
            deltaType="neutral"
          />
          <MetricCard
            key="low-inventory"
            label="Low Inventory"
            value={typeof insights?.lowInventory === 'number' ? insights.lowInventory.toString() : '0'}
            delta="0"
            deltaType="neutral"
          />
          <MetricCard
            key="new-products"
            label="New Products"
            value={typeof insights?.newProducts === 'number' ? insights.newProducts.toString() : '0'}
            delta="0"
            deltaType="neutral"
          />
        </Box>

        {/* Products and Orders */}
        <Box 
          sx={{ 
            display: 'flex', 
            gap: { xs: 2, md: 3 }, 
            flexDirection: { xs: 'column', md: 'row' },
            width: '100%'
          }}
        >
          <Box 
            sx={{ 
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <StyledCard sx={{ height: '100%' }}>
              <CardContent>
                <SectionHeader>
                  <SectionTitle>
                    <Inventory2Icon color="primary" />
                    Top Products
                  </SectionTitle>
                </SectionHeader>
                {insights?.topProducts?.length ? (
                  <ProductList>
                    {insights.topProducts.map((product) => (
                      <ProductItem key={`product-${product.id}`}>
                        <ProductInfo>
                          <ProductName>
                            <ProductLink 
                              href={`https://${shop}/admin/products/${product.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              {product.title}
                              <OpenInNew fontSize="small" />
                            </ProductLink>
                          </ProductName>
                          <ProductStats>
                            {product.quantity} units sold • ${product.total_price}
                          </ProductStats>
                        </ProductInfo>
                      </ProductItem>
                    ))}
                  </ProductList>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No products data available yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                      Product performance data will appear here once you start making sales
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </StyledCard>
          </Box>

          <Box 
            sx={{ 
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <StyledCard sx={{ height: '100%' }}>
              <CardContent>
                <SectionHeader>
                  <SectionTitle>
                    <ListAlt color="primary" />
                    Recent Orders
                  </SectionTitle>
                </SectionHeader>
                {insights?.orders?.length ? (
                  <OrderList>
                    {insights.orders.map((order, index) => (
                      <OrderItem key={`order-${order.id || `temp-${index}`}`}>
                        <OrderInfo>
                          <OrderTitle>
                            {order.id ? (
                              <OrderLink 
                                href={`https://${shop}/admin/orders/${order.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                Order #{order.id}
                                <OpenInNew fontSize="small" />
                              </OrderLink>
                            ) : (
                              <Typography variant="body1" color="text.secondary" component="div">
                                Order #{`Temporary-${index + 1}`}
                              </Typography>
                            )}
                            {order.customer && (
                              <Typography 
                                component="span" 
                                variant="body2" 
                                color="text.secondary" 
                                sx={{ 
                                  ml: 1,
                                  display: { xs: 'none', sm: 'inline' }
                                }}
                              >
                                • {order.customer.first_name} {order.customer.last_name}
                              </Typography>
                            )}
                          </OrderTitle>
                          <OrderDetails>
                            {formatDate(order.created_at)} • ${order.total_price}
                          </OrderDetails>
                        </OrderInfo>
                      </OrderItem>
                    ))}
                  </OrderList>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No orders data available yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                      {isPermissionError 
                        ? 'Please use the re-authentication banner above to restore access'
                        : 'Order data will appear here once you start receiving orders'
                      }
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </StyledCard>
          </Box>
        </Box>

        {/* Revenue Graph */}
        <Box sx={{ width: '100%' }}>
          <GraphContainer>
            <GraphHeader>
              <GraphTitle>
                <TrendingUp color="primary" />
                Revenue Overview
              </GraphTitle>
              <GraphLink 
                href={`https://${shop}/admin/analytics`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                View in Shopify Analytics
                <OpenInNew fontSize="small" />
              </GraphLink>
            </GraphHeader>
            {insights?.timeseries?.length ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={insights.timeseries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" />
                  <XAxis 
                    dataKey="created_at" 
                    stroke="rgba(0, 0, 0, 0.5)"
                    tick={{ fill: 'rgba(0, 0, 0, 0.7)' }}
                  />
                  <YAxis 
                    stroke="rgba(0, 0, 0, 0.5)"
                    tick={{ fill: 'rgba(0, 0, 0, 0.7)' }}
                    tickFormatter={(value: number) => `$${value}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total_price" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: '#2563eb', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ 
                height: 400, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2
              }}>
                <Typography variant="h6" color="text.secondary">
                  No revenue data available yet
                </Typography>
                <Typography variant="body2" color="text.secondary" component="div">
                  {isPermissionError 
                    ? 'Please use the re-authentication banner above to restore access'
                    : 'Revenue data will appear here once you start making sales'
                  }
                </Typography>
              </Box>
            )}
          </GraphContainer>
        </Box>

        <Typography variant="body2" color="text.secondary">
          {insights ? 'Dashboard updated with latest data' : 'Loading insights...'}
        </Typography>

        {/* Debug helpers removed for production */}
      </Box>
    </DashboardContainer>
  );
};

export default DashboardPage;
