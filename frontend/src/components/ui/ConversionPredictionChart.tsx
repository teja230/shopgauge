import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  AreaChart,
  ComposedChart,
  Bar,
  Line,
  Area,
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
  TrendingUp, 
  TrendingDown, 
  Percent,
  AutoAwesome,
  ShowChart,
  Timeline,
  BarChart as BarChartIcon,
  Speed,
  CandlestickChart,
  WaterfallChart,
  StackedLineChart,
  Analytics,
} from '@mui/icons-material';
import { 
  UNIFIED_COLOR_SCHEME,
  standardTooltipFormatter,
  standardDateFormatter,
  mobileOptimizedContainer,
  getMobileOptimizedHeight,
  responsiveMargins,
  responsiveChartProps,
  conversionChartTypes,
} from './ChartStyles';

interface ConversionPredictionData {
  date: string;
  conversion_rate: number;
  isPrediction?: boolean;
  confidence_min?: number;
  confidence_max?: number;
  confidence_score?: number;
}

interface ConversionPredictionChartProps {
  data: ConversionPredictionData[];
  loading?: boolean;
  error?: string | null;
  height?: number;
  showPredictions?: boolean;
}

type ChartType = 'line' | 'area' | 'bar' | 'waterfall' | 'stacked' | 'composed' | 'candlestick';

// Use unified color scheme for consistency across all charts

const ConversionPredictionChart: React.FC<ConversionPredictionChartProps> = ({
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

  const gradientId = useMemo(() => `conversion-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  const predictionGradientId = useMemo(() => `conversion-prediction-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  // Process and validate data
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map(item => ({
      date: item.date,
      conversion_rate: Math.max(0, Math.min(100, item.conversion_rate || 0)),
      isPrediction: Boolean(item.isPrediction),
      confidence_min: Math.max(0, Math.min(100, item.confidence_min || 0)),
      confidence_max: Math.max(0, Math.min(100, item.confidence_max || 0)),
      confidence_score: item.confidence_score || 0,
    })).filter(item => item.date && !isNaN(item.conversion_rate));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (processedData.length === 0) return null;
    
    const historicalData = processedData.filter(d => !d.isPrediction);
    const predictionData = processedData.filter(d => d.isPrediction);
    
    const avgHistoricalConversion = historicalData.length > 0 ? 
      historicalData.reduce((sum, d) => sum + d.conversion_rate, 0) / historicalData.length : 0;
    
    const avgPredictedConversion = predictionData.length > 0 ? 
      predictionData.reduce((sum, d) => sum + d.conversion_rate, 0) / predictionData.length : 0;
    
    const growthRate = avgHistoricalConversion > 0 ? 
      ((avgPredictedConversion - avgHistoricalConversion) / avgHistoricalConversion) * 100 : 0;
    
    return {
      avgHistoricalConversion,
      avgPredictedConversion,
      growthRate,
      historicalDays: historicalData.length,
      predictionDays: predictionData.length,
    };
  }, [processedData]);

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
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
            <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.4} />
            <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id={predictionGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.conversion} stopOpacity={0.3} />
            <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.conversion} stopOpacity={0.05} />
          </linearGradient>
          {/* Pattern for prediction area */}
          <pattern id="conversionPredictionPattern" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="4" height="4" fill={UNIFIED_COLOR_SCHEME.forecast.conversion} fillOpacity="0.1"/>
            <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke={UNIFIED_COLOR_SCHEME.forecast.conversion} strokeWidth="0.5" strokeOpacity="0.3"/>
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
          tickFormatter={(value) => `${value.toFixed(1)}%`}
          stroke="rgba(0, 0, 0, 0.6)"
          tick={{ fontSize: 11, fill: 'rgba(0, 0, 0, 0.7)' }}
          axisLine={{ stroke: 'rgba(0, 0, 0, 0.2)' }}
          label={{ value: 'Conversion Rate (%)', angle: -90, position: 'left', offset: 10, style: { textAnchor: 'middle', fontSize: 12, fill: 'rgba(0, 0, 0, 0.7)' } }}
        />
        <RechartsTooltip
          labelFormatter={standardDateFormatter}
          formatter={(value: number, name: string, props: any) => 
            standardTooltipFormatter(value, name, props, 'conversion')
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
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="8 4"
            opacity={0.8}
            label={{ value: "📈 Forecasts", position: "insideTopRight", offset: 15 }}
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
                {entry.name}: {entry.value?.toFixed(2)}%
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
        <Typography>Loading conversion forecasts...</Typography>
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
    line: { icon: <ShowChart />, label: 'Line', color: UNIFIED_COLOR_SCHEME.historical.conversion },
    area: { icon: <Timeline />, label: 'Area', color: UNIFIED_COLOR_SCHEME.historical.conversion },
    bar: { icon: <BarChartIcon />, label: 'Bar', color: UNIFIED_COLOR_SCHEME.historical.conversion },
    waterfall: { icon: <WaterfallChart />, label: 'Waterfall', color: '#f59e0b' },
    stacked: { icon: <StackedLineChart />, label: 'Stacked', color: '#8b5cf6' },
    composed: { icon: <Analytics />, label: 'Composed', color: '#ef4444' },
    candlestick: { icon: <CandlestickChart />, label: 'Candlestick', color: '#10b981' },
  };

  const renderChart = () => {
    // Use only historical data when showPredictions is false, otherwise use all data
    const chartData = showPredictions ? processedData : processedData.filter(d => !d.isPrediction);
    
    const commonProps = {
      data: chartData,
      margin: responsiveMargins(isMobile),
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
              dataKey="conversion_rate"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                const fill = isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion;
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
            {/* Single line with visual distinction between historical and forecast */}
            <Line
              type="monotone"
              dataKey="conversion_rate"
              stroke={UNIFIED_COLOR_SCHEME.historical.conversion}
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
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
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
            {/* Add confidence bounds for predictions */}
            {showPredictions && forecastData.length > 0 && (
              <Area
                type="monotone"
                dataKey="confidence_max"
                data={processedData}
                stroke="none"
                fill={UNIFIED_COLOR_SCHEME.forecast.conversion}
                fillOpacity={0.1}
                isAnimationActive={false}
              />
            )}
            {showPredictions && forecastData.length > 0 && (
              <Area
                type="monotone"
                dataKey="confidence_min"
                data={processedData}
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
              dataKey="conversion_rate"
              stroke={UNIFIED_COLOR_SCHEME.historical.conversion}
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
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
                    strokeWidth={1}
                    opacity={isPrediction && !showPredictions ? 0 : 1}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Overlay for forecast region */}
            {showPredictions && predictionStartDate && (
              <ReferenceArea
                x1={predictionStartDate}
                x2={processedData[processedData.length - 1]?.date}
                fill={UNIFIED_COLOR_SCHEME.forecast.conversion}
                fillOpacity={0.05}
                strokeWidth={0}
              />
            )}
          </AreaChart>
        );

      case 'waterfall': {
        // Process data for waterfall chart - calculate change and cumulative values
        const waterfallData = processedData.map((item, index) => {
          const change = index > 0 ? item.conversion_rate - processedData[index - 1].conversion_rate : item.conversion_rate;
          const cumulative = processedData.slice(0, index + 1).reduce((sum, d) => sum + d.conversion_rate, 0) / (index + 1);
          return {
            ...item,
            change,
            cumulative,
          };
        });

        return (
          <ComposedChart {...commonProps} data={waterfallData}>
            <defs>
              <linearGradient id="conversionWaterfallHistoricalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="conversionWaterfallForecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            {commonElements}
            {/* Bars for change/difference values (like Classic View) */}
            <Bar
              dataKey="change"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                const fill = isPrediction ? "url(#conversionWaterfallForecastGradient)" : "url(#conversionWaterfallHistoricalGradient)";
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
            {/* Cumulative line (like Classic View) */}
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

      case 'stacked': {
        // Process data for stacked chart - calculate change values for second area
        const stackedData = processedData.map((item, index) => ({
          ...item,
          conversion_change: index > 0 ? Math.max(0, item.conversion_rate - processedData[index - 1].conversion_rate) : 0
        }));

        return (
          <AreaChart {...commonProps} data={stackedData}>
            <defs>
              <linearGradient id="conversionStackedHistoricalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.3} />
                <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="conversionStackedForecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.conversion} stopOpacity={0.3} />
                <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.conversion} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="conversionChangeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {commonElements}
            {/* Primary conversion area (like Classic View) */}
            <Area
              type="monotone"
              dataKey="conversion_rate"
              stackId="1"
              stroke={UNIFIED_COLOR_SCHEME.historical.conversion}
              strokeWidth={2}
              fill="url(#conversionStackedHistoricalGradient)"
              isAnimationActive={false}
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isPrediction ? 2.5 : 3}
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
                    strokeWidth={isPrediction ? 1 : 2}
                    opacity={isPrediction ? 0.8 : 1}
                  />
                );
              }}
            />
            {/* Secondary stacked area for conversion changes/growth (like Classic View) */}
            <Area
              type="monotone"
              dataKey="conversion_change"
              stackId="2"
              stroke="#10b981"
              strokeWidth={1}
              fill="url(#conversionChangeGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        );
      }

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            <defs>
              <linearGradient id="conversionComposedHistoricalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="conversionComposedForecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fca5a5" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#fca5a5" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            {commonElements}
            <Bar
              dataKey="conversion_rate"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                const fill = isPrediction ? "url(#conversionComposedForecastGradient)" : "url(#conversionComposedHistoricalGradient)";
                const opacity = isPrediction ? 0.5 : 0.6;
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
            <Line
              type="monotone"
              dataKey="conversion_rate"
              stroke="#2563eb"
              strokeWidth={2}
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
            {processedData.length > 0 && (
              <ReferenceLine 
                y={processedData.reduce((sum, d) => sum + d.conversion_rate, 0) / processedData.length}
                stroke="#6b7280" 
                strokeDasharray="3 3"
                label={{ value: "Average", position: "insideTopRight" }}
              />
            )}
          </ComposedChart>
        );

      case 'candlestick': {
        // Process data for candlestick chart - calculate OHLC values with better differentiation
        const candlestickData = processedData.map((item, index) => {
          const conversion = item.conversion_rate;
          const prevConversion = index > 0 ? processedData[index - 1].conversion_rate : conversion;
          const nextConversion = index < processedData.length - 1 ? processedData[index + 1].conversion_rate : conversion;
          
          // Calculate OHLC (Open, High, Low, Close) values with more variation
          const open = prevConversion;
          const close = conversion;
          const high = Math.max(open, close, conversion * 1.05); // More variation for candlestick
          const low = Math.min(open, close, conversion * 0.95);
          
          return {
            ...item,
            open,
            high,
            low,
            close: conversion,
            isPositive: close >= open,
          };
        });

        return (
          <ComposedChart {...commonProps} data={candlestickData}>
            <defs>
              <linearGradient id="conversionCandlestickPositiveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="conversionCandlestickNegativeGradient" x1="0" y1="0" x2="0" y2="1">
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
                  : (isPositive ? "url(#conversionCandlestickPositiveGradient)" : "url(#conversionCandlestickNegativeGradient)");
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
            {/* Reference lines for support/resistance */}
            {processedData.length > 0 && (
              <ReferenceLine 
                y={Math.max(...processedData.map(d => d.conversion_rate))}
                stroke="#10b981" 
                strokeDasharray="5 5"
                strokeOpacity={0.5}
                label={{ value: "Resistance", position: "insideTopRight" }}
              />
            )}
            {processedData.length > 0 && (
              <ReferenceLine 
                y={Math.min(...processedData.map(d => d.conversion_rate))}
                stroke="#ef4444" 
                strokeDasharray="5 5"
                strokeOpacity={0.5}
                label={{ value: "Support", position: "insideBottomRight" }}
              />
            )}
          </ComposedChart>
        );
      }

      default:
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            {/* Single area with smooth transition */}
            <Area
              type="monotone"
              dataKey="conversion_rate"
              stroke={UNIFIED_COLOR_SCHEME.historical.conversion}
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
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
                    strokeWidth={1}
                    opacity={isPrediction && !showPredictions ? 0 : 1}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Overlay for forecast region */}
            {showPredictions && predictionStartDate && (
              <ReferenceArea
                x1={predictionStartDate}
                x2={processedData[processedData.length - 1]?.date}
                fill={UNIFIED_COLOR_SCHEME.forecast.conversion}
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
          {showPredictions ? 'Conversion Forecast' : 'Conversion'}
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
              borderColor: 'info.main',
              borderRadius: 2,
              px: 1.5,
              py: 0.75,
              minWidth: 'auto',
              color: 'info.main',
              backgroundColor: 'info.50',
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'none',
              margin: '2px',
              '&:hover': {
                backgroundColor: 'info.100',
                borderColor: 'info.main',
                transform: 'scale(1.02)',
              },
              '&.Mui-selected': {
                backgroundColor: 'info.main',
                color: 'info.contrastText',
                borderColor: 'info.main',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                '&:hover': {
                  backgroundColor: 'info.dark',
                },
              },
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'info.main',
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
        maxHeight: optimizedHeight, // Enforce height constraint
        position: 'relative',
        overflow: 'hidden', // Contain chart within bounds
        // Enhanced styling for better appearance
        backgroundColor: 'transparent', // Use transparent background to match container
        borderRadius: 1,
        // Ensure proper padding for chart elements
        padding: isMobile ? theme.spacing(0.5) : theme.spacing(1), // Reduced padding
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
          height={optimizedHeight - (isMobile ? 8 : 16)} // Adjust for reduced padding
          minHeight={optimizedHeight - (isMobile ? 8 : 16)}
        >
          {renderChart()}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default ConversionPredictionChart; 