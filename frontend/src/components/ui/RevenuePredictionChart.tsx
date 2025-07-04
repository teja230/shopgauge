import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  LineChart,
  BarChart,
  Area,
  Line,
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
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
  Paper,
} from '@mui/material';
import { 
  TrendingUp, 
  TrendingDown, 
  AutoAwesome,
  ShowChart,
  Timeline,
  BarChart as BarChartIcon,
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
}

type ChartType = 'area' | 'line' | 'bar';

const RevenuePredictionChart: React.FC<RevenuePredictionChartProps> = ({
  data,
  loading = false,
  error = null,
  height = 400,
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const gradientId = useMemo(() => `revenue-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  const predictionGradientId = useMemo(() => `prediction-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  
  const chartConfig = {
    area: { icon: <Timeline />, label: 'Area', color: theme.palette.primary.main },
    line: { icon: <ShowChart />, label: 'Line', color: theme.palette.primary.main },
    bar: { icon: <BarChartIcon />, label: 'Bar', color: theme.palette.primary.main },
  };
  // Process and validate data with separation of historical vs predicted
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return { combined: [], historical: [], predicted: [] };
    
    const validData = data.map(item => ({
      date: item.date,
      revenue: Math.max(0, item.revenue || 0),
      isPrediction: Boolean(item.isPrediction),
      confidence_min: item.confidence_min || 0,
      confidence_max: item.confidence_max || 0,
      confidence_score: item.confidence_score || 0,
    })).filter(item => item.date && !isNaN(item.revenue));

    const historical = validData.filter(item => !item.isPrediction);
    const predicted = validData.filter(item => item.isPrediction);

    return {
      combined: validData,
      historical,
      predicted
    };
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
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.4} />
            <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id={predictionGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={theme.palette.secondary.main} stopOpacity={0.3} />
            <stop offset="95%" stopColor={theme.palette.secondary.main} stopOpacity={0.05} />
          </linearGradient>
          {/* Pattern for prediction area */}
          <pattern id="predictionPattern" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="4" height="4" fill={theme.palette.secondary.main} fillOpacity="0.1"/>
            <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke={theme.palette.secondary.main} strokeWidth="0.5" strokeOpacity="0.3"/>
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
        
        {/* Stylish separator line between historical and predicted data */}
        {separatorDate && (
          <>
            {/* Main separator line */}
            <ReferenceLine
              x={separatorDate}
              stroke={theme.palette.warning.main}
              strokeWidth={2}
              strokeDasharray="8 4"
              opacity={0.8}
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
  }, [processedData.historical, processedData.predicted, theme, gradientId, predictionGradientId, formatCurrency]);

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
    const commonProps = {
      data: processedData.combined,
      margin: { top: 10, right: 30, left: 20, bottom: 20 },
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            {/* Single area with conditional styling - Recharts will handle the data */}
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={theme.palette.primary.main}
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
                    fill={payload?.isPrediction ? theme.palette.secondary.main : theme.palette.primary.main}
                    stroke={payload?.isPrediction ? theme.palette.secondary.dark : theme.palette.primary.dark}
                    strokeWidth={2}
                  />
                );
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        );
      
      case 'line':
        return (
          <LineChart {...commonProps}>
            {commonElements}
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={theme.palette.primary.main}
              strokeWidth={3}
              dot={(props: any) => {
                const { payload } = props;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={payload?.isPrediction ? theme.palette.secondary.main : theme.palette.primary.main}
                    stroke={payload?.isPrediction ? theme.palette.secondary.dark : theme.palette.primary.dark}
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
      
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonElements}
            <Bar
              dataKey="revenue"
              name="Revenue"
              fill={theme.palette.primary.main}
              opacity={0.8}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
              shape={(props: any) => {
                const { payload } = props;
                const fill = payload?.isPrediction ? theme.palette.secondary.main : theme.palette.primary.main;
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
          <AreaChart {...commonProps}>
            {commonElements}
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              fillOpacity={0.6}
              connectNulls={false}
              isAnimationActive={false}
            />
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
          sx={toggleButtonGroupStyles(theme, isMobile)}
        >
          {Object.entries(chartConfig).map(([type, config]) => (
            <ToggleButton key={type} value={type} aria-label={config.label}>
              {config.icon}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Stats Row */}
      {stats && (
        <Box sx={statsRowStyles(theme)}>
          <Chip
            label={`${stats.growthRate >= 0 ? '+' : ''}${stats.growthRate.toFixed(1)}%`}
            color={stats.growthRate >= 0 ? 'success' : 'error'}
            size="small"
            icon={stats.growthRate >= 0 ? <TrendingUp /> : <TrendingDown />}
            sx={statChipStyles(theme)}
          />
          <Chip
            label={`${formatCurrency(stats.predictedRevenue)} forecast`}
            variant="outlined"
            color="secondary"
            size="small"
            sx={forecastChipStyles(theme)}
          />
        </Box>
      )}

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