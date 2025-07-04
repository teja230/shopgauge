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
  const predictionGradientId = useMemo(() => `prediction-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
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
                AI Forecast
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
        <Typography>Loading order forecasts...</Typography>
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

  // Common chart elements with enhanced visual separation
  const commonElements = useMemo(() => {
    const historicalData = processedData.filter(d => !d.isPrediction);
    const predictionData = processedData.filter(d => d.isPrediction);
    const separatorDate = predictionData.length > 0 ? predictionData[0]?.date : null;

    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.4} />
            <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id={predictionGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={theme.palette.warning.main} stopOpacity={0.3} />
            <stop offset="95%" stopColor={theme.palette.warning.main} stopOpacity={0.05} />
          </linearGradient>
          {/* Pattern for prediction area */}
          <pattern id="orderPredictionPattern" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="4" height="4" fill={theme.palette.warning.main} fillOpacity="0.1"/>
            <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke={theme.palette.warning.main} strokeWidth="0.5" strokeOpacity="0.3"/>
          </pattern>
        </defs>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="rgba(0, 0, 0, 0.1)" 
          strokeOpacity={0.5}
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
          stroke="rgba(0, 0, 0, 0.6)"
          tick={{ fontSize: 11, fill: 'rgba(0, 0, 0, 0.7)' }}
          axisLine={{ stroke: 'rgba(0, 0, 0, 0.2)' }}
        />
        <YAxis
          tickFormatter={(value) => Math.round(value).toString()}
          stroke="rgba(0, 0, 0, 0.6)"
          tick={{ fontSize: 11, fill: 'rgba(0, 0, 0, 0.7)' }}
          axisLine={{ stroke: 'rgba(0, 0, 0, 0.2)' }}
        />
        <Tooltip
          labelFormatter={(label) => {
            try {
              const date = new Date(label);
              return date.toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              });
            } catch {
              return label;
            }
          }}
          formatter={(value: number, name: string, props: any) => {
            const isPrediction = props.payload?.isPrediction;
            const prefix = isPrediction ? '🔮 Forecast: ' : '📊 Actual: ';
            return [`${prefix}${Math.round(value)} orders`, name];
          }}
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            fontSize: '12px'
          }}
        />
        <Legend 
          formatter={(value, entry) => (
            <span style={{ 
              color: entry.color, 
              fontSize: '12px',
              fontWeight: 500
            }}>
              {value}
            </span>
          )}
        />
        
        {/* Stylish separator line between historical and predicted data */}
        {separatorDate && (
          <ReferenceLine
            x={separatorDate}
            stroke={theme.palette.warning.main}
            strokeWidth={2}
            strokeDasharray="8 4"
            opacity={0.8}
          />
        )}
      </>
    );
  }, [processedData, theme, gradientId, predictionGradientId]);

  const renderChart = () => {
    const commonProps = {
      data: processedData,
      margin: { top: 10, right: 30, left: 20, bottom: 20 },
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {commonElements}
            <Line
              type="monotone"
              dataKey="orders_count"
              name="Orders"
              stroke={theme.palette.success.main}
              strokeWidth={3}
              dot={(props: any) => {
                const { payload } = props;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={payload?.isPrediction ? theme.palette.warning.main : theme.palette.success.main}
                    stroke={payload?.isPrediction ? theme.palette.warning.dark : theme.palette.success.dark}
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ 
                r: 6, 
                stroke: theme.palette.background.paper,
                strokeWidth: 2
              }}
              connectNulls={false}
              isAnimationActive={false}
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
              name="Orders"
              stroke={theme.palette.success.main}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              fillOpacity={0.6}
              dot={(props: any) => {
                const { payload } = props;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={3}
                    fill={payload?.isPrediction ? theme.palette.warning.main : theme.palette.success.main}
                    stroke={payload?.isPrediction ? theme.palette.warning.dark : theme.palette.success.dark}
                    strokeWidth={2}
                  />
                );
              }}
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
              name="Orders"
              fill={theme.palette.success.main}
              opacity={0.8}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const fill = payload?.isPrediction ? theme.palette.warning.main : theme.palette.success.main;
                const opacity = payload?.isPrediction ? 0.6 : 0.8;
                return (
                  <rect
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    height={props.height}
                    fill={fill}
                    opacity={opacity}
                    rx={2}
                    ry={2}
                  />
                );
              }}
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
    }}>
      {/* Header with Chart Type Toggle */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: theme.spacing(2),
        flexWrap: 'wrap',
        gap: 1,
      }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: theme.palette.text.primary,
        }}>
          <AutoAwesome color="secondary" fontSize="small" />
          Order Forecast
        </Typography>
        
        {/* Chart Type Toggle */}
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={(_, value) => value && setChartType(value)}
          size="small"
          sx={{
            backgroundColor: theme.palette.background.default,
            borderRadius: theme.shape.borderRadius,
            '& .MuiToggleButton-root': {
              px: theme.spacing(1),
              py: theme.spacing(0.5),
              minWidth: 'auto',
              border: 'none',
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
        <Box sx={{ 
          display: 'flex', 
          gap: theme.spacing(1), 
          mb: theme.spacing(2), 
          flexWrap: 'wrap' 
        }}>
          <Chip
            label={`${stats.growthRate >= 0 ? '+' : ''}${stats.growthRate.toFixed(1)}%`}
            color={stats.growthRate >= 0 ? 'success' : 'error'}
            size="small"
            icon={stats.growthRate >= 0 ? <TrendingUp /> : <TrendingDown />}
            sx={{ fontWeight: 600 }}
          />
          <Chip
            label={`${formatNumber(stats.predictedOrders)} orders forecast`}
            variant="outlined"
            color="success"
            size="small"
            icon={<ShoppingCart />}
            sx={{ fontWeight: 600 }}
          />
        </Box>
      )}

      {/* Chart with proper margins */}
      <Box sx={{ 
        flex: 1, 
        minHeight: 300,
        height: height || 400,
        width: '100%',
        position: 'relative',
        '& .recharts-wrapper': {
          width: '100% !important',
          height: '100% !important',
        },
        '& .recharts-surface': {
          overflow: 'visible',
        },
        '& .recharts-cartesian-grid-horizontal line': {
          stroke: theme.palette.divider,
          strokeOpacity: 0.3,
        },
        '& .recharts-cartesian-grid-vertical line': {
          stroke: theme.palette.divider,
          strokeOpacity: 0.3,
        },
      }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default OrderPredictionChart; 