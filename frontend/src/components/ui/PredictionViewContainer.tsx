// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Analytics,
  AutoAwesome,
  TrendingUp,
  ShoppingCart,
  Percent,
  Psychology,
  Share as ShareIcon,
  Refresh,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import RevenuePredictionChart from './RevenuePredictionChart';
import OrderPredictionChart from './OrderPredictionChart';
import ConversionPredictionChart from './ConversionPredictionChart';
import SimpleShareModal from './SimpleShareModal';
import { useAuth } from '../../context/AuthContext';
import { UNIFIED_COLOR_SCHEME } from './ChartStyles';

// Simplified styled components for Chrome compatibility
const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  backgroundColor: theme.palette.background.paper,
}));

const CardTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2),
}));

const ChartContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 400,
  height: 400,
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  // Chrome-specific optimizations
  contain: 'layout',
  willChange: 'auto',
  [theme.breakpoints.down('sm')]: {
    minHeight: 300,
    height: 300,
  },
}));

// Simplified interfaces
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
    confidence_score?: number;
  }>;
  total_revenue?: number;
  total_orders?: number;
  period_days?: number;
}

interface PredictionViewContainerProps {
  data: UnifiedAnalyticsData | null;
  loading?: boolean;
  error?: string | null;
  height?: number;
  onPredictionDaysChange?: (days: number) => void;
  predictionDays?: number;
  className?: string;
}

type PredictionView = 'revenue' | 'orders' | 'conversion';

const PredictionViewContainer = memo(({ 
  data, 
  loading, 
  error, 
  height = 500,
  onPredictionDaysChange,
  predictionDays = 30,
  className = '' 
}: PredictionViewContainerProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const { shop } = useAuth();
  
  // Local state
  const [activeView, setActiveView] = useState<PredictionView>('revenue');
  const [showPredictions, setShowPredictions] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  
  // Refs
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Better responsive height calculations
  const responsiveHeight = useMemo(() => {
    if (isMobile) return Math.max(500, height); // Increased from 400
    if (isTablet) return Math.max(600, height); // Increased from 500
    return Math.max(700, height); // Increased from 600
  }, [height, isMobile, isTablet]);

  // Calculate chart height with better margins
  const chartHeight = useMemo(() => {
    // Account for header, controls, stats, and margins
    const headerHeight = 120; // Header and controls
    const statsHeight = isMobile ? 100 : 120; // Stats section
    const buttonsHeight = 60; // View toggle buttons
    const margins = 40; // Top and bottom margins
    
    const totalNonChartHeight = headerHeight + statsHeight + buttonsHeight + margins;
    const calculatedHeight = responsiveHeight - totalNonChartHeight;
    
    // Ensure minimum chart height
    return Math.max(350, calculatedHeight); // Increased from 300
  }, [responsiveHeight, isMobile]);

  // Chrome-safe data validation
  const validateNumber = useCallback((value: any, defaultValue: number = 0): number => {
    if (typeof value !== 'number') return defaultValue;
    if (isNaN(value) || !isFinite(value)) return defaultValue;
    return Math.max(0, Math.min(value, 1e9)); // Cap for Chrome SVG
  }, []);

  // Simplified data transformation
  const transformedData = useMemo(() => {
    if (!data || !Array.isArray(data.historical)) {
      return { revenue: [], orders: [], conversion: [] };
    }

    try {
      const historical = data.historical.map(item => ({
        date: item.date,
        revenue: validateNumber(item.revenue),
        orders_count: validateNumber(item.orders_count),
        conversion_rate: validateNumber(item.conversion_rate),
        isPrediction: false,
      }));

      const predictions = showPredictions && Array.isArray(data.predictions) 
        ? data.predictions.slice(0, predictionDays).map(item => ({
            date: item.date,
            revenue: validateNumber(item.revenue),
            orders_count: validateNumber(item.orders_count),
            conversion_rate: validateNumber(item.conversion_rate),
            isPrediction: true,
            confidence_score: validateNumber(item.confidence_score, 0.75),
          }))
        : [];

      const allData = [...historical, ...predictions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return {
        revenue: allData.map(item => ({
          date: item.date,
          revenue: item.revenue,
          isPrediction: item.isPrediction,
          confidence_score: item.confidence_score || 0,
        })),
        orders: allData.map(item => ({
          date: item.date,
          orders_count: item.orders_count,
          isPrediction: item.isPrediction,
          confidence_score: item.confidence_score || 0,
        })),
        conversion: allData.map(item => ({
          date: item.date,
          conversion_rate: item.conversion_rate,
          isPrediction: item.isPrediction,
          confidence_score: item.confidence_score || 0,
        })),
      };
    } catch (error) {
      console.error('Error transforming data:', error);
      return { revenue: [], orders: [], conversion: [] };
    }
  }, [data, showPredictions, predictionDays, validateNumber]);

  // Event handlers
  const handleViewChange = useCallback((
    event: React.MouseEvent<HTMLElement>,
    newView: PredictionView,
  ) => {
    if (newView !== null) {
      setActiveView(newView);
    }
  }, []);

  const handlePredictionToggle = useCallback((enabled: boolean) => {
    setShowPredictions(enabled);
  }, []);

  const handleShareChart = useCallback(() => {
    setShareModalOpen(true);
  }, []);

  // Chrome-safe rendering
  const renderChart = () => {
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
          <Button 
            variant="outlined" 
            startIcon={<Refresh />}
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </Box>
      );
    }

    const hasData = transformedData[activeView] && transformedData[activeView].length > 0;
    
    if (!hasData) {
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2,
        }}>
          <Analytics sx={{ fontSize: 48, color: 'text.secondary' }} />
          <Typography variant="h6" color="text.secondary">
            No data available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Analytics data will appear here once available
          </Typography>
        </Box>
      );
    }

    const commonProps = {
      loading: false,
      error: null,
      height: Math.max(300, chartHeight), // Ensure minimum chart height
    };

    // Chrome-safe chart rendering with error boundaries
    try {
      switch (activeView) {
        case 'revenue':
          return (
            <RevenuePredictionChart
              data={transformedData.revenue}
              showPredictions={showPredictions}
              {...commonProps}
            />
          );
        case 'orders':
          return (
            <OrderPredictionChart
              data={transformedData.orders}
              showPredictions={showPredictions}
              {...commonProps}
            />
          );
        case 'conversion':
          return (
            <ConversionPredictionChart
              data={transformedData.conversion}
              showPredictions={showPredictions}
              {...commonProps}
            />
          );
        default:
          return null;
      }
    } catch (chartError) {
      console.error('Chart rendering error:', chartError);
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
            Chart rendering error
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </Box>
      );
    }
  };

  return (
    <StyledCard sx={{ 
      minHeight: responsiveHeight,
      height: responsiveHeight,
      display: 'flex',
      flexDirection: 'column',
      className,
    }}>
      <CardContent sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        p: 2,
      }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <CardTitle>
              <Analytics color="primary" />
              Advanced Analytics
              <Chip
                icon={<AutoAwesome />}
                label="AI Forecast"
                color="secondary"
                size="small"
                sx={{ fontWeight: 600, ml: 1 }}
              />
            </CardTitle>
            
            <Tooltip title="Share Chart">
              <IconButton
                onClick={handleShareChart}
                size="small"
                sx={{
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { backgroundColor: 'primary.dark' },
                }}
              >
                <ShareIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          
          {/* Controls */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            mb: 2,
          }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showPredictions}
                  onChange={(e) => handlePredictionToggle(e.target.checked)}
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
            
            {showPredictions && onPredictionDaysChange && (
              <ToggleButtonGroup
                value={predictionDays}
                exclusive
                onChange={(_, newDays) => newDays && onPredictionDaysChange(newDays)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 1.5,
                    py: 0.5,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 1.5,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                    },
                  },
                }}
              >
                <ToggleButton value={7}>7d</ToggleButton>
                <ToggleButton value={30}>30d</ToggleButton>
                <ToggleButton value={60}>60d</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>

          {/* Enhanced Stats Display with Confidence Scores */}
          {data && data.historical && data.historical.length > 0 && (
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: isMobile ? 1 : 2, 
              mb: 3,
              p: 2,
              backgroundColor: 'background.default',
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}>
              {/* Current Metric */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                p: isMobile ? 1 : 1.5,
                borderRadius: 1.5,
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                minWidth: isMobile ? 80 : 120,
                flex: 1,
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                  Current {activeView === 'revenue' ? 'Revenue' : activeView === 'orders' ? 'Orders' : 'Conversion'}
                </Typography>
                <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ fontSize: isMobile ? '0.9rem' : '1.25rem' }}>
                                      {(() => {
                      const recentData = data.historical.slice(-7); // Last 7 days
                      switch (activeView) {
                        case 'revenue': {
                          const totalRevenue = recentData.reduce((sum, d) => sum + (d.revenue || 0), 0);
                          return `$${totalRevenue.toLocaleString()}`;
                        }
                        case 'orders': {
                          const totalOrders = recentData.reduce((sum, d) => sum + (d.orders_count || 0), 0);
                          return totalOrders.toLocaleString();
                        }
                        case 'conversion': {
                          const avgConversion = recentData.length > 0 ? 
                            recentData.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / recentData.length : 0;
                          return `${avgConversion.toFixed(1)}%`;
                        }
                        default:
                          return 'N/A';
                      }
                    })()}
                </Typography>
              </Box>

              {/* Forecast Metric with Confidence */}
              {showPredictions && data.predictions && data.predictions.length > 0 && (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  p: isMobile ? 1 : 1.5,
                  borderRadius: 1.5,
                  backgroundColor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'secondary.main',
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
                    background: 'secondary.main',
                    borderRadius: '1.5px 1.5px 0 0',
                  },
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <AutoAwesome sx={{ fontSize: isMobile ? 10 : 12, color: 'secondary.main' }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                      Forecast ({predictionDays}d)
                    </Typography>
                  </Box>
                  <Typography variant="h6" fontWeight={700} color="secondary.main" sx={{ fontSize: isMobile ? '0.9rem' : '1.25rem' }}>
                    {(() => {
                      const predictionData = data.predictions.slice(0, predictionDays);
                      switch (activeView) {
                        case 'revenue': {
                          const totalRevenue = predictionData.reduce((sum, d) => sum + (d.revenue || 0), 0);
                          return `$${totalRevenue.toLocaleString()}`;
                        }
                        case 'orders': {
                          const totalOrders = predictionData.reduce((sum, d) => sum + (d.orders_count || 0), 0);
                          return totalOrders.toLocaleString();
                        }
                        case 'conversion': {
                          const avgConversion = predictionData.length > 0 ? 
                            predictionData.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / predictionData.length : 0;
                          return `${avgConversion.toFixed(1)}%`;
                        }
                        default:
                          return 'N/A';
                      }
                    })()}
                  </Typography>
                  {/* Confidence Score Display */}
                  {data.predictions.length > 0 && data.predictions[0].confidence_score && (
                    <Typography variant="caption" color="secondary.main" sx={{ fontSize: '0.6rem', mt: 0.5 }}>
                      {(data.predictions[0].confidence_score * 100).toFixed(0)}% confidence
                    </Typography>
                  )}
                </Box>
              )}

              {/* Active Metric Info */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                p: isMobile ? 1 : 1.5,
                borderRadius: 1.5,
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                minWidth: isMobile ? 80 : 120,
                flex: 1,
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                  Total Historical
                </Typography>
                <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ fontSize: isMobile ? '0.9rem' : '1.25rem' }}>
                  {(() => {
                    switch (activeView) {
                      case 'revenue': {
                        return `$${(data.total_revenue || 0).toLocaleString()}`;
                      }
                      case 'orders': {
                        return (data.total_orders || 0).toLocaleString();
                      }
                      case 'conversion': {
                        const avgConversion = data.historical.length > 0 ? 
                          data.historical.reduce((sum, d) => sum + (d.conversion_rate || 0), 0) / data.historical.length : 0;
                        return `${avgConversion.toFixed(1)}%`;
                      }
                      default:
                        return 'N/A';
                    }
                  })()}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* View Toggle with Chart Theme Colors - Fixed responsive layout */}
        <ToggleButtonGroup
          value={activeView}
          exclusive
          onChange={handleViewChange}
          size="small"
          sx={{
            mb: 2,
            display: 'flex',
            flexWrap: isMobile ? 'nowrap' : 'nowrap', // Prevent wrapping
            gap: isMobile ? 0.5 : 1,
            width: '100%',
            justifyContent: 'center',
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 600,
              px: isMobile ? 1 : 2,
              py: isMobile ? 0.75 : 1,
              border: '1px solid',
              borderRadius: 1.5,
              fontSize: isMobile ? '0.75rem' : '0.875rem',
              minWidth: isMobile ? 'auto' : 100,
              flex: isMobile ? 1 : 'initial', // Equal width on mobile
              '&[value="revenue"]': {
                borderColor: UNIFIED_COLOR_SCHEME.historical.revenue,
                color: UNIFIED_COLOR_SCHEME.historical.revenue,
                '&.Mui-selected': {
                  backgroundColor: UNIFIED_COLOR_SCHEME.historical.revenue,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: UNIFIED_COLOR_SCHEME.historical.revenue,
                    opacity: 0.9,
                  },
                },
                '&:hover': {
                  backgroundColor: `${UNIFIED_COLOR_SCHEME.historical.revenue}10`,
                },
              },
              '&[value="orders"]': {
                borderColor: UNIFIED_COLOR_SCHEME.historical.orders,
                color: UNIFIED_COLOR_SCHEME.historical.orders,
                '&.Mui-selected': {
                  backgroundColor: UNIFIED_COLOR_SCHEME.historical.orders,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: UNIFIED_COLOR_SCHEME.historical.orders,
                    opacity: 0.9,
                  },
                },
                '&:hover': {
                  backgroundColor: `${UNIFIED_COLOR_SCHEME.historical.orders}10`,
                },
              },
              '&[value="conversion"]': {
                borderColor: UNIFIED_COLOR_SCHEME.historical.conversion,
                color: UNIFIED_COLOR_SCHEME.historical.conversion,
                '&.Mui-selected': {
                  backgroundColor: UNIFIED_COLOR_SCHEME.historical.conversion,
                  color: 'white',
                  '&:hover': {
                    backgroundColor: UNIFIED_COLOR_SCHEME.historical.conversion,
                    opacity: 0.9,
                  },
                },
                '&:hover': {
                  backgroundColor: `${UNIFIED_COLOR_SCHEME.historical.conversion}10`,
                },
              },
            },
          }}
        >
          <ToggleButton value="revenue">
            <TrendingUp fontSize="small" sx={{ mr: isMobile ? 0.25 : 0.5 }} />
            {!isMobile && 'Revenue'}
            {isMobile && 'Rev'}
          </ToggleButton>
          <ToggleButton value="orders">
            <ShoppingCart fontSize="small" sx={{ mr: isMobile ? 0.25 : 0.5 }} />
            Orders
          </ToggleButton>
          <ToggleButton value="conversion">
            <Percent fontSize="small" sx={{ mr: isMobile ? 0.25 : 0.5 }} />
            {!isMobile && 'Conversion'}
            {isMobile && 'Conv'}
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Chart */}
        <ChartContainer ref={chartRef}>
          {renderChart()}
        </ChartContainer>
      </CardContent>
      
      {/* Share Modal */}
      <SimpleShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        chartRef={chartRef}
        chartData={data}
        chartType={activeView}
        chartTitle={`${activeView.charAt(0).toUpperCase() + activeView.slice(1)} Analytics`}
        shopName={shop || undefined}
        metrics={{
          revenue: data?.total_revenue,
          orders: data?.total_orders,
          timeRange: `${predictionDays}d`,
        }}
      />
    </StyledCard>
  );
});

export default PredictionViewContainer; 