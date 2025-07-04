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
    <Card sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 3,
      boxShadow: theme.shadows[6],
    }}>
      {/* Enhanced Header */}
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge
              badgeContent={<Psychology sx={{ fontSize: 14, color: theme.palette.secondary.contrastText }} />}
              color="secondary"
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              sx={{
                '& .MuiBadge-badge': {
                  backgroundColor: theme.palette.secondary.main,
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.1)' },
                    '100%': { transform: 'scale(1)' },
                  },
                },
              }}
            >
              <Typography variant="h5" component="h1" fontWeight={700} sx={{ 
                background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}>
                <Analytics />
                Advanced Analytics
              </Typography>
            </Badge>
            
            <Chip
              icon={<AutoAwesome />}
              label="AI-Powered"
              color="secondary"
              variant="outlined"
              size="small"
              sx={{ 
                fontWeight: 600,
                borderWidth: 2,
                '&:hover': {
                  boxShadow: `0 0 10px ${theme.palette.secondary.main}40`,
                },
              }}
            />
          </Box>
          
          {/* Prediction Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={showPredictions}
                onChange={(e) => setShowPredictions(e.target.checked)}
                color="secondary"
                icon={<VisibilityOff />}
                checkedIcon={<Visibility />}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Insights fontSize="small" />
                <Typography variant="body2" fontWeight={600}>
                  {showPredictions ? 'Hide' : 'Show'} Predictions
                </Typography>
              </Box>
            }
            labelPlacement="start"
            sx={{ 
              m: 0,
              '& .MuiFormControlLabel-label': {
                color: theme.palette.text.secondary,
              },
            }}
          />
        </Box>

        {/* Enhanced Stats Display */}
        {stats && (
          <Fade in={true} timeout={800}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2, 
              mb: 3,
            }}>
              <Card variant="outlined" sx={{ p: 1.5, backgroundColor: 'rgba(37, 99, 235, 0.05)' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Current Period
                </Typography>
                <Typography variant="h6" fontWeight={700} color="primary">
                  {stats.current}
                </Typography>
              </Card>
              
              {showPredictions && (
                <Card variant="outlined" sx={{ p: 1.5, backgroundColor: 'rgba(139, 92, 246, 0.05)' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    AI Prediction
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="secondary">
                    {stats.predicted}
                  </Typography>
                </Card>
              )}
              
              <Card variant="outlined" sx={{ p: 1.5, backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Metric Type
                </Typography>
                <Typography variant="h6" fontWeight={700} color="success.main">
                  {stats.metric}
                </Typography>
              </Card>
              
              {showPredictions && (
                <Card variant="outlined" sx={{ p: 1.5, backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Confidence
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="warning.main">
                    85-92%
                  </Typography>
                </Card>
              )}
            </Box>
          </Fade>
        )}

        <Divider sx={{ mb: 2, opacity: 0.6 }} />

        {/* Enhanced View Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <ToggleButtonGroup
            value={activeView}
            exclusive
            onChange={handleViewChange}
            size={isMobile ? 'medium' : 'large'}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              border: `2px solid ${theme.palette.divider}`,
              borderRadius: 3,
              boxShadow: theme.shadows[2],
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: 2.5,
                margin: 0.5,
                px: isMobile ? 2 : 3,
                py: 1,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: isMobile ? '0.875rem' : '1rem',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  transform: 'translateY(-1px)',
                },
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                },
              },
            }}
          >
            <ToggleButton value="revenue" aria-label="Revenue predictions">
              <TrendingUp fontSize="small" sx={{ mr: 1 }} />
              Revenue
              {showPredictions && (
                <AutoAwesome sx={{ ml: 1, fontSize: 16, opacity: 0.7 }} />
              )}
            </ToggleButton>
            <ToggleButton value="orders" aria-label="Order predictions">
              <ShoppingCart fontSize="small" sx={{ mr: 1 }} />
              Orders
              {showPredictions && (
                <AutoAwesome sx={{ ml: 1, fontSize: 16, opacity: 0.7 }} />
              )}
            </ToggleButton>
            <ToggleButton value="conversion" aria-label="Conversion predictions">
              <Percent fontSize="small" sx={{ mr: 1 }} />
              Conversion
              {showPredictions && (
                <AutoAwesome sx={{ ml: 1, fontSize: 16, opacity: 0.7 }} />
              )}
            </ToggleButton>
          </ToggleButtonGroup>
          
          {showPredictions && (
            <Slide direction="left" in={showPredictions} timeout={500}>
              <Chip
                icon={<Timeline />}
                label="30-Day Forecast Active"
                color="secondary"
                variant="filled"
                sx={{ 
                  fontWeight: 600,
                  animation: 'glow 3s ease-in-out infinite alternate',
                  '@keyframes glow': {
                    '0%': { boxShadow: `0 0 5px ${theme.palette.secondary.main}40` },
                    '100%': { boxShadow: `0 0 15px ${theme.palette.secondary.main}60` },
                  },
                }}
              />
            </Slide>
          )}
        </Box>
      </CardContent>

      {/* Chart Content */}
      <Box sx={{ flex: 1, p: 0, minHeight: 0 }}>
        <Fade in={true} timeout={600} key={`${activeView}-${showPredictions}`}>
          <Box sx={{ height: '100%' }}>
            {renderCurrentView()}
          </Box>
        </Fade>
      </Box>
    </Card>
  );
};

export default PredictionViewContainer; 