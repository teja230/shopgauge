import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  Area,
  Bar,
  ReferenceLine,
} from 'recharts';
import {
  Box,
  Paper,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
  Tooltip as MuiTooltip,
  IconButton,
} from '@mui/material';
import {
  TrendingUp,
  BarChart as BarChartIcon,
  ShowChart,
  Timeline,
  CandlestickChart,
  WaterfallChart,
  StackedLineChart,
  Analytics,
  Share as ShareIcon,
} from '@mui/icons-material';
import LoadingIndicator from './LoadingIndicator';
import EnhancedShareExportModal from './EnhancedShareExportModal';
import type { RevenuePoint, TooltipProps, ChartPayload } from '../../types/charts';
import { debugLog } from './DebugPanel';
import { useAuth } from '../../context/AuthContext';

type RevenueData = RevenuePoint;

interface RevenueChartProps {
  data: RevenueData[];
  loading?: boolean;
  error?: string | null;
  height?: number;
}

type ChartType = 'line' | 'area' | 'bar' | 'candlestick' | 'waterfall' | 'stacked' | 'composed';

// Enhanced tooltip for classic chart
const EnhancedClassicTooltip: React.FC<TooltipProps<RevenuePoint>> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  const value = data.value as number;

  return (
    <Paper
      elevation={8}
      sx={{
        p: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: 2,
        minWidth: 180,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {new Date(label as string).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Typography>
        <Chip
          label="Revenue"
          size="small"
          sx={{
            height: 16,
            fontSize: '0.6rem',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            color: '#2563eb',
            border: '1px solid rgba(37, 99, 235, 0.2)',
          }}
        />
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: data.color,
            animation: 'pulse 2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.7 },
            },
          }}
        />
        <Typography variant="body2" fontWeight={600}>
          📊 Revenue: ${value.toLocaleString()}
        </Typography>
      </Box>
    </Paper>
  );
};

// Performance indicator component
const PerformanceIndicator: React.FC<{ current: number; previous: number }> = ({ current, previous }) => {
  const change = current - previous;
  const changePercent = previous > 0 ? (change / previous) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          color: isPositive ? '#10b981' : '#ef4444',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        {isPositive ? '↗️' : '↘️'}
        <Typography variant="caption" fontWeight={600} sx={{ ml: 0.5 }}>
          {Math.abs(changePercent).toFixed(1)}%
        </Typography>
      </Box>
    </Box>
  );
};

// Enhanced chart insights for classic view
const ClassicInsights: React.FC<{ data: RevenueData[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const totalRevenue = data.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
  const averageRevenue = totalRevenue / data.length;
  const maxRevenue = Math.max(...data.map(item => Number(item.total_price) || 0));
  const latestRevenue = Number(data[data.length - 1]?.total_price) || 0;
  const previousRevenue = Number(data[data.length - 2]?.total_price) || 0;

  const insights = [
    {
      label: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      icon: '💰',
    },
    {
      label: 'Average Daily',
      value: `$${averageRevenue.toLocaleString()}`,
      icon: '📊',
    },
    {
      label: 'Peak Day',
      value: `$${maxRevenue.toLocaleString()}`,
      icon: '🏆',
    },
    {
      label: 'Latest',
      value: `$${latestRevenue.toLocaleString()}`,
      icon: '📈',
      change: { current: latestRevenue, previous: previousRevenue },
    },
  ];

  return (
    <Box sx={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: 2, 
      justifyContent: 'center',
      p: 2,
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
      borderRadius: 2,
      mb: 2,
    }}>
      {insights.map((insight, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            backgroundColor: 'white',
            borderRadius: 1,
            border: '1px solid rgba(0, 0, 0, 0.1)',
            minWidth: 120,
            transition: 'transform 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>{insight.icon}</span>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {insight.label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" fontWeight={600}>
                {insight.value}
              </Typography>
              {insight.change && (
                <PerformanceIndicator 
                  current={insight.change.current} 
                  previous={insight.change.previous} 
                />
              )}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

const CustomTooltip: React.FC<TooltipProps<RevenuePoint>> = ({ active, payload, label }) => {
  return <EnhancedClassicTooltip active={active} payload={payload} label={label} />;
};

const formatXAxisTick = (tickItem: string) => {
  const date = new Date(tickItem);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatYAxisTick = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value}`;
};

export const RevenueChart: React.FC<RevenueChartProps> = ({
  data = [],
  loading = false,
  error = null,
  height = 650,
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const { shop } = useAuth();

  // Responsive helper
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  // Mobile-optimized dimensions - SIGNIFICANTLY INCREASED for better visibility
  const mobileHeight = Math.min(height * 0.95, 480); // Increased cap from 450 to 480px, 95% scaling
  const responsiveHeight = isMobile ? mobileHeight : height;

  const chartTypeConfig = {
    line: {
      icon: <ShowChart />,
      label: 'Line',
      color: '#2563eb',
      description: 'Simple trend line',
    },
    area: {
      icon: <Timeline />,
      label: 'Area',
      color: '#2563eb',
      description: 'Filled trend area',
    },
    bar: {
      icon: <BarChartIcon />,
      label: 'Bar',
      color: '#2563eb',
      description: 'Daily revenue bars',
    },
    candlestick: {
      icon: <CandlestickChart />,
      label: 'Candlestick',
      color: '#10b981',
      description: 'High/low patterns',
    },
    waterfall: {
      icon: <WaterfallChart />,
      label: 'Waterfall',
      color: '#f59e0b',
      description: 'Cumulative growth',
    },
    stacked: {
      icon: <StackedLineChart />,
      label: 'Stacked',
      color: '#8b5cf6',
      description: 'Multi-series view',
    },
    composed: {
      icon: <Analytics />,
      label: 'Composed',
      color: '#ef4444',
      description: 'Combined metrics',
    },
  };

  const gradientIdPrefix = React.useMemo(() => `rev-${Math.random().toString(36).substring(2,8)}`, []);

  // Layout-aware container hooks declared early to satisfy rules-of-hooks
  const [containerReady, setContainerReady] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    if (containerRef.current.offsetWidth > 0) {
      setContainerReady(true);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerReady(true);
          ro.disconnect();
          break;
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Validate and sanitize input data to prevent runtime errors
  const sanitizedData = React.useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter(item => {
      // Ensure dates are valid and total_price is a finite number
      const dateValid = item && typeof item.created_at === 'string' && !isNaN(Date.parse(item.created_at));
      const priceValid = item && (typeof item.total_price === 'number' || !isNaN(Number(item.total_price)));
      return dateValid && priceValid;
    }).map(item => ({
      ...item,
      total_price: Number(item.total_price) || 0,
    }));
  }, [data]);

  // Replace all subsequent uses of `data` with `sanitizedData`
  const totalRevenue = sanitizedData.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
  const averageRevenue = sanitizedData.length && totalRevenue > 0 ? totalRevenue / sanitizedData.length : 0;
  const maxRevenue = sanitizedData.length ? Math.max(...sanitizedData.map(item => Number(item.total_price) || 0)) : 0;
  const minRevenue = sanitizedData.length ? Math.min(...sanitizedData.map(item => Number(item.total_price) || 0)) : 0;

  const handleShareChart = () => {
    setShareModalOpen(true);
  };

  const processedData = React.useMemo(() => {
    if (!sanitizedData || sanitizedData.length === 0) return [];

    return sanitizedData.map((item, index) => {
      const revenue = Number(item.total_price) || 0;
      const prevRevenue = index > 0 ? Number(sanitizedData[index - 1].total_price) || 0 : 0;
      const change = revenue - prevRevenue;
      const cumulative = index === 0 ? revenue : sanitizedData.slice(0, index + 1).reduce((sum, d) => sum + (Number(d.total_price) || 0), 0);
      
      return {
        ...item,
        total_price: revenue,
        change,
        cumulative,
        high: revenue,
        low: revenue,
        open: prevRevenue,
        close: revenue,
        positive: change >= 0,
        negative: change < 0,
      };
    });
  }, [sanitizedData]);

  const renderChart = () => {
    try {
      // Adjusted bottom margins to prevent label cutoff
      const mobileMargins = { top: 15, right: 15, left: 15, bottom: 35 }; // Keep mobile margin as is
      const desktopMargins = { top: 25, right: 40, left: 40, bottom: 80 }; // Increased from 45 to 80 to fix bottom label cutoff
      
      const commonProps = {
        data: processedData,
        margin: isMobile ? mobileMargins : desktopMargins,
      };

      const commonXAxis = (
        <XAxis
          dataKey="created_at"
          tickFormatter={formatXAxisTick}
          stroke="rgba(0, 0, 0, 0.4)"
          tick={{ 
            fill: 'rgba(0, 0, 0, 0.6)', 
            fontSize: isMobile ? 10 : 12,
            textAnchor: isMobile ? 'end' : 'middle'
          }}
          axisLine={{ stroke: 'rgba(0, 0, 0, 0.1)' }}
          interval={isMobile ? 'preserveStartEnd' : 'preserveStart'}
          angle={isMobile ? -45 : -30}
          height={isMobile ? 40 : 45} // Reduced from 50/60 to 40/45
          label={{
            value: 'Date',
            position: 'bottom',
            offset: -5, // Reduced from 10 to -5 to bring label closer
            fill: 'rgba(0, 0, 0, 0.54)',
            fontSize: 12,
          }}
        />
      );

      const commonYAxis = (
        <YAxis
          tickFormatter={formatYAxisTick}
          stroke="rgba(0, 0, 0, 0.4)"
          tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 12 }}
          axisLine={{ stroke: 'rgba(0, 0, 0, 0.1)' }}
          width={isMobile ? 50 : 60}
          label={!isMobile ? {
            value: 'Revenue (USD)',
            angle: -90,
            position: 'left',
            offset: 10,
            fill: 'rgba(0, 0, 0, 0.54)',
            fontSize: 12,
          } : undefined}
        />
      );

      const commonGrid = (
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(0, 0, 0, 0.05)"
          horizontal={true}
          vertical={false}
        />
      );

      const commonTooltip = <Tooltip content={<CustomTooltip />} />;

      switch (chartType) {
        case 'line':
          return (
            <LineChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxis}
              {commonTooltip}
              <Line
                type="monotone"
                dataKey="total_price"
                stroke={chartTypeConfig.line.color}
                strokeWidth={3}
                dot={{
                  fill: chartTypeConfig.line.color,
                  strokeWidth: 2,
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  fill: chartTypeConfig.line.color,
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          );

        case 'area':
          return (
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={`${gradientIdPrefix}-revenueGradient`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartTypeConfig.area.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartTypeConfig.area.color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              {commonGrid}
              {commonXAxis}
              {commonYAxis}
              {commonTooltip}
              <Area
                type="monotone"
                dataKey="total_price"
                stroke={chartTypeConfig.area.color}
                strokeWidth={3}
                fill={`url(#${gradientIdPrefix}-revenueGradient)`}
                dot={{
                  fill: chartTypeConfig.area.color,
                  strokeWidth: 2,
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  fill: chartTypeConfig.area.color,
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          );

        case 'bar':
          return (
            <BarChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxis}
              {commonTooltip}
              <Bar
                dataKey="total_price"
                fill={chartTypeConfig.bar.color}
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
            </BarChart>
          );

        case 'candlestick':
          return (
            <ComposedChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxis}
              {commonTooltip}
              <Bar
                dataKey="total_price"
                fill="#10b981"
                radius={[2, 2, 0, 0]}
                opacity={0.8}
              />
              <Line
                type="monotone"
                dataKey="total_price"
                stroke="#6b7280"
                strokeWidth={1}
                dot={false}
              />
            </ComposedChart>
          );

        case 'waterfall':
          return (
            <ComposedChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxis}
              {commonTooltip}
              <Bar
                dataKey="change"
                fill="#10b981"
                radius={[2, 2, 0, 0]}
                opacity={0.8}
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{
                  fill: '#f59e0b',
                  strokeWidth: 2,
                  r: 3,
                }}
              />
            </ComposedChart>
          );

        case 'stacked':
          return (
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={`${gradientIdPrefix}-stackedRevenueGradient`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartTypeConfig.stacked.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartTypeConfig.stacked.color} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={`${gradientIdPrefix}-changeGradient`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              {commonGrid}
              {commonXAxis}
              {commonYAxis}
              {commonTooltip}
              <Area
                type="monotone"
                dataKey="total_price"
                stroke={chartTypeConfig.stacked.color}
                strokeWidth={2}
                fill={`url(#${gradientIdPrefix}-stackedRevenueGradient)`}
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="change"
                stroke="#10b981"
                strokeWidth={1}
                fill={`url(#${gradientIdPrefix}-changeGradient)`}
                stackId="2"
              />
            </AreaChart>
          );

        case 'composed':
          return (
            <ComposedChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxis}
              {commonTooltip}
              <Bar
                dataKey="total_price"
                fill={chartTypeConfig.composed.color}
                radius={[2, 2, 0, 0]}
                opacity={0.6}
              />
              <Line
                type="monotone"
                dataKey="total_price"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{
                  fill: '#2563eb',
                  strokeWidth: 2,
                  r: 3,
                }}
              />
              <ReferenceLine y={averageRevenue} stroke="#6b7280" strokeDasharray="3 3" />
            </ComposedChart>
          );

        default:
          return <div />;
      }
    } catch (error) {
              debugLog.error('Error rendering chart:', error, 'RevenueChart');
      return <div />;
    }
  };

  if (loading) {
    return (
      <LoadingIndicator height={height} message="Loading revenue data…" />
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: 'rgba(255, 0, 0, 0.02)',
          borderRadius: 2,
          border: '1px solid rgba(255, 0, 0, 0.1)',
        }}
      >
        <Typography variant="h6" color="error">
          Failed to load revenue data
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      </Box>
    );
  }

  if (sanitizedData.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
          borderRadius: 2,
        }}
      >
        <TrendingUp sx={{ fontSize: 48, color: 'rgba(0, 0, 0, 0.2)' }} />
        <Typography variant="body2" color="text.secondary">
          No revenue data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      ref={containerRef} 
      sx={{ 
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Card Header with Title and Share Button */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: theme.spacing(isMobile ? 0.5 : 1.5), // Reduced for more chart space
        pb: theme.spacing(0.5), // Reduced for more chart space
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography 
          variant="h6" 
          component="h3" 
          sx={{
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing(1),
          }}
        >
          <TrendingUp color="primary" sx={{ fontSize: isMobile ? 18 : 20 }} />
          Revenue Chart
        </Typography>
        
        <MuiTooltip title="Share Chart">
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
        </MuiTooltip>
      </Box>

      {/* Enhanced Insights */}
      <ClassicInsights data={sanitizedData} />
      
      {/* Chart Type Toggle */}
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'center',
        mb: theme.spacing(isMobile ? 0.5 : 1.5), // Reduced for more chart space
      }}>
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={(_, newType) => newType && setChartType(newType)}
          size="small"
          sx={{
            backgroundColor: 'transparent',
            border: 'none',
            gap: 0.5,
            '& .MuiToggleButton-root': {
              border: '1px solid',
              borderColor: 'primary.main',
              borderRadius: 2,
              px: 1.5,
              py: 0.75,
              minWidth: 'auto',
              color: 'primary.main',
              backgroundColor: 'primary.50',
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: 'primary.100',
                borderColor: 'primary.main',
              },
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                borderColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              },
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              },
              transition: 'all 0.2s ease-in-out',
            },
          }}
        >
          {Object.entries(chartTypeConfig).map(([type, config]) => (
            <MuiTooltip key={type} title={config.label} arrow placement="top">
              <ToggleButton value={type} aria-label={`${config.label} chart`}>
                {React.cloneElement(config.icon, { 
                  fontSize: "small"
                })}
              </ToggleButton>
            </MuiTooltip>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Chart with proper margins */}
      <Box 
        ref={chartRef}
        sx={{ 
          flex: 1,
          minHeight: responsiveHeight - (isMobile ? 120 : 140), // Increased chart area, reduced deduction
          maxHeight: responsiveHeight - (isMobile ? 120 : 140),
          overflow: isMobile ? 'auto' : 'hidden',
          minWidth: isMobile ? '650px' : 'auto',
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.3)',
            },
          },
          ...(isMobile && {
            '& .recharts-cartesian-axis-tick-value': {
              fontSize: '10px !important',
            },
            '& .recharts-legend-wrapper': {
              fontSize: '11px !important',
            },
            '& .recharts-tooltip-wrapper': {
              fontSize: '12px !important',
            },
          }),
        }}
      >
        {containerReady && (
          <ResponsiveContainer width="100%" height={responsiveHeight - (isMobile ? 120 : 140)}>
            {renderChart()}
          </ResponsiveContainer>
        )}
        {isMobile && (
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              fontStyle: 'italic', 
              mt: 0.5, 
              display: 'block', 
              textAlign: 'center',
              fontSize: '0.7rem',
            }}
          >
            💡 Scroll horizontally to view full chart
          </Typography>
        )}
      </Box>

      {/* Enhanced Share & Export Modal */}
      <EnhancedShareExportModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        chartRef={chartRef}
        chartTitle="Revenue Chart"
        chartType="revenue"
        shopName={shop || undefined}
        data={sanitizedData}
        metrics={{
          revenue: totalRevenue,
          timeRange: `${sanitizedData.length}d`,
        }}
      />
    </Box>
  );
};

export default RevenueChart; 