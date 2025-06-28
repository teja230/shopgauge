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

interface RevenueData {
  created_at: string;
  total_price: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  loading?: boolean;
  error?: string | null;
  height?: number;
}

type ChartType = 'line' | 'area' | 'bar' | 'candlestick' | 'waterfall' | 'stacked' | 'composed';

const CustomTooltip = ({ active, payload, label }: any) => {
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
          {new Date(label).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Typography>
        {payload.map((entry: any, index: number) => (
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
              {entry.name}: ${entry.value?.toLocaleString()}
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
  data,
  loading = false,
  error = null,
  height = 400,
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');

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
      />
    );

    const commonYAxis = (
      <YAxis
        tickFormatter={formatYAxisTick}
        stroke="rgba(0, 0, 0, 0.4)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 12 }}
        axisLine={{ stroke: 'rgba(0, 0, 0, 0.1)' }}
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
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
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
              fill="url(#revenueGradient)"
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
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartTypeConfig.stacked.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartTypeConfig.stacked.color} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="changeGradient" x1="0" y1="0" x2="0" y2="1">
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
              fill="url(#revenueGradient)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="change"
              stroke="#10b981"
              strokeWidth={1}
              fill="url(#changeGradient)"
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
  };

  if (loading) {
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
        <div className="animate-pulse">
          <TrendingUp sx={{ fontSize: 48, color: 'rgba(0, 0, 0, 0.2)' }} />
        </div>
        <Typography variant="body2" color="text.secondary">
          Loading revenue data...
        </Typography>
      </Box>
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

  if (processedData.length === 0) {
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
        <Typography variant="h6" color="text.secondary">
          No revenue data available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Revenue data will appear here once you start making sales
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Chart Header with Controls */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" />
            Revenue Overview
          </Typography>
          <Chip
            label={`${sanitizedData.length} ${sanitizedData.length === 1 ? 'day' : 'days'}`}
            size="small"
            variant="outlined"
            color="primary"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Enhanced Chart Type Selector */}
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_, newType) => newType && setChartType(newType)}
            size="small"
            sx={{
              backgroundColor: 'white',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 2,
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              '& .MuiToggleButton-root': {
                px: 1.5,
                py: 1,
                fontSize: '0.75rem',
                textTransform: 'none',
                fontWeight: 500,
                border: 'none',
                borderRadius: 1.5,
                margin: 0.25,
                minWidth: 'auto',
                color: 'text.secondary',
                backgroundColor: 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  color: 'primary.main',
                },
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              },
            }}
          >
            {(Object.keys(chartTypeConfig) as ChartType[]).map((type) => (
              <ToggleButton
                key={type}
                value={type}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.25,
                  minWidth: 'auto',
                }}
                title={chartTypeConfig[type].description}
              >
                {React.cloneElement(chartTypeConfig[type].icon, { 
                  sx: { fontSize: '1rem' } 
                })}
                <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                {chartTypeConfig[type].label}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Enhanced Revenue Summary Stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
          gap: 2,
          mb: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2,
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.1)',
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Total Revenue
          </Typography>
          <Typography variant="h6" color="primary" fontWeight={600}>
            ${isNaN(totalRevenue) ? '0' : totalRevenue.toLocaleString()}
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2,
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.1)',
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Average Daily
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgb(16, 185, 129)' }} fontWeight={600}>
            ${isNaN(averageRevenue) ? '0' : Math.round(averageRevenue).toLocaleString()}
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2,
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.1)',
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Peak Day
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgb(245, 158, 11)' }} fontWeight={600}>
            ${isNaN(maxRevenue) ? '0' : maxRevenue.toLocaleString()}
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2,
            backgroundColor: 'rgba(139, 92, 246, 0.05)',
            border: '1px solid rgba(139, 92, 246, 0.1)',
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Range
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgb(139, 92, 246)' }} fontWeight={600}>
            ${isNaN(maxRevenue - minRevenue) ? '0' : (maxRevenue - minRevenue).toLocaleString()}
          </Typography>
        </Paper>
      </Box>

      {/* Chart Container */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          backgroundColor: '#fff',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
        
        {/* Data Activity Period Indicator */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 12,
            fontSize: '0.7rem',
            color: 'text.secondary',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            border: '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          📊 Data reflects the last 60 days of activity
        </Box>
      </Paper>
    </Box>
  );
}; 