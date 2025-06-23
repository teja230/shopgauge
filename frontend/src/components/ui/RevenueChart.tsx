import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  Area,
  Bar,
} from 'recharts';
import {
  Box,
  ButtonGroup,
  Button,
  Paper,
  Typography,
  Chip,
} from '@mui/material';
import {
  TrendingUp,
  BarChart as BarChartIcon,
  ShowChart,
  Timeline,
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

type ChartType = 'line' | 'area' | 'bar';

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: payload[0].color,
            }}
          />
          <Typography variant="body2" fontWeight={600}>
            Revenue: ${payload[0].value?.toLocaleString()}
          </Typography>
        </Box>
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
    },
    area: {
      icon: <Timeline />,
      label: 'Area',
      color: '#2563eb',
    },
    bar: {
      icon: <BarChartIcon />,
      label: 'Bar',
      color: '#2563eb',
    },
  };

  // Debug data structure
  console.log('Revenue Chart Data:', data);
  if (data?.length > 0) {
    console.log('First item:', data[0]);
    console.log('total_price type:', typeof data[0].total_price);
  }

  const totalRevenue = data?.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0) || 0;
  const averageRevenue = data?.length && totalRevenue > 0 ? totalRevenue / data.length : 0;
  const maxRevenue = data?.length ? Math.max(...data.map(item => Number(item.total_price) || 0)) : 0;

  const renderChart = () => {
    const commonProps = {
      data,
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

  if (!data || data.length === 0) {
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
            label={`${data.length} ${data.length === 1 ? 'day' : 'days'}`}
            size="small"
            variant="outlined"
            color="primary"
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Chart Type Selector */}
          <ButtonGroup size="small" variant="outlined">
            {(Object.keys(chartTypeConfig) as ChartType[]).map((type) => (
              <Button
                key={type}
                onClick={() => setChartType(type)}
                variant={chartType === type ? 'contained' : 'outlined'}
                startIcon={chartTypeConfig[type].icon}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                {chartTypeConfig[type].label}
              </Button>
            ))}
          </ButtonGroup>
        </Box>
      </Box>

      {/* Revenue Summary Stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
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
      </Paper>
    </Box>
  );
}; 