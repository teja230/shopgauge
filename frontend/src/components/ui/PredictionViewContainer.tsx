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
import EnhancedShareExportModal from './EnhancedShareExportModal';
import { useAuth } from '../../context/AuthContext';
import { UNIFIED_COLOR_SCHEME, getMobileOptimizedHeight } from './ChartStyles';

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
  minHeight: 700, // Significantly increased from 600 to 700 for better visibility
  height: 'auto',
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  // Chrome-specific optimizations
  contain: 'layout',
  willChange: 'auto',
  overflow: 'visible', // Ensure no clipping
  [theme.breakpoints.down('sm')]: {
    minHeight: 550, // Significantly increased from 450 to 550 for mobile
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
  height = 800, // Increased default height
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
  
  // Responsive helpers - Increased container size to prevent bottom cutoff
  const responsiveHeight = useMemo(() => {
    // Increased heights to ensure charts are never cut off
    if (isMobile) return 800; // Keep mobile size reasonable
    if (isTablet) return 1000; // Increased for iPad to prevent cutoff
    return Math.max(1200, height); // Significantly increased for desktop to prevent cutoff
  }, [height, isMobile, isTablet]);

  // Chart height calculation - Generous sizing to prevent cutoff
  const chartHeight = useMemo(() => {
    // More generous chart heights to prevent any cutoff issues
    if (isMobile) return 480; // Keep mobile reasonable
    if (isTablet) return 650; // Increased for tablet
    return 750; // Significantly increased for desktop
  }, [isMobile, isTablet]);

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
      height: chartHeight, // Use the fixed chart height directly
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
      height: 'auto', // Allow container to grow as needed
      display: 'flex',
      flexDirection: 'column',
      className,
      // Enhanced styling for better appearance
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      borderRadius: 3,
      overflow: 'visible', // Allow content to be visible
    }}>
      <CardContent sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        p: isMobile ? 2 : 3, // Better padding for desktop
        background: 'transparent',
      }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 3,
            pb: 2,
            borderBottom: `2px solid ${theme.palette.divider}`,
            background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
            borderRadius: 2,
            p: 2,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}>
                <Analytics sx={{ color: 'white', fontSize: '1.5rem' }} />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700} sx={{ 
                  background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: isMobile ? '1.25rem' : '1.5rem',
                  mb: 0.5,
                }}>
                  Advanced Analytics
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<AutoAwesome />}
                    label="AI Forecast"
                    color="secondary"
                    size="small"
                    sx={{ 
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #9333ea 0%, #c084fc 100%)',
                      color: 'white',
                      '& .MuiChip-icon': { color: 'white' },
                      boxShadow: '0 2px 8px rgba(147, 51, 234, 0.3)',
                    }}
                  />
                </Box>
              </Box>
            </Box>
            
            <Tooltip title="Share Chart" arrow>
              <IconButton
                onClick={handleShareChart}
                size="large"
                sx={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)',
                  color: 'white',
                  width: 48,
                  height: 48,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  '&:hover': { 
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 16px rgba(37, 99, 235, 0.4)',
                  },
                  transition: 'all 0.3s ease-in-out',
                }}
              >
                <ShareIcon fontSize="medium" />
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
            p: 1.5,
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showPredictions}
                  onChange={(e) => handlePredictionToggle(e.target.checked)}
                  color="secondary"
                  sx={{
                    '& .MuiSwitch-track': {
                      backgroundColor: showPredictions ? 'secondary.light' : 'grey.300',
                    },
                    '& .MuiSwitch-thumb': {
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                    },
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesome sx={{ 
                    fontSize: 18, 
                    color: showPredictions ? 'secondary.main' : 'text.secondary',
                    transition: 'color 0.3s ease-in-out',
                  }} />
                  <Typography variant="body2" fontWeight={600} sx={{
                    color: showPredictions ? 'secondary.main' : 'text.secondary',
                    transition: 'color 0.3s ease-in-out',
                  }}>
                    {showPredictions ? 'AI Forecasts Active' : 'Historical Data Only'}
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
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.primary.main}`,
                  '& .MuiToggleButton-root': {
                    px: 2,
                    py: 1,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    border: 'none',
                    borderRadius: 1.5,
                    color: 'primary.main',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      transform: 'translateY(-1px)',
                    },
                    '&.Mui-selected': {
                      background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)',
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
                      },
                    },
                  },
                }}
              >
                <ToggleButton value={7}>7 Days</ToggleButton>
                <ToggleButton value={30}>30 Days</ToggleButton>
                <ToggleButton value={60}>60 Days</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>

          {/* Enhanced Stats Display with Confidence Scores */}
          {data && data.historical && data.historical.length > 0 && (
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: isMobile ? 1 : 1.5, // Reduced gap for tighter spacing
              mb: 1.5, // Further reduced from 2 to 1.5 for more chart space
              p: 1, // Further reduced from 1.5 to 1 for tighter spacing
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
                  Recent {activeView === 'revenue' ? 'Revenue' : activeView === 'orders' ? 'Orders' : 'Conversion'} (7d)
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

        {/* View Toggle with Rectangular Design (like stats section) */}
        <Box sx={{ 
          display: 'flex',
          justifyContent: 'center',
          mb: 1.5, // Reduced from 2 to 1.5 for more chart space
          p: 1,
          backgroundColor: 'background.default',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}>
          <ToggleButtonGroup
            value={activeView}
            exclusive
            onChange={handleViewChange}
            size="medium"
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: 1.5,
              border: `1px solid ${theme.palette.divider}`,
              overflow: 'hidden',
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 600,
                px: isMobile ? 2 : 3,
                py: isMobile ? 1 : 1.5,
                border: 'none',
                borderRadius: 0,
                fontSize: isMobile ? '0.875rem' : '1rem',
                minWidth: isMobile ? 90 : 120,
                minHeight: isMobile ? 40 : 44,
                transition: 'all 0.2s ease-in-out',
                position: 'relative',
                color: 'text.secondary',
                backgroundColor: 'transparent',
                
                '&:first-of-type': {
                  borderTopLeftRadius: 1.5,
                  borderBottomLeftRadius: 1.5,
                },
                
                '&:last-of-type': {
                  borderTopRightRadius: 1.5,
                  borderBottomRightRadius: 1.5,
                },
                
                '&:hover': {
                  backgroundColor: 'action.hover',
                  transform: 'none',
                },
                
                '&[value="revenue"]': {
                  '&.Mui-selected': {
                    backgroundColor: UNIFIED_COLOR_SCHEME.historical.revenue,
                    color: 'white',
                    boxShadow: `inset 0 0 0 2px ${UNIFIED_COLOR_SCHEME.historical.revenue}`,
                    '&:hover': {
                      backgroundColor: UNIFIED_COLOR_SCHEME.historical.revenue,
                      filter: 'brightness(1.1)',
                    },
                  },
                },
                
                '&[value="orders"]': {
                  '&.Mui-selected': {
                    backgroundColor: UNIFIED_COLOR_SCHEME.historical.orders,
                    color: 'white',
                    boxShadow: `inset 0 0 0 2px ${UNIFIED_COLOR_SCHEME.historical.orders}`,
                    '&:hover': {
                      backgroundColor: UNIFIED_COLOR_SCHEME.historical.orders,
                      filter: 'brightness(1.1)',
                    },
                  },
                },
                
                '&[value="conversion"]': {
                  '&.Mui-selected': {
                    backgroundColor: UNIFIED_COLOR_SCHEME.historical.conversion,
                    color: 'white',
                    boxShadow: `inset 0 0 0 2px ${UNIFIED_COLOR_SCHEME.historical.conversion}`,
                    '&:hover': {
                      backgroundColor: UNIFIED_COLOR_SCHEME.historical.conversion,
                      filter: 'brightness(1.1)',
                    },
                  },
                },
                
                '&:focus': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: '2px',
                },
              },
            }}
          >
            <ToggleButton value="revenue">
              <TrendingUp fontSize="small" sx={{ mr: 1 }} />
              {isMobile ? 'Revenue' : 'Revenue'}
            </ToggleButton>
            <ToggleButton value="orders">
              <ShoppingCart fontSize="small" sx={{ mr: 1 }} />
              {isMobile ? 'Orders' : 'Orders'}
            </ToggleButton>
            <ToggleButton value="conversion">
              <Percent fontSize="small" sx={{ mr: 1 }} />
              {isMobile ? 'Conversion' : 'Conversion'}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Chart - Allow natural sizing to prevent cutoff */}
        <Box 
          sx={{ 
            flex: 1, 
            position: 'relative',
            overflow: 'visible', // Allow chart to be fully visible
            height: chartHeight,
            minHeight: chartHeight,
            mt: 1,
            mb: 2, // Restore bottom margin for better spacing
            backgroundColor: 'background.paper', // Match container background
            borderRadius: 1,
            // Mobile-specific optimizations
            ...(isMobile && {
              width: '100%',
              maxWidth: '100%',
              overflowX: 'auto', // Enable horizontal scrolling on mobile
              overflowY: 'auto', // Enable vertical scrolling on mobile
            }),
          }}
        >
          <Box
            ref={chartRef}
            sx={{ 
              width: '100%',
              height: '100%',
              p: 1, // Add small padding for better appearance
              // Ensure chart has enough space to render properly
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'background.paper', // Consistent background
              // Mobile browser compatibility
              ...(isMobile && {
                touchAction: 'pan-y',
                overflowX: 'auto', // Enable horizontal scrolling inside inner box on mobile
                overflowY: 'auto', // Enable vertical scrolling inside inner box on mobile
              }),
            }}
          >
            {renderChart()}
          </Box>
        </Box>
      </CardContent>
      
      {/* Enhanced Share & Export Modal */}
      <EnhancedShareExportModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        chartRef={chartRef}
        chartTitle={`${activeView.charAt(0).toUpperCase() + activeView.slice(1)} Analytics`}
        chartType={activeView}
        shopName={shop || undefined}
        data={data}
        metrics={{
          revenue: data?.total_revenue,
          orders: data?.total_orders,
          timeRange: `${predictionDays}d`,
          forecastPeriod: `${predictionDays} days`,
          forecastRevenue: data?.predictions?.[0]?.revenue,
          forecastOrders: data?.predictions?.[0]?.orders_count,
          confidenceScore: data?.predictions?.[0]?.confidence_score,
        }}
      />
    </StyledCard>
  );
});

export default PredictionViewContainer; 