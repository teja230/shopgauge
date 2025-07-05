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
  ReferenceArea,
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
import { UNIFIED_COLOR_SCHEME } from './ChartStyles';
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

// Use unified color scheme for consistency across all charts

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
  // Process data for rendering - separate historical and forecast data properly
  const processedData = useMemo(() => {
    if (!data || data.length === 0) {
      return { 
        historical: [], 
        predicted: [], 
        combined: [],
        hasHistorical: false,
        hasPredictions: false 
      };
    }

    try {
      // Separate data by type
      const historical = data.filter(item => !item.isPrediction);
      const predicted = data.filter(item => item.isPrediction);
      
      // Sort each array by date
      const sortedHistorical = historical.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const sortedPredicted = predicted.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // For combined view, we need to create two separate datasets
      const combined = [...sortedHistorical, ...sortedPredicted];

      return {
        historical: sortedHistorical,
        predicted: sortedPredicted,
        combined: combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        hasHistorical: sortedHistorical.length > 0,
        hasPredictions: sortedPredicted.length > 0
      };
    } catch (error) {
      console.error('Error processing chart data:', error);
      return { 
        historical: [], 
        predicted: [], 
        combined: [],
        hasHistorical: false,
        hasPredictions: false 
      };
    }
  }, [data]);

  // Aggregate stats for display
  const stats = useMemo(() => {
    if (!processedData.hasHistorical) return null;
    
    const totalHistorical = processedData.historical.reduce((sum: number, d: any) => sum + (d.orders_count || 0), 0);
    const totalForecast = processedData.predicted.reduce((sum: number, d: any) => sum + (d.orders_count || 0), 0);
    
    return {
      historical: totalHistorical,
      forecast: totalForecast,
      total: totalHistorical + totalForecast,
    };
  }, [processedData]);

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  // Common chart elements with enhanced visual separation - moved before early returns 
  const commonElements = useMemo(() => {
    const historicalData = processedData.historical;
    const predictionData = processedData.predicted;
    const separatorDate = predictionData.length > 0 ? predictionData[0]?.date : null;

    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.orders} stopOpacity={0.4} />
            <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.orders} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id={predictionGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.orders} stopOpacity={0.3} />
            <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.orders} stopOpacity={0.05} />
          </linearGradient>
          {/* Pattern for prediction area */}
          <pattern id="orderPredictionPattern" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="4" height="4" fill={UNIFIED_COLOR_SCHEME.forecast.orders} fillOpacity="0.1"/>
            <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke={UNIFIED_COLOR_SCHEME.forecast.orders} strokeWidth="0.5" strokeOpacity="0.3"/>
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
  }, [processedData, gradientId, predictionGradientId, showPredictions]);

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

  // Chart data preparation
  const chartData = useMemo(() => {
    return showPredictions ? processedData.combined : processedData.historical;
  }, [processedData, showPredictions]);

  // Separate historical and forecast data for proper rendering
  const historicalData = processedData.historical;
  const forecastData = processedData.predicted;

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

  const predictionStartDate = processedData.predicted.find(d => d.isPrediction)?.date;

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
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 20, bottom: 20 },
    };

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
                const fill = isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders;
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
            {/* Single line with different dot styles for historical vs forecast */}
            <Line
              type="monotone"
              dataKey="orders_count"
              name="Orders"
              stroke={UNIFIED_COLOR_SCHEME.historical.orders}
              strokeWidth={3}
              strokeDasharray="" // Always solid line
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isPrediction && showPredictions ? 3 : 4}
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                    strokeWidth={isPrediction ? 1 : 2}
                    opacity={isPrediction && !showPredictions ? 0 : 1}
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
            {/* Add confidence visualization for predictions */}
            {showPredictions && processedData.hasPredictions && (
              <Area
                type="monotone"
                dataKey="confidence_max"
                data={processedData.combined}
                stroke="none"
                fill={UNIFIED_COLOR_SCHEME.forecast.orders}
                fillOpacity={0.1}
                isAnimationActive={false}
              />
            )}
            {showPredictions && processedData.hasPredictions && (
              <Area
                type="monotone"
                dataKey="confidence_min"
                data={processedData.combined}
                stroke="none"
                fill="#ffffff"
                fillOpacity={1}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        );
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            {/* Single area with smooth transition */}
            <Area
              type="monotone"
              dataKey="orders_count"
              name="Orders"
              stroke={UNIFIED_COLOR_SCHEME.historical.orders}
              strokeWidth={3}
              strokeDasharray="" // Always solid stroke
              fill={`url(#${gradientId})`}
              fillOpacity={0.6}
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isPrediction && showPredictions ? 2.5 : 3}
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                    strokeWidth={1}
                    opacity={isPrediction && !showPredictions ? 0 : 1}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Subtle overlay for forecast region */}
            {showPredictions && predictionStartDate && (
              <ReferenceArea
                x1={predictionStartDate}
                x2={processedData.combined[processedData.combined.length - 1]?.date}
                fill={UNIFIED_COLOR_SCHEME.forecast.orders}
                fillOpacity={0.05}
                strokeWidth={0}
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
            {/* Single area with smooth transition */}
            <Area
              type="monotone"
              dataKey="orders_count"
              name="Orders"
              stroke={UNIFIED_COLOR_SCHEME.historical.orders}
              strokeWidth={3}
              strokeDasharray="" // Always solid stroke
              fill={`url(#${gradientId})`}
              fillOpacity={0.6}
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isPrediction && showPredictions ? 2.5 : 3}
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                    strokeWidth={1}
                    opacity={isPrediction && !showPredictions ? 0 : 1}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Subtle overlay for forecast region */}
            {showPredictions && predictionStartDate && (
              <ReferenceArea
                x1={predictionStartDate}
                x2={processedData.combined[processedData.combined.length - 1]?.date}
                fill={UNIFIED_COLOR_SCHEME.forecast.orders}
                fillOpacity={0.05}
                strokeWidth={0}
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