import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
  Switch,
  FormControlLabel,
  Chip,
  Card,
  CardContent,
  Divider,
  Badge,
  Fade,
  Slide,
  Button,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  TrendingUp,
  ShoppingCart,
  Percent,
  AutoAwesome,
  Psychology,
  TrendingDown,
  Analytics,
  Insights,
  Timeline,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import RevenuePredictionChart from './RevenuePredictionChart';
import OrderPredictionChart from './OrderPredictionChart';
import ConversionPredictionChart from './ConversionPredictionChart';

// Styled components matching main branch dashboard theme
const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: theme.shape.borderRadius,
  transition: 'all 0.3s ease',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[8],
  },
  // Mobile-first responsive design - disable hover effects on touch devices
  '@media (hover: none)': {
    '&:hover': {
      transform: 'none',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
    },
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

const ChartContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 450,
  height: 450,
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  // Mobile optimizations
  [theme.breakpoints.down('sm')]: {
    minHeight: 320, // Reduced height for mobile
    height: 320,
    padding: theme.spacing(0.5),
  },
}));

interface UnifiedAnalyticsData {
  historical: Array<{
    date: string;
    revenue: number;
    orders_count: number;
    conversion_rate: number;
    isPrediction?: false;
  }>;
  predictions: Array<{
    date: string;
    revenue: number;
    orders_count: number;
    conversion_rate: number;
    isPrediction?: true;
    confidence_interval?: {
      revenue_min: number;
      revenue_max: number;
      orders_min: number;
      orders_max: number;
    };
    confidence_score?: number;
  }>;
  total_revenue?: number; // Add this to get accurate total revenue
  total_orders?: number;  // Add this to get accurate total orders
  period_days?: number;   // Add this to fix TypeScript error
}

interface PredictionViewContainerProps {
  data: UnifiedAnalyticsData | null;
  loading?: boolean;
  error?: string | null;
  height?: number;
  onPredictionDaysChange?: (days: number) => void;
  predictionDays?: number;
}

type PredictionView = 'revenue' | 'orders' | 'conversion';

const PredictionViewContainer: React.FC<PredictionViewContainerProps> = ({
  data,
  loading = false,
  error = null,
  height = 500,
  onPredictionDaysChange,
  predictionDays = 30,
}) => {
  const [activeView, setActiveView] = useState<PredictionView>('revenue');
  const [showPredictions, setShowPredictions] = useState(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // Mobile-optimized dimensions
  const mobileHeight = Math.min(height * 0.8, 400); // Reduce height by 20% on mobile, cap at 400px
  const responsiveHeight = isMobile ? mobileHeight : height;

  // Enhanced debugging for data structure
  React.useEffect(() => {
    console.log('🔍 PredictionViewContainer: Data update', {
      hasData: !!data,
      loading,
      error,
      dataStructure: data ? {
        hasHistorical: Array.isArray(data.historical),
        historicalLength: data.historical?.length || 0,
        hasPredictions: Array.isArray(data.predictions),
        predictionsLength: data.predictions?.length || 0,
        hasTotalRevenue: typeof data.total_revenue === 'number',
        hasTotalOrders: typeof data.total_orders === 'number',
        totalRevenue: data.total_revenue,
        totalOrders: data.total_orders,
        periodDays: data.period_days,
        firstHistoricalItem: data.historical?.[0],
        firstPredictionItem: data.predictions?.[0]
      } : null
    });
  }, [data, loading, error]);

  // Transform data for each prediction view with enhanced validation
  const transformedData = useMemo(() => {
    console.log('🔄 PredictionViewContainer: Starting data transformation', {
      hasData: !!data,
      showPredictions,
      predictionDays,
      note: 'Processing unified analytics data for chart rendering'
    });

    if (!data) {
      console.log('⚠️ PredictionViewContainer: No data provided', { data });
      return { revenue: [], orders: [], conversion: [] };
    }

    // SIMPLIFIED VALIDATION - be more permissive with data structure
    const historicalData = Array.isArray(data.historical) ? data.historical : [];
    const allPredictions = showPredictions && Array.isArray(data.predictions) ? data.predictions : [];
    
    console.log('🔄 PredictionViewContainer: Processing data arrays', {
      historicalLength: historicalData.length,
      allPredictionsLength: allPredictions.length,
      predictionDays,
      showPredictions
    });

    // MORE PERMISSIVE VALIDATION - keep any valid items instead of rejecting all
    const validHistoricalData = historicalData.filter(item => {
      return item && 
        item.date && 
        (typeof item.revenue === 'number' || typeof item.revenue === 'string') &&
        (typeof item.orders_count === 'number' || typeof item.orders_count === 'string') &&
        !isNaN(Number(item.revenue)) &&
        !isNaN(Number(item.orders_count));
    }).map(item => ({
      ...item,
      revenue: Number(item.revenue) || 0,
      orders_count: Number(item.orders_count) || 0,
      conversion_rate: Number(item.conversion_rate) || 0,
      avg_order_value: Number((item as any).avg_order_value) || 0
    }));

    // Filter and take only the requested number of predictions
    const filteredPredictions = allPredictions.slice(0, predictionDays).filter(item => {
      return item && 
        item.date && 
        (typeof item.revenue === 'number' || typeof item.revenue === 'string') &&
        (typeof item.orders_count === 'number' || typeof item.orders_count === 'string') &&
        !isNaN(Number(item.revenue)) &&
        !isNaN(Number(item.orders_count));
    }).map(item => ({
      ...item,
      revenue: Number(item.revenue) || 0,
      orders_count: Number(item.orders_count) || 0,
      conversion_rate: Number(item.conversion_rate) || 0,
      avg_order_value: Number((item as any).avg_order_value) || 0
    }));

    console.log('✅ PredictionViewContainer: Validated and cleaned data', {
      validHistoricalLength: validHistoricalData.length,
      validPredictionLength: filteredPredictions.length,
      historicalSample: validHistoricalData.slice(0, 2),
      predictionSample: filteredPredictions.slice(0, 2)
    });

    // Combine and sort data
    const combinedData = [...validHistoricalData, ...filteredPredictions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Transform for each chart type
    const revenue = combinedData.map(item => ({
      date: item.date,
      revenue: item.revenue,
      isPrediction: Boolean(item.isPrediction),
      confidence_min: (item.isPrediction && (item as any).confidence_interval?.revenue_min) || 0,
      confidence_max: (item.isPrediction && (item as any).confidence_interval?.revenue_max) || 0,
      confidence_score: (item.isPrediction && (item as any).confidence_score) || 0,
    }));

    const orders = combinedData.map(item => ({
      date: item.date,
      orders_count: item.orders_count,
      isPrediction: Boolean(item.isPrediction),
      confidence_min: (item.isPrediction && (item as any).confidence_interval?.orders_min) || 0,
      confidence_max: (item.isPrediction && (item as any).confidence_interval?.orders_max) || 0,
      confidence_score: (item.isPrediction && (item as any).confidence_score) || 0,
    }));

    const conversion = combinedData.map(item => ({
      date: item.date,
      conversion_rate: item.conversion_rate || 0,
      isPrediction: Boolean(item.isPrediction),
      confidence_min: (item.conversion_rate || 0) * 0.8,
      confidence_max: (item.conversion_rate || 0) * 1.2,
      confidence_score: (item.isPrediction && (item as any).confidence_score) || 0,
    }));

    console.log('✅ PredictionViewContainer: Transformation complete', {
      revenuePoints: revenue.length,
      ordersPoints: orders.length,
      conversionPoints: conversion.length,
      combinedDataLength: combinedData.length,
      predictionDaysUsed: predictionDays
    });

    return { revenue, orders, conversion };
  }, [data, showPredictions, predictionDays]);

  const handleViewChange = (
    event: React.MouseEvent<HTMLElement>,
    newView: PredictionView,
  ) => {
    if (newView !== null) {
      console.log('🔄 PredictionViewContainer: View changed', { from: activeView, to: newView });
      setActiveView(newView);
    }
  };

  const renderCurrentView = () => {
    if (loading) {
      console.log('🔄 PredictionViewContainer: Rendering loading state');
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2,
        }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading analytics data...
          </Typography>
        </Box>
      );
    }

    if (error) {
      console.log('❌ PredictionViewContainer: Rendering error state', { error });
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2,
        }}>
          <Typography variant="h6" color="error">
            Error loading data
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
        </Box>
      );
    }

    // Simplified validation for data availability
    const hasValidData = data && 
      Array.isArray(data.historical) && 
      data.historical.length > 0 &&
      transformedData[activeView] && 
      transformedData[activeView].length > 0;

    console.log('🔍 PredictionViewContainer: Data validation for rendering', {
      hasValidData,
      hasData: !!data,
      hasHistorical: data && Array.isArray(data.historical),
      historicalLength: data?.historical?.length || 0,
      transformedDataLength: transformedData[activeView]?.length || 0,
      activeView,
      dataReadyForChart: hasValidData
    });

    if (!hasValidData) {
      // Check if we have any data at all (even if not perfect)
      const hasAnyData = data && (
        (Array.isArray(data.historical) && data.historical.length > 0) ||
        (Array.isArray(data.predictions) && data.predictions.length > 0)
      );

      if (hasAnyData) {
        console.log('⚠️ PredictionViewContainer: Some data available but validation failed, attempting to render anyway');
        // Fall through to render - maybe the chart can handle it
      } else {
        console.log('⚠️ PredictionViewContainer: No valid data available, showing empty state');
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: 3,
            p: 4,
          }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              textAlign: 'center',
            }}>
              <Analytics 
                sx={{ 
                  fontSize: 64, 
                  color: theme.palette.grey[400],
                  opacity: 0.8,
                }} 
              />
              <Typography variant="h5" fontWeight={600} color="text.secondary">
                No Analytics Data Available
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
                Advanced analytics will appear here once your store has revenue data. 
                The system needs historical data to generate forecasts.
              </Typography>
            </Box>
          </Box>
        );
      }
    }

    // Show stylish "Make Forecasts" button when forecasts are off
    if (!showPredictions) {
      // Still show historical data when predictions are off
      const hasHistoricalData = data && 
        Array.isArray(data.historical) && 
        data.historical.length > 0;

      if (hasHistoricalData) {
        console.log('🔄 PredictionViewContainer: Showing historical data with predictions off');
        // Show the charts with historical data only
        const commonProps = {
          loading,
          error,
          height: Math.max(300, height - 120),
        };

        const historicalOnlyData = {
          revenue: transformedData.revenue.filter(item => !item.isPrediction),
          orders: transformedData.orders.filter(item => !item.isPrediction),
          conversion: transformedData.conversion.filter(item => !item.isPrediction),
        };

        return (
          <Box sx={{ height: '100%' }}>
            {/* Header showing that forecasts are off but data is available */}
            <Box sx={{ 
              mb: 2,
              p: 2,
              backgroundColor: theme.palette.info.light,
              borderRadius: theme.shape.borderRadius,
              border: `1px solid ${theme.palette.info.main}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Analytics sx={{ color: theme.palette.info.main }} />
                <Typography variant="body2" fontWeight={600} color="info.main">
                  Showing Historical Data Only
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="secondary"
                size="small"
                onClick={() => setShowPredictions(true)}
                startIcon={<AutoAwesome />}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontWeight: 600,
                }}
              >
                Enable Forecasts
              </Button>
            </Box>

            {/* Render the current chart view with historical data only */}
            <Box sx={{ flex: 1, minHeight: 300 }}>
              {(() => {
                switch (activeView) {
                  case 'revenue':
                    return (
                      <RevenuePredictionChart
                        data={historicalOnlyData.revenue}
                        {...commonProps}
                      />
                    );
                  case 'orders':
                    return (
                      <OrderPredictionChart
                        data={historicalOnlyData.orders}
                        {...commonProps}
                      />
                    );
                  case 'conversion':
                    return (
                      <ConversionPredictionChart
                        data={historicalOnlyData.conversion}
                        {...commonProps}
                      />
                    );
                  default:
                    return null;
                }
              })()}
            </Box>
          </Box>
        );
      }

      // Show enable forecasts prompt when no historical data
      console.log('🔄 PredictionViewContainer: Rendering forecast toggle state');
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 3,
          p: 4,
        }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            textAlign: 'center',
          }}>
            <AutoAwesome 
              sx={{ 
                fontSize: 64, 
                color: theme.palette.secondary.main,
                opacity: 0.8,
              }} 
            />
            <Typography variant="h5" fontWeight={600} color="text.primary">
              Enable AI Forecasting
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
              Turn on forecasts to see AI-powered predictions for your revenue, orders, and conversion rates.
            </Typography>
          </Box>
          
          <Button
            variant="contained"
            color="secondary"
            onClick={() => setShowPredictions(true)}
            startIcon={<AutoAwesome />}
            sx={{
              borderRadius: 3,
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
              boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)',
              '&:hover': {
                boxShadow: '0 6px 16px rgba(156, 39, 176, 0.4)',
                transform: 'translateY(-1px)',
              },
            }}
          >
            Make Forecasts
          </Button>
        </Box>
      );
    }

    const commonProps = {
      loading,
      error,
      height: Math.max(300, height - 120), // Account for header and ensure minimum height
    };

    console.log('🔄 PredictionViewContainer: Rendering chart view', { 
      activeView, 
      dataLength: transformedData[activeView]?.length || 0 
    });

    switch (activeView) {
      case 'revenue':
        return (
          <RevenuePredictionChart
            data={transformedData.revenue}
            {...commonProps}
          />
        );
      case 'orders':
        return (
          <OrderPredictionChart
            data={transformedData.orders}
            {...commonProps}
          />
        );
      case 'conversion':
        return (
          <ConversionPredictionChart
            data={transformedData.conversion}
            {...commonProps}
          />
        );
      default:
        return null;
    }
  };

  const getViewStats = () => {
    if (!data || !Array.isArray(data.historical) || data.historical.length === 0) {
      console.log('⚠️ PredictionViewContainer: No data for stats calculation');
      return null;
    }

    const historical = data.historical || [];
    const predictions = data.predictions || [];

    // Fix: Use the total revenue from the data object instead of summing daily values
    // For current period, we'll use recent data, but for totals use the provided totals
    const currentPeriodData = historical.slice(-7); // Last 7 days for period comparison
    const predictedData = showPredictions ? predictions.slice(0, 30) : [];

    console.log('🔄 PredictionViewContainer: Calculating stats', {
      activeView,
      historicalLength: historical.length,
      predictionsLength: predictions.length,
      currentPeriodLength: currentPeriodData.length,
      predictedDataLength: predictedData.length,
      totalRevenue: data.total_revenue,
      totalOrders: data.total_orders
    });

    switch (activeView) {
      case 'revenue': {
        // Use the total revenue from data.total_revenue if available, otherwise fall back to calculation
        const totalRevenue = typeof data.total_revenue === 'number' ? data.total_revenue : 
          historical.reduce((sum, d) => sum + (d.revenue || 0), 0);
        
        // For current period (last 7 days), sum the values
        const currentPeriodRevenue = currentPeriodData.reduce((sum, d) => sum + (d.revenue || 0), 0);
        const predictedRevenue = predictedData.reduce((sum, d) => sum + (d.revenue || 0), 0);
        
        return {
          current: `$${currentPeriodRevenue.toLocaleString()}`,
          predicted: `$${predictedRevenue.toLocaleString()}`,
          metric: 'Revenue (7d)',
          total: `$${totalRevenue.toLocaleString()}`, // Add total for reference
        };
      }
      case 'orders': {
        // Use the total orders from data.total_orders if available
        const totalOrders = typeof data.total_orders === 'number' ? data.total_orders : 
          historical.reduce((sum, d) => sum + (d.orders_count || 0), 0);
        
        const currentOrders = currentPeriodData.reduce((sum, d) => sum + (d.orders_count || 0), 0);
        const predictedOrders = predictedData.reduce((sum, d) => sum + (d.orders_count || 0), 0);
        
        return {
          current: currentOrders.toLocaleString(),
          predicted: predictedOrders.toLocaleString(),
          metric: 'Orders (7d)',
          total: totalOrders.toLocaleString(),
        };
      }
      case 'conversion': {
        const avgCurrentConversion = currentPeriodData.length > 0 ? 
          currentPeriodData.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / currentPeriodData.length : 0;
        const avgPredictedConversion = predictedData.length > 0 ? 
          predictedData.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / predictedData.length : 0;
        return {
          current: `${avgCurrentConversion.toFixed(1)}%`,
          predicted: `${avgPredictedConversion.toFixed(1)}%`,
          metric: 'Conversion Rate',
        };
      }
      default:
        return null;
    }
  };

  const stats = getViewStats();
  console.log('🔄 PredictionViewContainer: Stats calculated', { stats, activeView });

  return (
    <StyledCard sx={{ 
      minHeight: { xs: 450, sm: 500, md: height || 550 },
    }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
        {/* Header with Dashboard Theme */}
        <Box sx={{ mb: 3 }}>
          <CardTitle>
            <Analytics color="primary" />
            Advanced Analytics
            <Chip
              icon={<AutoAwesome />}
              label="AI Forecast"
              color="secondary"
              size="small"
              sx={{ 
                fontWeight: 600,
                ml: 1,
              }}
            />
          </CardTitle>
          
          {/* Enhanced Forecast Toggle */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 2,
            flexWrap: 'wrap',
            gap: 1,
          }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showPredictions}
                  onChange={(e) => setShowPredictions(e.target.checked)}
                  color="secondary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AutoAwesome sx={{ fontSize: 16, color: 'secondary.main' }} />
                  <Typography variant="body2" fontWeight={600}>
                    {showPredictions ? 'Forecasts On' : 'Forecasts Off'}
                  </Typography>
                </Box>
              }
            />
            
            {/* Prediction Days Toggle */}
            {showPredictions && onPredictionDaysChange && (
              <ToggleButtonGroup
                value={predictionDays}
                exclusive
                onChange={(_, newDays) => newDays && onPredictionDaysChange(newDays)}
                size="small"
                sx={{
                  backgroundColor: theme.palette.background.default,
                  borderRadius: theme.shape.borderRadius,
                  border: `1px solid ${theme.palette.divider}`,
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    fontWeight: 600,
                    px: theme.spacing(1.5),
                    py: theme.spacing(0.5),
                    border: 'none',
                    color: theme.palette.text.secondary,
                    minWidth: 'auto',
                    fontSize: '0.75rem',
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.secondary.main,
                      color: theme.palette.secondary.contrastText,
                      '&:hover': {
                        backgroundColor: theme.palette.secondary.dark,
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  },
                }}
              >
                <ToggleButton value={7} aria-label="7 days">
                  7d
                </ToggleButton>
                <ToggleButton value={30} aria-label="30 days">
                  30d
                </ToggleButton>
                <ToggleButton value={60} aria-label="60 days">
                  60d
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            
            {showPredictions && (
              <Chip
                icon={<Psychology />}
                label="AI Powered"
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            )}
          </Box>
        </Box>
        
        {/* Stats Display with Enhanced Design */}
        {stats && (
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            gap: isMobile ? 1 : 2, 
            mb: isMobile ? 2 : 3,
            p: isMobile ? 1 : 2,
            backgroundColor: theme.palette.background.default,
            borderRadius: theme.shape.borderRadius,
            border: `1px solid ${theme.palette.divider}`,
          }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              p: isMobile ? 1 : 1.5,
              borderRadius: theme.shape.borderRadius,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              minWidth: isMobile ? 80 : 120,
              flex: 1,
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                Current {stats.metric}
              </Typography>
              <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ fontSize: isMobile ? '0.9rem' : '1.25rem' }}>
                {stats.current}
              </Typography>
            </Box>
            {showPredictions && stats.predicted && (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                p: isMobile ? 1 : 1.5,
                borderRadius: theme.shape.borderRadius,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.secondary.main}40`,
                minWidth: isMobile ? 80 : 120,
                flex: 1,
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: isMobile ? 2 : 3,
                  background: theme.palette.secondary.main,
                  borderRadius: `${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0 0`,
                },
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <AutoAwesome sx={{ fontSize: isMobile ? 10 : 12, color: theme.palette.secondary.main }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                    Forecast {stats.metric}
                  </Typography>
                </Box>
                <Typography variant="h6" fontWeight={700} color="secondary.main" sx={{ fontSize: isMobile ? '0.9rem' : '1.25rem' }}>
                  {stats.predicted}
                </Typography>
              </Box>
            )}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              p: isMobile ? 1 : 1.5,
              borderRadius: theme.shape.borderRadius,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              minWidth: isMobile ? 80 : 120,
              flex: 1,
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                Active Metric
              </Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ fontSize: isMobile ? '0.9rem' : '1.25rem' }}>
                {stats.metric}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Enhanced View Toggle with Dashboard Style */}
        <ToggleButtonGroup
          value={activeView}
          exclusive
          onChange={handleViewChange}
          size="small"
          orientation={isMobile ? "vertical" : "horizontal"}
          sx={{
            mb: 3,
            alignSelf: isMobile ? 'stretch' : 'flex-start',
            '& .MuiToggleButton-root': {
              borderRadius: theme.shape.borderRadius,
              textTransform: 'none',
              fontWeight: 600,
              padding: theme.spacing(1, 2),
              '&.Mui-selected': {
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                },
              },
            },
          }}
        >
          <ToggleButton value="revenue" aria-label="Revenue forecasts">
            <TrendingUp fontSize="small" sx={{ mr: 0.5 }} />
            Revenue
            {showPredictions && <AutoAwesome sx={{ ml: 0.5, fontSize: 14, color: 'secondary.main' }} />}
          </ToggleButton>
          <ToggleButton value="orders" aria-label="Order forecasts">
            <ShoppingCart fontSize="small" sx={{ mr: 0.5 }} />
            Orders
            {showPredictions && <AutoAwesome sx={{ ml: 0.5, fontSize: 14, color: 'secondary.main' }} />}
          </ToggleButton>
          <ToggleButton value="conversion" aria-label="Conversion forecasts">
            <Percent fontSize="small" sx={{ mr: 0.5 }} />
            Conversion
            {showPredictions && <AutoAwesome sx={{ ml: 0.5, fontSize: 14, color: 'secondary.main' }} />}
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Chart Content with Dashboard Style */}
        <ChartContainer>
          {renderCurrentView()}
        </ChartContainer>
      </CardContent>
    </StyledCard>
  );
};

export default PredictionViewContainer; 