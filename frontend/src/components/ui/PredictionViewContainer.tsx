import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  ShoppingCart,
  Percent,
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Transform data for each prediction view
  const transformedData = useMemo(() => {
    if (!data) return { revenue: [], orders: [], conversion: [] };

    const combinedData = [...(data.historical || []), ...(data.predictions || [])].sort((a, b) => 
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
  }, [data]);

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
    const predictedData = predictions.slice(0, 30); // Next 30 days

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
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with controls */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            Predictive Analytics
          </Typography>
          {stats && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Last 7 days: <strong>{stats.current}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Next 30 days: <strong>{stats.predicted}</strong>
              </Typography>
            </Box>
          )}
        </Box>

        {/* View Toggle */}
        <ToggleButtonGroup
          value={activeView}
          exclusive
          onChange={handleViewChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 500,
            },
          }}
        >
          <ToggleButton value="revenue" aria-label="Revenue predictions">
            <TrendingUp fontSize="small" sx={{ mr: isMobile ? 0 : 1 }} />
            {!isMobile && 'Revenue'}
          </ToggleButton>
          <ToggleButton value="orders" aria-label="Order predictions">
            <ShoppingCart fontSize="small" sx={{ mr: isMobile ? 0 : 1 }} />
            {!isMobile && 'Orders'}
          </ToggleButton>
          <ToggleButton value="conversion" aria-label="Conversion predictions">
            <Percent fontSize="small" sx={{ mr: isMobile ? 0 : 1 }} />
            {!isMobile && 'Conversion'}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Chart Content */}
      <Box sx={{ flex: 1, p: 0 }}>
        {renderCurrentView()}
      </Box>
    </Paper>
  );
};

export default PredictionViewContainer; 