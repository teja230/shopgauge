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
import { 
  UNIFIED_COLOR_SCHEME,
  standardTooltipFormatter,
  standardDateFormatter,
  mobileOptimizedContainer,
  getMobileOptimizedHeight,
  responsiveMargins,
  responsiveChartProps,
  ordersChartTypes,
} from './ChartStyles';
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

type ChartType = 'line' | 'area' | 'bar' | 'waterfall' | 'stacked' | 'composed' | 'candlestick';

// Use unified color scheme for consistency across all charts

const OrderPredictionChart: React.FC<OrderPredictionChartProps> = ({
  data,
  loading = false,
  error = null,
  height = 650,
  showPredictions = true,
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Better responsive height calculation - UPDATED for better visibility
  const optimizedHeight = useMemo(() => {
    if (isMobile) return Math.max(450, height); // Increased minimum from 350 to 450px on mobile
    return Math.max(600, height); // Ensure minimum 600px on desktop/tablet for better visibility
  }, [height, isMobile]);

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
          label={{ value: 'Date', position: 'bottom', offset: 18, style: { textAnchor: 'middle', fontSize: 12, fill: 'rgba(0, 0, 0, 0.7)' } }}
        />
        <YAxis
          tickFormatter={(value) => Math.round(value).toString()}
          stroke="rgba(0, 0, 0, 0.6)"
          tick={{ fontSize: 11, fill: 'rgba(0, 0, 0, 0.7)' }}
          axisLine={{ stroke: 'rgba(0, 0, 0, 0.2)' }}
          label={{ value: 'Orders Count', angle: -90, position: 'left', offset: 10, style: { textAnchor: 'middle', fontSize: 12, fill: 'rgba(0, 0, 0, 0.7)' } }}
        />
        <RechartsTooltip
          labelFormatter={standardDateFormatter}
          formatter={(value: number, name: string, props: any) => 
            standardTooltipFormatter(value, name, props, 'orders')
          }
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
            label={{ value: "📦 Forecasts", position: "insideTopRight", offset: 15 }}
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
    line: { icon: <ShowChart />, label: 'Line', color: UNIFIED_COLOR_SCHEME.historical.orders },
    area: { icon: <Timeline />, label: 'Area', color: UNIFIED_COLOR_SCHEME.historical.orders },
    bar: { icon: <BarChartIcon />, label: 'Bar', color: UNIFIED_COLOR_SCHEME.historical.orders },
    waterfall: { icon: <WaterfallChart />, label: 'Waterfall', color: '#f59e0b' },
    stacked: { icon: <StackedLineChart />, label: 'Stacked', color: '#8b5cf6' },
    composed: { icon: <Analytics />, label: 'Composed', color: '#ef4444' },
    candlestick: { icon: <CandlestickChart />, label: 'Candlestick', color: '#10b981' },
  };

  const renderChart = () => {
    // Use only historical data when showPredictions is false, otherwise use combined data
    const chartData = showPredictions ? processedData.combined : processedData.historical;
    
    const commonProps = {
      data: chartData,
      margin: responsiveMargins(isMobile),
    };

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonElements}
            <Bar
              dataKey="orders_count"
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

      case 'waterfall': {
        // Process data for waterfall chart - calculate change and cumulative values
        const waterfallData = processedData.combined.map((item, index) => {
          const change = index > 0 ? item.orders_count - processedData.combined[index - 1].orders_count : item.orders_count;
          const cumulative = processedData.combined.slice(0, index + 1).reduce((sum, d) => sum + d.orders_count, 0) / (index + 1);
          return {
            ...item,
            change,
            cumulative,
          };
        });

        return (
          <ComposedChart {...commonProps} data={waterfallData}>
            <defs>
              <linearGradient id="ordersWaterfallHistoricalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="ordersWaterfallForecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            {commonElements}
            {/* Bars for change/difference values */}
            <Bar
              dataKey="change"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                const fill = isPrediction ? "url(#ordersWaterfallForecastGradient)" : "url(#ordersWaterfallHistoricalGradient)";
                const opacity = isPrediction ? 0.7 : 0.8;
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
            {/* Cumulative line */}
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isPrediction ? 2 : 3}
                    fill={isPrediction ? "#fbbf24" : "#f59e0b"}
                    stroke={isPrediction ? "#fbbf24" : "#f59e0b"}
                    strokeWidth={2}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        );
      }

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            <defs>
              <linearGradient id="ordersComposedHistoricalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="ordersComposedForecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fca5a5" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#fca5a5" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            {commonElements}
            {/* Bars with reduced opacity */}
            <Bar
              dataKey="orders_count"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                const fill = isPrediction ? "url(#ordersComposedForecastGradient)" : "url(#ordersComposedHistoricalGradient)";
                const opacity = isPrediction ? 0.5 : 0.6; // Reduced opacity like Classic View
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
            {/* Line overlay */}
            <Line
              type="monotone"
              dataKey="orders_count"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray=""
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isPrediction ? 2 : 3}
                    fill={isPrediction ? "#93c5fd" : "#2563eb"}
                    stroke={isPrediction ? "#93c5fd" : "#2563eb"}
                    strokeWidth={2}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Reference line for average */}
            {processedData.historical.length > 0 && (
              <ReferenceLine 
                y={processedData.historical.reduce((sum, d) => sum + d.orders_count, 0) / processedData.historical.length}
                stroke="#6b7280" 
                strokeDasharray="3 3"
                label={{ value: "Average", position: "insideTopRight" }}
              />
            )}
          </ComposedChart>
        );

      case 'candlestick': {
        // Process data for candlestick chart - calculate OHLC values with better differentiation
        const candlestickData = processedData.combined.map((item, index) => {
          const orders = item.orders_count;
          const prevOrders = index > 0 ? processedData.combined[index - 1].orders_count : orders;
          const nextOrders = index < processedData.combined.length - 1 ? processedData.combined[index + 1].orders_count : orders;
          
          // Calculate OHLC (Open, High, Low, Close) values with more variation
          const open = prevOrders;
          const close = orders;
          const high = Math.max(open, close, orders * 1.1); // More variation for candlestick
          const low = Math.min(open, close, orders * 0.9);
          
          return {
            ...item,
            open,
            high,
            low,
            close: orders,
            isPositive: close >= open,
          };
        });

        return (
          <ComposedChart {...commonProps} data={candlestickData}>
            <defs>
              <linearGradient id="ordersCandlestickPositiveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="ordersCandlestickNegativeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            {commonElements}
            {/* Candlestick bodies with clear positive/negative distinction */}
            <Bar
              dataKey="close"
              radius={[1, 1, 1, 1]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                const isPositive = payload?.isPositive;
                const fill = isPrediction 
                  ? (isPositive ? "#34d399" : "#fca5a5")
                  : (isPositive ? "url(#ordersCandlestickPositiveGradient)" : "url(#ordersCandlestickNegativeGradient)");
                const opacity = isPrediction ? 0.7 : 0.9;
                
                return (
                  <rect
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    height={props.height}
                    fill={fill}
                    opacity={opacity}
                    stroke={isPositive ? "#10b981" : "#ef4444"}
                    strokeWidth={isPrediction ? 2 : 1}
                    strokeDasharray={isPrediction ? "3,3" : ""}
                    rx={1}
                    ry={1}
                  />
                );
              }}
            />
            {/* High-Low lines for candlestick wicks */}
            <Line
              type="monotone"
              dataKey="high"
              stroke="#6b7280"
              strokeWidth={1}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        );
      }

      case 'stacked': {
        // Process data for stacked chart - calculate change values for second area
        const stackedData = processedData.combined.map((item, index) => ({
          ...item,
          orders_change: index > 0 ? Math.max(0, item.orders_count - processedData.combined[index - 1].orders_count) : 0
        }));

        return (
          <AreaChart {...commonProps} data={stackedData}>
            <defs>
              <linearGradient id="ordersStackedHistoricalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="ordersStackedForecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0.2} />
              </linearGradient>
              <linearGradient id="ordersChangeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {commonElements}
            {/* Primary orders data area (like Classic View) */}
            <Area
              type="monotone"
              dataKey="orders_count"
              stackId="1"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#ordersStackedHistoricalGradient)"
              connectNulls={false}
              isAnimationActive={false}
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isPrediction ? 2.5 : 3}
                    fill={isPrediction ? "#c4b5fd" : "#8b5cf6"}
                    stroke={isPrediction ? "#c4b5fd" : "#8b5cf6"}
                    strokeWidth={isPrediction ? 1 : 2}
                    opacity={isPrediction ? 0.8 : 1}
                  />
                );
              }}
            />
            {/* Secondary stacked area for order changes/growth (like Classic View) */}
            <Area
              type="monotone"
              dataKey="orders_change"
              stackId="2"
              stroke="#10b981"
              strokeWidth={1}
              fill="url(#ordersChangeGradient)"
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Prediction separator line - removed duplicate label since it's already in commonElements */}
          </AreaChart>
        );
      }

      default:
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            {/* Single area with smooth transition */}
            <Area
              type="monotone"
              dataKey="orders_count"
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
          {showPredictions ? 'Order Forecast' : 'Orders'}
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
            padding: '4px',
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
              margin: '2px',
              '&:hover': {
                backgroundColor: 'success.100',
                borderColor: 'success.main',
                transform: 'scale(1.02)',
              },
              '&.Mui-selected': {
                backgroundColor: 'success.main',
                color: 'success.contrastText',
                borderColor: 'success.main',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                '&:hover': {
                  backgroundColor: 'success.dark',
                },
              },
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'success.main',
                outlineOffset: '2px',
                zIndex: 1,
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

      {/* Chart with improved responsive sizing */}
      <Box sx={{
        width: '100%',
        height: optimizedHeight,
        minHeight: optimizedHeight,
        position: 'relative',
        overflow: 'visible', // Changed from 'hidden' to 'visible' to prevent cutoff
        // Enhanced styling for better appearance
        backgroundColor: theme.palette.background.paper,
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        // Ensure proper padding for chart elements
        padding: isMobile ? theme.spacing(1) : theme.spacing(2),
        // Mobile browser compatibility fixes
        ...(isMobile && {
          maxWidth: '100vw',
          touchAction: 'pan-y',
          overflowX: 'auto', // Enable horizontal scrolling on mobile
          overflowY: 'auto', // Enable vertical scrolling on mobile
          '& .recharts-cartesian-axis-tick-value': {
            fontSize: '10px !important',
          },
          '& .recharts-legend-wrapper': {
            fontSize: '11px !important',
            paddingTop: '8px !important',
          },
          '& .recharts-tooltip-wrapper': {
            fontSize: '12px !important',
          },
        }),
        // Desktop optimizations
        ...(!isMobile && {
          '& .recharts-cartesian-axis-tick-value': {
            fontSize: '12px !important',
          },
          '& .recharts-legend-wrapper': {
            fontSize: '13px !important',
          },
          '& .recharts-tooltip-wrapper': {
            fontSize: '14px !important',
          },
        }),
      }}>
        <ResponsiveContainer 
          width="100%" 
          height={optimizedHeight - (isMobile ? 16 : 32)} // Adjust for padding
          minHeight={optimizedHeight - (isMobile ? 16 : 32)}
        >
          {renderChart()}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default OrderPredictionChart; 