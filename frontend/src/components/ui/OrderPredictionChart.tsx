import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
  Paper,
  Badge,
} from '@mui/material';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart,
  AutoAwesome,
  ShowChart,
  Timeline,
  BarChart as BarChartIcon,
} from '@mui/icons-material';

interface OrderPredictionData {
  date: string;
  orders_count: number;
  isPrediction?: boolean;
  confidence_min?: number;
  confidence_max?: number;
  confidence_score?: number;
}

interface OrderPredictionChartProps {
  data: OrderPredictionData[];
  loading?: boolean;
  error?: string | null;
  height?: number;
}

type ChartType = 'line' | 'area' | 'bar';

const OrderPredictionChart: React.FC<OrderPredictionChartProps> = ({
  data,
  loading = false,
  error = null,
  height = 400,
}) => {
  const [chartType, setChartType] = useState<ChartType>('line');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const gradientId = useMemo(() => `orders-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  // Process and validate data
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map(item => ({
      date: item.date,
      orders_count: Math.max(0, Math.round(item.orders_count || 0)),
      isPrediction: Boolean(item.isPrediction),
      confidence_min: Math.round(item.confidence_min || 0),
      confidence_max: Math.round(item.confidence_max || 0),
      confidence_score: item.confidence_score || 0,
    })).filter(item => item.date && !isNaN(item.orders_count));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (processedData.length === 0) return null;
    
    const historicalData = processedData.filter(d => !d.isPrediction);
    const predictionData = processedData.filter(d => d.isPrediction);
    
    const currentOrders = historicalData.reduce((sum, d) => sum + d.orders_count, 0);
    const predictedOrders = predictionData.reduce((sum, d) => sum + d.orders_count, 0);
    
    const growthRate = historicalData.length > 0 ? 
      ((predictedOrders / predictionData.length) - (currentOrders / historicalData.length)) / 
      (currentOrders / historicalData.length) * 100 : 0;
    
    return {
      currentOrders,
      predictedOrders,
      growthRate,
      historicalDays: historicalData.length,
      predictionDays: predictionData.length,
      avgDailyOrders: historicalData.length > 0 ? (currentOrders / historicalData.length).toFixed(1) : 0,
    };
  }, [processedData]);

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPrediction = data.isPrediction;
      
      return (
        <Paper
          elevation={8}
          sx={{
            p: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            minWidth: 200,
            backdropFilter: 'blur(10px)',
          }}
        >
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {new Date(label).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
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
                  boxShadow: `0 0 8px ${entry.color}40`,
                }}
              />
              <Typography variant="body2" fontWeight={600}>
                {entry.name}: {entry.value?.toLocaleString()} orders
              </Typography>
            </Box>
          ))}
          
          {isPrediction && (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5, 
              mt: 1, 
              pt: 1, 
              borderTop: `1px solid ${theme.palette.divider}` 
            }}>
              <AutoAwesome sx={{ fontSize: 14, color: theme.palette.primary.main }} />
              <Typography variant="caption" color="primary" fontWeight={600}>
                AI Prediction
              </Typography>
              {data.confidence_score && (
                <Chip 
                  label={`${(data.confidence_score * 100).toFixed(0)}% confidence`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ ml: 1, height: 20, fontSize: '0.6875rem' }}
                />
              )}
            </Box>
          )}
        </Paper>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <Typography>Loading order predictions...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  const predictionStartDate = processedData.find(d => d.isPrediction)?.date;

  const chartTypeConfig = {
    line: { icon: <ShowChart />, label: 'Line', color: theme.palette.success.main },
    area: { icon: <Timeline />, label: 'Area', color: theme.palette.success.main },
    bar: { icon: <BarChartIcon />, label: 'Bar', color: theme.palette.success.main },
  };

  const renderChart = () => {
    const commonProps = {
      data: processedData,
      margin: { top: 10, right: 30, left: 20, bottom: 20 },
    };

    const commonElements = (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.3} />
            <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke={theme.palette.divider} 
          opacity={0.6}
        />
        
        <XAxis
          dataKey="date"
          tickFormatter={(value) => {
            try {
              return new Date(value).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              });
            } catch {
              return value;
            }
          }}
          stroke={theme.palette.text.secondary}
          tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
          axisLine={{ stroke: theme.palette.divider }}
        />
        
        <YAxis
          tickFormatter={formatNumber}
          stroke={theme.palette.text.secondary}
          tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
          axisLine={{ stroke: theme.palette.divider }}
          label={{
            value: 'Orders',
            angle: -90,
            position: 'insideLeft',
            style: { textAnchor: 'middle', fill: theme.palette.text.secondary }
          }}
        />
        
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        
        {predictionStartDate && (
          <ReferenceLine
            x={predictionStartDate}
            stroke={theme.palette.secondary.main}
            strokeDasharray="5,5"
            strokeWidth={2}
            label={{ 
              value: "AI Predictions →", 
              position: "top",
              style: { fill: theme.palette.secondary.main, fontWeight: 600 }
            }}
          />
        )}
      </>
    );

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {commonElements}
            <Line
              type="monotone"
              dataKey="orders_count"
              stroke={theme.palette.success.main}
              strokeWidth={3}
              name="Orders"
              connectNulls={false}
              isAnimationActive={false}
              dot={{
                fill: theme.palette.success.main,
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={{
                r: 6,
                fill: theme.palette.success.main,
                stroke: '#fff',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        );
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            <Area
              type="monotone"
              dataKey="orders_count"
              stroke={theme.palette.success.main}
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              name="Orders"
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        );
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonElements}
            <Bar
              dataKey="orders_count"
              fill={theme.palette.success.main}
              name="Orders"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
              isAnimationActive={false}
            />
          </BarChart>
        );
      
      default:
        return (
          <LineChart {...commonProps}>
            {commonElements}
            <Line
              type="monotone"
              dataKey="orders_count"
              stroke={theme.palette.success.main}
              strokeWidth={3}
              name="Orders"
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        );
    }
  };

  return (
    <Box sx={{ 
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      p: 2,
    }}>
      {/* Simplified Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h2" fontWeight={600} sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          <AutoAwesome color="secondary" fontSize="small" />
          Order Predictions
        </Typography>
        
        {/* Chart Type Toggle */}
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={(_, value) => value && setChartType(value)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              px: 1,
              py: 0.5,
              minWidth: 'auto',
              '&.Mui-selected': {
                backgroundColor: theme.palette.success.main,
                color: theme.palette.success.contrastText,
              },
            },
          }}
        >
          {Object.entries(chartTypeConfig).map(([type, config]) => (
            <ToggleButton key={type} value={type} aria-label={config.label}>
              {config.icon}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Stats Row */}
      {stats && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`${stats.growthRate >= 0 ? '+' : ''}${stats.growthRate.toFixed(1)}%`}
            color={stats.growthRate >= 0 ? 'success' : 'error'}
            size="small"
            icon={stats.growthRate >= 0 ? <TrendingUp /> : <TrendingDown />}
          />
          <Chip
            label={`${formatNumber(stats.predictedOrders)} predicted`}
            variant="outlined"
            color="success"
            size="small"
            icon={<ShoppingCart />}
          />
        </Box>
      )}

      {/* Chart */}
      <Box sx={{ flex: 1, minHeight: 0, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default OrderPredictionChart; 