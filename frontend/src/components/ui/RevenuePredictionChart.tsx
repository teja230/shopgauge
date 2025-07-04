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
  // Process and validate data
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map(item => ({
      date: item.date,
      revenue: Math.max(0, item.revenue || 0),
      isPrediction: Boolean(item.isPrediction),
      confidence_min: item.confidence_min || 0,
      confidence_max: item.confidence_max || 0,
      confidence_score: item.confidence_score || 0,
    })).filter(item => item.date && !isNaN(item.revenue));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (processedData.length === 0) return null;
    
    const historicalData = processedData.filter(d => !d.isPrediction);
    const predictionData = processedData.filter(d => d.isPrediction);
    
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

  const predictionStartDate = processedData.find(d => d.isPrediction)?.date;

  const chartTypeConfig = {
    area: { icon: <Timeline />, label: 'Area', color: theme.palette.primary.main },
    line: { icon: <ShowChart />, label: 'Line', color: theme.palette.primary.main },
    bar: { icon: <BarChartIcon />, label: 'Bar', color: theme.palette.primary.main },
  };

  const renderChart = () => {
    const commonProps = {
      data: processedData,
      ...chartCommonProps,
    };

    const commonElements = (
      <>
        {createGradientDefs(gradientId, predictionGradientId, theme)}
        
        <CartesianGrid {...gridStyles(theme)} />
        
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
          {...axisStyles(theme)}
        />
        
        <YAxis
          tickFormatter={formatCurrency}
          {...axisStyles(theme)}
          label={{
            value: 'Revenue (USD)',
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
            {...referenceLineStyles(theme)}
          />
        )}
      </>
    );

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              {...areaStyles(theme.palette.primary.main, gradientId)}
              dot={dotStyles(theme.palette.primary.main)}
              activeDot={activeDotStyles(theme.palette.primary.main)}
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
              {...lineStyles(theme.palette.primary.main)}
              dot={dotStyles(theme.palette.primary.main)}
              activeDot={activeDotStyles(theme.palette.primary.main)}
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
              {...barStyles(theme.palette.primary.main)}
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
              {...areaStyles(theme.palette.primary.main, gradientId)}
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