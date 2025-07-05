import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  LineChart,
  BarChart,
  ComposedChart,
  Area,
  Line,
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
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
  Paper,
  Tooltip,
} from '@mui/material';
import { 
  TrendingUp, 
  TrendingDown, 
  AttachMoney,
  AutoAwesome,
  ShowChart,
  Timeline,
  BarChart as BarChartIcon,
  CandlestickChart,
  WaterfallChart,
  StackedLineChart,
  Analytics,
} from '@mui/icons-material';
import {
  chartContainerStyles,
  chartContentStyles,
  chartHeaderStyles,
  chartTitleStyles,
  toggleButtonGroupStyles,
  statsRowStyles,
  loadingContainerStyles,
  errorContainerStyles,
  tooltipStyles,
  chartTypeConfig,
  chartCommonProps,
  createGradientDefs,
  axisStyles,
  gridStyles,
  dotStyles,
  activeDotStyles,
  barStyles,
  lineStyles,
  areaStyles,
  referenceLineStyles,
  statChipStyles,
  forecastChipStyles,
  UNIFIED_COLOR_SCHEME,
} from './ChartStyles';

interface RevenuePredictionData {
  date: string;
  revenue: number;
  isPrediction?: boolean;
  confidence_min?: number;
  confidence_max?: number;
  confidence_score?: number;
}

interface RevenuePredictionChartProps {
  data: RevenuePredictionData[];
  loading?: boolean;
  error?: string | null;
  height?: number;
  showPredictions?: boolean;
}

type ChartType = 'line' | 'area' | 'bar' | 'candlestick' | 'waterfall' | 'stacked' | 'composed';

// Use unified color scheme for consistency across all charts

const RevenuePredictionChart: React.FC<RevenuePredictionChartProps> = ({
  data,
  loading = false,
  error = null,
  height = 450,
  showPredictions = true,
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const gradientId = useMemo(() => `revenue-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  const predictionGradientId = useMemo(() => `prediction-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  
  const chartConfig = {
    line: { icon: <ShowChart />, label: 'Line', color: UNIFIED_COLOR_SCHEME.historical.revenue },
    area: { icon: <Timeline />, label: 'Area', color: UNIFIED_COLOR_SCHEME.historical.revenue },
    bar: { icon: <BarChartIcon />, label: 'Bar', color: UNIFIED_COLOR_SCHEME.historical.revenue },
    candlestick: { icon: <CandlestickChart />, label: 'Candlestick', color: '#10b981' },
    waterfall: { icon: <WaterfallChart />, label: 'Waterfall', color: '#f59e0b' },
    stacked: { icon: <StackedLineChart />, label: 'Stacked', color: '#8b5cf6' },
    composed: { icon: <Analytics />, label: 'Composed', color: '#ef4444' },
  };
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
      // This prevents line connections between historical and forecast data
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

  // Calculate statistics
  const stats = useMemo(() => {
    if (processedData.combined.length === 0) return null;
    
    const historicalData = processedData.historical;
    const predictionData = processedData.predicted;
    
    const currentRevenue = historicalData.reduce((sum, d) => sum + d.revenue, 0);
    const predictedRevenue = predictionData.reduce((sum, d) => sum + d.revenue, 0);
    
    const growthRate = historicalData.length > 0 ? 
      ((predictedRevenue / predictionData.length) - (currentRevenue / historicalData.length)) / 
      (currentRevenue / historicalData.length) * 100 : 0;
    
    return {
      currentRevenue,
      predictedRevenue,
      growthRate,
      historicalDays: historicalData.length,
      predictionDays: predictionData.length,
    };
  }, [processedData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  // Common chart elements with enhanced visual separation - moved before early returns
  const commonElements = useMemo(() => {
    const historicalData = processedData.historical;
    const predictionData = processedData.predicted;
    const separatorDate = predictionData.length > 0 ? predictionData[0]?.date : null;

    return (
      <>
        <defs>
          {/* Enhanced gradient that transitions from historical to forecast colors */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.4} />
            <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id={predictionGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0.3} />
            <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0.05} />
          </linearGradient>
          {/* Confidence interval gradient */}
          <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0.2} />
            <stop offset="100%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0} />
          </linearGradient>
          {/* Pattern for prediction area */}
          <pattern id="predictionPattern" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="4" height="4" fill={UNIFIED_COLOR_SCHEME.forecast.revenue} fillOpacity="0.1"/>
            <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke={UNIFIED_COLOR_SCHEME.forecast.revenue} strokeWidth="0.5" strokeOpacity="0.3"/>
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
          tickFormatter={formatCurrency}
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
            return [`${prefix}${formatCurrency(value)}`, name];
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
          <>
            {/* Main separator line */}
            <ReferenceLine
              x={separatorDate}
              stroke="#9333ea"
              strokeWidth={2}
              strokeDasharray="8 4"
              opacity={0.8}
              label={{ value: "Forecasts", position: "top" }}
            />
            {/* Subtle background highlight for prediction area */}
            <ReferenceLine
              x={separatorDate}
              stroke="transparent"
            />
          </>
        )}
      </>
    );
  }, [processedData.historical, processedData.predicted, gradientId, predictionGradientId, formatCurrency]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPrediction = data.isPrediction;
      
      return (
        <Paper
          elevation={8}
          sx={tooltipStyles(theme)}
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
                {entry.name}: ${entry.value?.toLocaleString()}
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
      <Box sx={loadingContainerStyles(theme, height)}>
        <Typography>Loading revenue forecasts...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={errorContainerStyles(theme, height)}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  const predictionStartDate = processedData.predicted.find(d => d.isPrediction)?.date;

  const renderChart = () => {
    // Use only historical data when showPredictions is false, otherwise use combined data
    const chartData = showPredictions ? processedData.combined : processedData.historical;
    
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 20, bottom: 20 },
    };

    // Separate historical and forecast data for proper rendering
    const historicalData = processedData.historical;
    const forecastData = processedData.predicted;

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonElements}
            <Bar
              dataKey="revenue"
              name="Revenue"
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                const fill = isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue;
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
            {/* Render both historical and forecast data as a single line to avoid gaps */}
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={UNIFIED_COLOR_SCHEME.historical.revenue}
              strokeWidth={3}
              strokeDasharray="" // Always solid for the main line
              dot={(props: any) => {
                const { payload } = props;
                const isPrediction = payload?.isPrediction;
                // Use different dot styles for historical vs forecast
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={isPrediction && showPredictions ? 3 : 4}
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                    strokeWidth={isPrediction ? 1 : 2}
                    opacity={isPrediction && !showPredictions ? 0 : 1}
                  />
                );
              }}
              activeDot={{ 
                r: 6, 
                stroke: theme.palette.background.paper,
                strokeWidth: 2,
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Add confidence interval area for predictions if enabled */}
            {showPredictions && processedData.hasPredictions && (
              <Area
                type="monotone"
                dataKey="confidence_max"
                data={processedData.combined}
                stroke="none"
                fill={UNIFIED_COLOR_SCHEME.forecast.revenue}
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
            {/* Render single area with gradient transition */}
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={UNIFIED_COLOR_SCHEME.historical.revenue}
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
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                    strokeWidth={1}
                    opacity={isPrediction && !showPredictions ? 0 : 1}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Add subtle overlay for forecast region */}
            {showPredictions && predictionStartDate && (
              <ReferenceArea
                x1={predictionStartDate}
                x2={processedData.combined[processedData.combined.length - 1]?.date}
                fill={UNIFIED_COLOR_SCHEME.forecast.revenue}
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
              dataKey="revenue"
              name="Revenue"
              fill="#10b981"
              radius={[2, 2, 0, 0]}
              opacity={0.8}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="revenue"
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
              dataKey="revenue"
              name="Revenue"
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
              dataKey="revenue"
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
              dataKey="revenue"
              name="Revenue"
              fill="#ef4444"
              radius={[2, 2, 0, 0]}
              opacity={0.7}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="revenue"
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
            {/* Single area with smooth transition between historical and forecast */}
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={UNIFIED_COLOR_SCHEME.historical.revenue}
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
                    fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                    stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                    strokeWidth={1}
                    opacity={isPrediction && !showPredictions ? 0 : 1}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Add subtle overlay for forecast region */}
            {showPredictions && predictionStartDate && (
              <ReferenceArea
                x1={predictionStartDate}
                x2={processedData.combined[processedData.combined.length - 1]?.date}
                fill={UNIFIED_COLOR_SCHEME.forecast.revenue}
                fillOpacity={0.05}
                strokeWidth={0}
              />
            )}
          </AreaChart>
        );
    }
  };

  return (
    <Box sx={chartContainerStyles(theme)}>
      {/* Header with Chart Type Toggle */}
      <Box sx={chartHeaderStyles(theme)}>
        <Typography variant="subtitle1" fontWeight={600} sx={chartTitleStyles(theme)}>
          <AutoAwesome color="secondary" fontSize="small" />
          Revenue Forecast
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
          {Object.entries(chartConfig).map(([type, config]) => (
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
      <Box sx={chartContentStyles(theme, height)}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default RevenuePredictionChart; 