import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
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
  Tooltip,
} from '@mui/material';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart,
  AutoAwesome,
  ShowChart,
  Timeline,
  BarChart as BarChartIcon,
  CandlestickChart,
  WaterfallChart,
  StackedLineChart,
  Analytics,
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
  showPredictions?: boolean;
}

type ChartType = 'line' | 'area' | 'bar' | 'candlestick' | 'waterfall' | 'stacked' | 'composed';

// Define consistent color scheme for historical vs forecast data
const COLOR_SCHEME = {
  historical: {
    orders: '#10b981',       // Green - success color for actual orders
  },
  forecast: {
    orders: '#ec4899',       // Pink - prediction color for forecasted orders
  }
};

const OrderPredictionChart: React.FC<OrderPredictionChartProps> = ({
  data,
  loading = false,
  error = null,
  height = 450,
  showPredictions = true,
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const gradientId = useMemo(() => `order-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  const predictionGradientId = useMemo(() => `order-prediction-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
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

  // Common chart elements with enhanced visual separation - moved before early returns 
  const commonElements = useMemo(() => {
    const historicalData = processedData.filter(d => !d.isPrediction);
    const predictionData = processedData.filter(d => d.isPrediction);
    const separatorDate = predictionData.length > 0 ? predictionData[0]?.date : null;

    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLOR_SCHEME.historical.orders} stopOpacity={0.4} />
            <stop offset="95%" stopColor={COLOR_SCHEME.historical.orders} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id={predictionGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLOR_SCHEME.forecast.orders} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLOR_SCHEME.forecast.orders} stopOpacity={0.05} />
          </linearGradient>
          {/* Pattern for prediction area */}
          <pattern id="orderPredictionPattern" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="4" height="4" fill={COLOR_SCHEME.forecast.orders} fillOpacity="0.1"/>
            <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke={COLOR_SCHEME.forecast.orders} strokeWidth="0.5" strokeOpacity="0.3"/>
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
        <RechartsTooltip
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
        
        {/* Stylish separator line between historical and predicted data - only show when predictions are enabled */}
        {showPredictions && separatorDate && (
          <ReferenceLine
            x={separatorDate}
            stroke="#ec4899"
            strokeWidth={2}
            strokeDasharray="8 4"
            opacity={0.8}
            label={{ value: "Forecasts", position: "top" }}
          />
        )}
      </>
    );
  }, [processedData, gradientId, predictionGradientId]);

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
    candlestick: { icon: <CandlestickChart />, label: 'Candlestick', color: '#10b981' },
    waterfall: { icon: <WaterfallChart />, label: 'Waterfall', color: '#f59e0b' },
    stacked: { icon: <StackedLineChart />, label: 'Stacked', color: '#8b5cf6' },
    composed: { icon: <Analytics />, label: 'Composed', color: '#ef4444' },
  };

  const renderChart = () => {
    // Use only historical data when showPredictions is false, otherwise use all data
    const chartData = showPredictions ? processedData : processedData.filter(d => !d.isPrediction);
    
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 20, bottom: 20 },
    };

    // Separate historical and forecast data for proper rendering
    const historicalData = processedData.filter(d => !d.isPrediction);
    const forecastData = processedData.filter(d => d.isPrediction);

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonElements}
            <Bar
              dataKey="orders_count"
              name="Orders"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                const fill = isPrediction ? COLOR_SCHEME.forecast.orders : COLOR_SCHEME.historical.orders;
                const opacity = isPrediction ? 0.7 : 0.9;
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
      
      case 'line':
        return (
          <LineChart {...commonProps}>
            {commonElements}
            {/* Historical data line */}
            <Line
              type="monotone"
              dataKey="orders_count"
              name="Orders (Historical)"
              stroke={COLOR_SCHEME.historical.orders}
              strokeWidth={3}
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                if (isPrediction) {
                  // Return invisible dot for predictions on historical line
                  return <circle cx={props.cx} cy={props.cy} r={0} fill="transparent" />;
                }
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={COLOR_SCHEME.historical.orders}
                    stroke={COLOR_SCHEME.historical.orders}
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
            {/* Forecast data line - only show if forecast data exists AND showPredictions is true */}
            {showPredictions && forecastData.length > 0 && (
              <Line
                type="monotone"
                dataKey="orders_count"
                name="Orders (Forecast)"
                stroke={COLOR_SCHEME.forecast.orders}
                strokeWidth={3}
                strokeDasharray="8 4"
                dot={(props: any) => {
                  const { payload } = props;
                  const isPrediction = payload?.isPrediction;
                  if (!isPrediction) {
                    // Return invisible dot for historical data on forecast line
                    return <circle cx={props.cx} cy={props.cy} r={0} fill="transparent" />;
                  }
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill={COLOR_SCHEME.forecast.orders}
                      stroke={COLOR_SCHEME.forecast.orders}
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
            )}
          </LineChart>
        );
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            {/* Historical data area */}
            <Area
              type="monotone"
              dataKey="orders_count"
              name="Orders (Historical)"
              stroke={COLOR_SCHEME.historical.orders}
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              fillOpacity={0.6}
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                if (isPrediction) {
                  // Return invisible dot for predictions on historical area
                  return <circle cx={props.cx} cy={props.cy} r={0} fill="transparent" />;
                }
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={3}
                    fill={COLOR_SCHEME.historical.orders}
                    stroke={COLOR_SCHEME.historical.orders}
                    strokeWidth={1}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Forecast data area - only show if forecast data exists AND showPredictions is true */}
            {showPredictions && forecastData.length > 0 && (
              <Area
                type="monotone"
                dataKey="orders_count"
                name="Orders (Forecast)"
                stroke={COLOR_SCHEME.forecast.orders}
                strokeWidth={3}
                strokeDasharray="8 4"
                fill={`url(#${predictionGradientId})`}
                fillOpacity={0.4}
                dot={(props: any) => {
                  const { payload } = props;
                  const isPrediction = payload?.isPrediction;
                  if (!isPrediction) {
                    // Return invisible dot for historical data on forecast area
                    return <circle cx={props.cx} cy={props.cy} r={0} fill="transparent" />;
                  }
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={3}
                      fill={COLOR_SCHEME.forecast.orders}
                      stroke={COLOR_SCHEME.forecast.orders}
                      strokeWidth={1}
                    />
                  );
                }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        );

      case 'candlestick':
        return (
          <ComposedChart {...commonProps}>
            {commonElements}
            <Bar
              dataKey="orders_count"
              name="Orders"
              fill="#10b981"
              radius={[2, 2, 0, 0]}
              opacity={0.8}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="orders_count"
              stroke="#6b7280"
              strokeWidth={1}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        );

      case 'waterfall':
        return (
          <ComposedChart {...commonProps}>
            {commonElements}
            <Bar
              dataKey="orders_count"
              name="Orders"
              fill="#f59e0b"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          </ComposedChart>
        );

      case 'stacked':
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            <Area
              type="monotone"
              dataKey="orders_count"
              stackId="1"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.6}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="confidence_min"
              stackId="2"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.3}
              isAnimationActive={false}
            />
          </AreaChart>
        );

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            {commonElements}
            <Bar
              dataKey="orders_count"
              name="Orders"
              fill="#ef4444"
              radius={[2, 2, 0, 0]}
              opacity={0.7}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="orders_count"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        );

      default:
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            {/* Historical data area */}
            <Area
              type="monotone"
              dataKey="orders_count"
              name="Orders (Historical)"
              stroke={COLOR_SCHEME.historical.orders}
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              fillOpacity={0.6}
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                if (isPrediction) {
                  // Return invisible dot for predictions on historical area
                  return <circle cx={props.cx} cy={props.cy} r={0} fill="transparent" />;
                }
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={3}
                    fill={COLOR_SCHEME.historical.orders}
                    stroke={COLOR_SCHEME.historical.orders}
                    strokeWidth={1}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Forecast data area - only show if forecast data exists AND showPredictions is true */}
            {showPredictions && forecastData.length > 0 && (
              <Area
                type="monotone"
                dataKey="orders_count"
                name="Orders (Forecast)"
                stroke={COLOR_SCHEME.forecast.orders}
                strokeWidth={3}
                strokeDasharray="8 4"
                fill={`url(#${predictionGradientId})`}
                fillOpacity={0.4}
                dot={(props: any) => {
                  const { payload } = props;
                  const isPrediction = payload?.isPrediction;
                  if (!isPrediction) {
                    // Return invisible dot for historical data on forecast area
                    return <circle cx={props.cx} cy={props.cy} r={0} fill="transparent" />;
                  }
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={3}
                      fill={COLOR_SCHEME.forecast.orders}
                      stroke={COLOR_SCHEME.forecast.orders}
                      strokeWidth={1}
                    />
                  );
                }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
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
            backgroundColor: 'transparent',
            border: 'none',
            gap: 0.5,
            '& .MuiToggleButton-root': {
              border: '1px solid',
              borderColor: 'success.main',
              borderRadius: 2,
              px: 1.5,
              py: 0.75,
              minWidth: 'auto',
              color: 'success.main',
              backgroundColor: 'success.50',
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: 'success.100',
                borderColor: 'success.main',
              },
              '&.Mui-selected': {
                backgroundColor: 'success.main',
                color: 'success.contrastText',
                borderColor: 'success.main',
                '&:hover': {
                  backgroundColor: 'success.dark',
                },
              },
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'success.main',
                outlineOffset: '2px',
              },
              transition: 'all 0.2s ease-in-out',
            },
          }}
        >
          {Object.entries(chartTypeConfig).map(([type, config]) => (
            <Tooltip key={type} title={config.label} arrow placement="top">
              <ToggleButton value={type} aria-label={config.label}>
                {React.cloneElement(config.icon, { 
                  fontSize: "small"
                })}
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      </Box>

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