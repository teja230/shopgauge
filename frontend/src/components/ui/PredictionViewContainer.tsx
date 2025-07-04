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
      height: { xs: 350, sm: 400, md: height || 450 },
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'background.paper',
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 2,
      boxShadow: theme.shadows[2],
    }}>
      {/* Simplified Header */}
      <Box sx={{ 
        p: { xs: 2, sm: 3 },
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" component="h2" fontWeight={700} sx={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: theme.palette.text.primary,
            }}>
              <Analytics color="primary" />
              Advanced Analytics
            </Typography>
            
            <Chip
              icon={<AutoAwesome />}
              label="AI"
              color="secondary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Box>
          
          {/* Simplified Prediction Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={showPredictions}
                onChange={(e) => setShowPredictions(e.target.checked)}
                color="secondary"
                size="small"
              />
            }
            label={
              <Typography variant="body2" fontWeight={600}>
                Predictions
              </Typography>
            }
            labelPlacement="start"
            sx={{ m: 0 }}
          />
        </Box>

        {/* Compact Stats Display */}
        {stats && (
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            mb: 2,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <Typography variant="body2" color="text.secondary">
              Current: <strong>{stats.current}</strong>
            </Typography>
            {showPredictions && (
              <Typography variant="body2" color="text.secondary">
                Predicted: <strong>{stats.predicted}</strong>
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Metric: <strong>{stats.metric}</strong>
            </Typography>
          </Box>
        )}

        {/* Mobile-Optimized View Toggle */}
        <ToggleButtonGroup
          value={activeView}
          exclusive
          onChange={handleViewChange}
          size={isMobile ? "medium" : "small"}
          orientation={isMobile ? "vertical" : "horizontal"}
          sx={{
            width: isMobile ? '100%' : 'auto',
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 600,
              px: { xs: 2, sm: 2 },
              py: { xs: 1, sm: 0.5 },
              border: `1px solid ${theme.palette.divider}`,
              minHeight: isMobile ? 48 : 'auto',
              justifyContent: isMobile ? 'flex-start' : 'center',
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
          <ToggleButton value="revenue" aria-label="Revenue predictions" sx={{ width: isMobile ? '100%' : 'auto' }}>
            <TrendingUp fontSize="small" sx={{ mr: 0.5 }} />
            Revenue
            {showPredictions && <AutoAwesome sx={{ ml: 0.5, fontSize: 14 }} />}
          </ToggleButton>
          <ToggleButton value="orders" aria-label="Order predictions" sx={{ width: isMobile ? '100%' : 'auto' }}>
            <ShoppingCart fontSize="small" sx={{ mr: 0.5 }} />
            Orders
            {showPredictions && <AutoAwesome sx={{ ml: 0.5, fontSize: 14 }} />}
          </ToggleButton>
          <ToggleButton value="conversion" aria-label="Conversion predictions" sx={{ width: isMobile ? '100%' : 'auto' }}>
            <Percent fontSize="small" sx={{ mr: 0.5 }} />
            Conversion
            {showPredictions && <AutoAwesome sx={{ ml: 0.5, fontSize: 14 }} />}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Chart Content - Fixed Height */}
      <Box sx={{ 
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {renderCurrentView()}
      </Box>
    </Box>
  );
};

export default PredictionViewContainer; 