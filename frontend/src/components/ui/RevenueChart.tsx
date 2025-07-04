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
} from '@mui/icons-material';
import LoadingIndicator from './LoadingIndicator';
import type { RevenuePoint, TooltipProps, ChartPayload } from '../../types/charts';

type RevenueData = RevenuePoint;

interface RevenueChartProps {
  data: RevenueData[];
  loading?: boolean;
  error?: string | null;
  height?: number;
}

type ChartType = 'line' | 'area' | 'bar' | 'candlestick' | 'waterfall' | 'stacked' | 'composed';

const CustomTooltip: React.FC<TooltipProps<RevenuePoint>> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Paper
        elevation={8}
        sx={{
          p: 2,
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {new Date(label as string).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Typography>
        {(payload as ChartPayload<RevenuePoint>[]).map((entry, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: entry.color,
              }}
            />
            <Typography variant="body2" fontWeight={600}>
              {entry.name as string}: ${entry.value?.toLocaleString()}
            </Typography>
          </Box>
        ))}
      </Paper>
    );
  }
  return <div />;
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
  height = 400,
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');

  // Responsive helper
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
      const commonProps = {
        data: processedData,
        margin: { top: 20, right: 30, left: 20, bottom: 20 },
      };

      const commonXAxis = (
        <XAxis
          dataKey="created_at"
          tickFormatter={formatXAxisTick}
          stroke="rgba(0, 0, 0, 0.4)"
          tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(0, 0, 0, 0.1)' }}
          label={{
            value: 'Date',
            position: 'insideBottomRight',
            offset: -6,
            fill: 'rgba(0, 0, 0, 0.54)',
            fontSize: 12,
          }}
        />
      );

      const commonYAxis = (
        <YAxis
          tickFormatter={formatYAxisTick}
          stroke="rgba(0, 0, 0, 0.4)"
          tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(0, 0, 0, 0.1)' }}
          label={{
            value: 'Revenue (USD)',
            angle: -90,
            position: 'insideLeft',
            offset: -10,
            fill: 'rgba(0, 0, 0, 0.54)',
            fontSize: 12,
          }}
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
      console.error('Error rendering chart:', error);
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
      {/* Header with Dashboard Theme */}
      <Box sx={{ 
        mb: theme.spacing(2),
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: theme.spacing(2) 
        }}>
          <Typography 
            variant="h6" 
            component="h3" 
            sx={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: theme.palette.text.primary,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing(1),
            }}
          >
            <TrendingUp color="primary" />
            Revenue Chart
          </Typography>
          
          {/* Chart Type Toggle with Dashboard Theme */}
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_, newType) => newType && setChartType(newType)}
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
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              },
            }}
          >
            <ToggleButton value="line" aria-label="Line chart"> 
              <ShowChart fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'Line'}
            </ToggleButton>
            <ToggleButton value="area" aria-label="Area chart">
              <Timeline fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'Area'}
            </ToggleButton>
            <ToggleButton value="bar" aria-label="Bar chart">
              <BarChartIcon fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'Bar'}
            </ToggleButton>
            <ToggleButton value="candlestick" aria-label="Candlestick chart">
              <CandlestickChart fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'Candle'}
            </ToggleButton>
            <ToggleButton value="waterfall" aria-label="Waterfall chart">
              <WaterfallChart fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'Waterfall'}
            </ToggleButton>
            <ToggleButton value="stacked" aria-label="Stacked chart">
              <StackedLineChart fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'Stacked'}
            </ToggleButton>
            <ToggleButton value="composed" aria-label="Composed chart">
              <Analytics fontSize="small" sx={{ mr: isMobile ? 0 : 0.5 }} />
              {!isMobile && 'Composed'}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Stats Row */}
        <Box sx={{ 
          display: 'flex', 
          gap: theme.spacing(1), 
          flexWrap: 'wrap',
          alignItems: 'center',
          p: theme.spacing(1.5),
          backgroundColor: theme.palette.background.default,
          borderRadius: theme.shape.borderRadius,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Total:
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {formatYAxisTick(totalRevenue)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Average:
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {formatYAxisTick(averageRevenue)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Data Points:
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {sanitizedData.length}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Chart with proper margins */}
      <Box sx={{ 
        flex: 1,
        minHeight: height - 140, // Account for header height
      }}>
        {containerReady && (
          <ResponsiveContainer width="100%" height={height - 140}>
            {renderChart()}
          </ResponsiveContainer>
        )}
      </Box>
    </Box>
  );
};

export default RevenueChart; 