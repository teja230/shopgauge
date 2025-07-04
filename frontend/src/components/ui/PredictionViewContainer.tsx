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
}

interface PredictionViewContainerProps {
  data: UnifiedAnalyticsData | null;
  loading?: boolean;
  error?: string | null;
  height?: number;
}

type PredictionView = 'revenue' | 'orders' | 'conversion';

const PredictionViewContainer: React.FC<PredictionViewContainerProps> = ({
  data,
  loading = false,
  error = null,
  height = 500,
}) => {
  const [activeView, setActiveView] = useState<PredictionView>('revenue');
  const [showPredictions, setShowPredictions] = useState(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Transform data for each prediction view
  const transformedData = useMemo(() => {
    if (!data) return { revenue: [], orders: [], conversion: [] };

    const historicalData = data.historical || [];
    const predictionData = showPredictions ? (data.predictions || []) : [];
    const combinedData = [...historicalData, ...predictionData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

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
      conversion_rate: item.conversion_rate,
      isPrediction: Boolean(item.isPrediction),
      confidence_min: item.conversion_rate * 0.8, // Simplified confidence interval
      confidence_max: item.conversion_rate * 1.2,
      confidence_score: (item.isPrediction && (item as any).confidence_score) || 0,
    }));

    return { revenue, orders, conversion };
  }, [data, showPredictions]);

  const handleViewChange = (
    event: React.MouseEvent<HTMLElement>,
    newView: PredictionView,
  ) => {
    if (newView !== null) {
      setActiveView(newView);
    }
  };

  const renderCurrentView = () => {
    if (loading) {
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

    // Show stylish "Make Predictions" button when forecasts are off
    if (!showPredictions) {
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
              Turn on forecasts to see AI-powered forecasts for your revenue, orders, and conversion rates.
            </Typography>
          </Box>
          
          <Button
            variant="contained"
            size="large"
            onClick={() => setShowPredictions(true)}
            startIcon={<AutoAwesome />}
            sx={{
              mt: 2,
              px: 5,
              py: 2,
              fontSize: '1.2rem',
              fontWeight: 700,
              borderRadius: 4,
              textTransform: 'none',
              background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
              boxShadow: `0 8px 32px ${theme.palette.secondary.main}40`,
              border: `2px solid transparent`,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                transition: 'left 0.6s ease',
              },
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.secondary.dark}, ${theme.palette.primary.dark})`,
                boxShadow: `0 12px 40px ${theme.palette.secondary.main}60`,
                transform: 'translateY(-3px) scale(1.02)',
                '&::before': {
                  left: '100%',
                },
              },
              '&:active': {
                transform: 'translateY(-1px) scale(0.98)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Make Forecasts
              <AutoAwesome sx={{ fontSize: '1.2rem' }} />
            </Box>
          </Button>
        </Box>
      );
    }

    const commonProps = {
      loading,
      error,
      height: height - 80, // Account for header
    };

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
    if (!data) return null;

    const historical = data.historical || [];
    const predictions = data.predictions || [];

    const currentPeriodData = historical.slice(-7); // Last 7 days
    const predictedData = showPredictions ? predictions.slice(0, 30) : []; // Next 30 days

          switch (activeView) {
        case 'revenue': {
          const currentRevenue = currentPeriodData.reduce((sum, d) => sum + d.revenue, 0);
          const predictedRevenue = predictedData.reduce((sum, d) => sum + d.revenue, 0);
          return {
            current: `$${currentRevenue.toLocaleString()}`,
            predicted: `$${predictedRevenue.toLocaleString()}`,
            metric: 'Revenue',
          };
        }
        case 'orders': {
          const currentOrders = currentPeriodData.reduce((sum, d) => sum + d.orders_count, 0);
          const predictedOrders = predictedData.reduce((sum, d) => sum + d.orders_count, 0);
          return {
            current: currentOrders.toLocaleString(),
            predicted: predictedOrders.toLocaleString(),
            metric: 'Orders',
          };
        }
        case 'conversion': {
          const avgCurrentConversion = currentPeriodData.length > 0 ? 
            currentPeriodData.reduce((sum, d) => sum + d.conversion_rate, 0) / currentPeriodData.length : 0;
          const avgPredictedConversion = predictedData.length > 0 ? 
            predictedData.reduce((sum, d) => sum + d.conversion_rate, 0) / predictedData.length : 0;
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

  return (
    <Box sx={{ 
      width: '100%',
      minHeight: { xs: 400, sm: 450, md: height || 500 },
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: theme.palette.background.paper,
      borderRadius: theme.shape.borderRadius,
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
      border: `1px solid ${theme.palette.divider}`,
      overflow: 'hidden',
    }}>
      {/* Header with Dashboard Theme */}
      <Box sx={{ 
        p: theme.spacing(2),
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: theme.spacing(2) 
        }}>
          <Typography 
            variant="h6" 
            component="h2" 
            sx={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: theme.palette.text.primary,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing(1),
            }}
          >
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
          </Typography>
          
          {/* Forecast Toggle with Better Styling */}
          <FormControlLabel
            control={
              <Switch
                checked={showPredictions}
                onChange={(e) => setShowPredictions(e.target.checked)}
                color="primary"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: theme.palette.primary.main,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: theme.palette.primary.main,
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {showPredictions ? 'Hide Forecast' : 'Show Forecast'}
              </Typography>
            }
            labelPlacement="start"
            sx={{ m: 0, gap: 1 }}
          />
        </Box>

        {/* Enhanced Stats Display */}
        {stats && (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: theme.spacing(2), 
            mb: theme.spacing(2),
            p: theme.spacing(2),
            background: `linear-gradient(135deg, ${theme.palette.background.default}, ${theme.palette.grey[50]})`,
            borderRadius: theme.shape.borderRadius,
            border: `1px solid ${theme.palette.divider}`,
          }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              p: theme.spacing(1),
              borderRadius: theme.shape.borderRadius,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              border: `1px solid ${theme.palette.grey[200]}`,
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                Current {stats.metric}
              </Typography>
              <Typography variant="h6" fontWeight={700} color="text.primary">
                {stats.current !== 'NaN' && stats.current !== 'undefined' ? stats.current : 'No data'}
              </Typography>
            </Box>
            {showPredictions && stats.predicted !== 'NaN' && stats.predicted !== 'undefined' && (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                p: theme.spacing(1),
                borderRadius: theme.shape.borderRadius,
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                border: `1px solid ${theme.palette.secondary.main}30`,
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: theme.palette.secondary.main,
                  borderRadius: '4px 4px 0 0',
                },
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <AutoAwesome sx={{ fontSize: 12, color: theme.palette.secondary.main }} />
                  <Typography variant="caption" color="text.secondary">
                    Forecast {stats.metric}
                  </Typography>
                </Box>
                <Typography variant="h6" fontWeight={700} color="secondary.main">
                  {stats.predicted}
                </Typography>
              </Box>
            )}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              p: theme.spacing(1),
              borderRadius: theme.shape.borderRadius,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              border: `1px solid ${theme.palette.grey[200]}`,
            }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                Active Metric
              </Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main">
                {stats.metric}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Enhanced View Toggle */}
        <ToggleButtonGroup
          value={activeView}
          exclusive
          onChange={handleViewChange}
          size="small"
          orientation={isMobile ? "vertical" : "horizontal"}
          sx={{
            backgroundColor: theme.palette.background.default,
            borderRadius: theme.shape.borderRadius,
            border: `1px solid ${theme.palette.divider}`,
            width: isMobile ? '100%' : 'auto',
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 600,
              px: theme.spacing(2),
              py: theme.spacing(1),
              border: 'none',
              color: theme.palette.text.secondary,
              minHeight: isMobile ? 48 : 'auto',
              width: isMobile ? '100%' : 'auto',
              justifyContent: isMobile ? 'flex-start' : 'center',
              '&.Mui-selected': {
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                boxShadow: `0 2px 8px ${theme.palette.primary.main}30`,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                },
              },
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
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
      </Box>

      {/* Chart Content with Proper Margins */}
      <Box sx={{ 
        flex: 1,
        minHeight: 300,
        p: theme.spacing(2),
        display: 'flex',
        flexDirection: 'column',
      }}>
        {renderCurrentView()}
      </Box>
    </Box>
  );
};

export default PredictionViewContainer; 