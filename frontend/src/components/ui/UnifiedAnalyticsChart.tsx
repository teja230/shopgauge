import React, { useState, useMemo, useLayoutEffect, useRef, memo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  AreaChart,
  BarChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Box,
  Paper,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip as MuiTooltip,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Timeline,
  Analytics,
  AutoGraph,
  Visibility,
  VisibilityOff,
  InfoOutlined,
  ShowChart,
  BarChart as BarChartIcon,
  CandlestickChart,
  WaterfallChart,
  StackedLineChart,
  AutoFixHigh,
  Insights,
  PlayArrow,
  Stop,
} from '@mui/icons-material';
import LoadingIndicator from './LoadingIndicator';
import ChartErrorBoundary from './ChartErrorBoundary';
import type { TooltipProps, ChartPayload, UnifiedDatum, PredictionPoint } from '../../types/charts';
import { useMediaQuery, useTheme } from '@mui/material';
import { debugLog } from './DebugPanel';
import useSize from '../../hooks/useSize';
import { CHART_DIMENSIONS, SPACING, ensureMinHeight } from '../../utils/dimensionUtils';

interface HistoricalData {
  kind?: 'historical';
  date: string;
  revenue: number;
  orders_count: number;
  conversion_rate: number;
  avg_order_value: number;
  isPrediction?: false;
}

interface PredictionData {
  kind?: 'prediction';
  date: string;
  revenue: number;
  orders_count: number;
  conversion_rate: number;
  avg_order_value: number;
  isPrediction?: true;
  confidence_interval?: {
    revenue_min: number;
    revenue_max: number;
    orders_min: number;
    orders_max: number;
  };
  prediction_type?: string;
  confidence_score?: number;
}

interface UnifiedAnalyticsData {
  historical: HistoricalData[];
  predictions: PredictionData[];
  period_days: number;
  total_revenue: number;
  total_orders: number;
}

interface UnifiedAnalyticsChartProps {
  data: UnifiedAnalyticsData | null;
  loading?: boolean;
  error?: string | null;
  height?: number;
}

type ChartType = 'combined' | 'revenue_focus' | 'line' | 'area' | 'bar' | 'candlestick' | 'waterfall' | 'stacked' | 'composed';
type TimeRange = 'all' | 'last30' | 'last7';

// Enhanced SVG-safe number validation
const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  const num = Number(value);
  
  // Check for NaN, infinity, or extreme values
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }
  
  // Prevent extremely large values that can cause SVG rendering issues
  if (Math.abs(num) > 1e10) {
    return defaultValue;
  }
  
  // Round to prevent floating point precision issues
  return Math.round(num * 100) / 100;
};

// Enhanced date validation for SVG rendering
const safeDateString = (dateStr: any): string => {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date().toISOString().split('T')[0];
  }
  
  // Validate date format
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  
  // Return standardized date format
  return dateStr.substring(0, 10);
};

// Comprehensive data validation for chart rendering
const validateChartData = (data: any[]): boolean => {
  if (!Array.isArray(data) || data.length === 0) {
    return false;
  }

  return data.every((item, index) => {
    if (!item || typeof item !== 'object') {
      debugLog.warn('Invalid data item', { index, item }, 'validateChartData');
      return false;
    }

    // Validate required fields
    if (!item.date || typeof item.date !== 'string') {
      debugLog.warn('Invalid date field', { index, date: item.date }, 'validateChartData');
      return false;
    }

    // Validate numeric fields
    const numericFields = ['revenue', 'orders_count', 'conversion_rate', 'avg_order_value'];
    for (const field of numericFields) {
      const value = item[field];
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        debugLog.warn('Invalid numeric field', { index, field, value }, 'validateChartData');
        return false;
      }
    }

    return true;
  });
};

// Enhanced data processing with comprehensive validation
const processHistoricalItem = (item: any): any => {
  try {
    const processedItem: any = {
      date: safeDateString(item.date),
      revenue: safeNumber(item.revenue, 0),
      orders_count: safeNumber(item.orders_count, 0),
      conversion_rate: safeNumber(item.conversion_rate, 0),
      avg_order_value: safeNumber(item.avg_order_value, 0),
      kind: item.kind || 'historical',
      isPrediction: Boolean(item.isPrediction),
    };

    // Ensure reasonable bounds for each metric
    processedItem.revenue = Math.max(0, Math.min(processedItem.revenue, 1e9));
    processedItem.orders_count = Math.max(0, Math.min(processedItem.orders_count, 1e6));
    processedItem.conversion_rate = Math.max(0, Math.min(processedItem.conversion_rate, 100));
    processedItem.avg_order_value = Math.max(0, Math.min(processedItem.avg_order_value, 1e6));

    // Add confidence interval for predictions
    if (item.isPrediction && item.confidence_interval) {
      processedItem.confidence_interval = {
        revenue_min: safeNumber(item.confidence_interval.revenue_min, 0),
        revenue_max: safeNumber(item.confidence_interval.revenue_max, 0),
        orders_min: safeNumber(item.confidence_interval.orders_min, 0),
        orders_max: safeNumber(item.confidence_interval.orders_max, 0),
      };
    }

    return processedItem;
  } catch (error) {
    debugLog.error('Error processing data item', { error, item }, 'processHistoricalItem');
    // Return safe fallback
    return {
      date: new Date().toISOString().split('T')[0],
      revenue: 0,
      orders_count: 0,
      conversion_rate: 0,
      avg_order_value: 0,
      kind: 'historical',
      isPrediction: false,
    };
  }
};

// Simplified and robust Line Chart component with all metrics support
const SimpleLineChart = memo(({ data, visibleMetrics, shouldShowPredictionLine, predictionDate }: any) => {
  if (!validateChartData(data)) {
    return null;
  }

  return (
    <LineChart
      data={data}
      margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
      <XAxis
        dataKey="date"
        tickFormatter={(value) => {
          try {
            return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          } catch {
            return value;
          }
        }}
        stroke="rgba(0, 0, 0, 0.6)"
      />
      <YAxis
        yAxisId="left"
        stroke="rgba(0, 0, 0, 0.6)"
        tickFormatter={(value) => `$${value.toLocaleString()}`}
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        stroke="rgba(0, 0, 0, 0.6)"
        tickFormatter={(value) => value.toLocaleString()}
      />
      <Tooltip
        labelFormatter={(label) => {
          try {
            return new Date(label).toLocaleDateString();
          } catch {
            return label;
          }
        }}
        formatter={(value: number, name: string) => {
          if (name === 'Revenue') return [`$${value.toLocaleString()}`, name];
          if (name === 'Orders') return [value.toLocaleString(), name];
          if (name === 'Conversion Rate') return [`${value.toFixed(2)}%`, name];
          return [value.toLocaleString(), name];
        }}
      />
      <Legend />
      {visibleMetrics.revenue && (
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#2563eb"
          strokeWidth={2}
          name="Revenue"
          dot={false}
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.orders && (
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders_count"
          stroke="#10b981"
          strokeWidth={2}
          name="Orders"
          dot={false}
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.conversion && (
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="conversion_rate"
          stroke="#f59e0b"
          strokeWidth={2}
          name="Conversion Rate"
          dot={false}
          isAnimationActive={false}
        />
      )}
      {shouldShowPredictionLine && predictionDate && (
        <ReferenceLine
          x={predictionDate}
          stroke="rgba(0, 0, 0, 0.3)"
          strokeDasharray="3 3"
          label="Predictions"
        />
      )}
    </LineChart>
  );
});

// Simplified and robust Area Chart component with all metrics support
const SimpleAreaChart = memo(({ data, visibleMetrics, shouldShowPredictionLine, predictionDate }: any) => {
  if (!validateChartData(data)) {
    return null;
  }

  return (
    <AreaChart
      data={data}
      margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
    >
      <defs>
        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
        </linearGradient>
        <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
        </linearGradient>
        <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
      <XAxis
        dataKey="date"
        tickFormatter={(value) => {
          try {
            return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          } catch {
            return value;
          }
        }}
        stroke="rgba(0, 0, 0, 0.6)"
      />
      <YAxis
        yAxisId="left"
        stroke="rgba(0, 0, 0, 0.6)"
        tickFormatter={(value) => `$${value.toLocaleString()}`}
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        stroke="rgba(0, 0, 0, 0.6)"
        tickFormatter={(value) => value.toLocaleString()}
      />
      <Tooltip
        labelFormatter={(label) => {
          try {
            return new Date(label).toLocaleDateString();
          } catch {
            return label;
          }
        }}
        formatter={(value: number, name: string) => {
          if (name === 'Revenue') return [`$${value.toLocaleString()}`, name];
          if (name === 'Orders') return [value.toLocaleString(), name];
          if (name === 'Conversion Rate') return [`${value.toFixed(2)}%`, name];
          return [value.toLocaleString(), name];
        }}
      />
      <Legend />
      {visibleMetrics.revenue && (
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#revenueGradient)"
          name="Revenue"
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.orders && (
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="orders_count"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#ordersGradient)"
          name="Orders"
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.conversion && (
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="conversion_rate"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#conversionGradient)"
          name="Conversion Rate"
          isAnimationActive={false}
        />
      )}
      {shouldShowPredictionLine && predictionDate && (
        <ReferenceLine
          x={predictionDate}
          stroke="rgba(0, 0, 0, 0.3)"
          strokeDasharray="3 3"
          label="Predictions"
        />
      )}
    </AreaChart>
  );
});

// Simplified and robust Bar Chart component with all metrics support
const SimpleBarChart = memo(({ data, visibleMetrics, shouldShowPredictionLine, predictionDate }: any) => {
  if (!validateChartData(data)) {
    return null;
  }

  return (
    <BarChart
      data={data}
      margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
      <XAxis
        dataKey="date"
        tickFormatter={(value) => {
          try {
            return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          } catch {
            return value;
          }
        }}
        stroke="rgba(0, 0, 0, 0.6)"
      />
      <YAxis
        yAxisId="left"
        stroke="rgba(0, 0, 0, 0.6)"
        tickFormatter={(value) => `$${value.toLocaleString()}`}
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        stroke="rgba(0, 0, 0, 0.6)"
        tickFormatter={(value) => value.toLocaleString()}
      />
      <Tooltip
        labelFormatter={(label) => {
          try {
            return new Date(label).toLocaleDateString();
          } catch {
            return label;
          }
        }}
        formatter={(value: number, name: string) => {
          if (name === 'Revenue') return [`$${value.toLocaleString()}`, name];
          if (name === 'Orders') return [value.toLocaleString(), name];
          if (name === 'Conversion Rate') return [`${value.toFixed(2)}%`, name];
          return [value.toLocaleString(), name];
        }}
      />
      <Legend />
      {visibleMetrics.revenue && (
        <Bar
          yAxisId="left"
          dataKey="revenue"
          fill="#2563eb"
          name="Revenue"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.orders && (
        <Bar
          yAxisId="right"
          dataKey="orders_count"
          fill="#10b981"
          name="Orders"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.conversion && (
        <Bar
          yAxisId="right"
          dataKey="conversion_rate"
          fill="#f59e0b"
          name="Conversion Rate"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
      )}
      {shouldShowPredictionLine && predictionDate && (
        <ReferenceLine
          x={predictionDate}
          stroke="rgba(0, 0, 0, 0.3)"
          strokeDasharray="3 3"
          label="Predictions"
        />
      )}
    </BarChart>
  );
});

const UnifiedAnalyticsChart: React.FC<UnifiedAnalyticsChartProps> = ({
  data,
  loading = false,
  error = null,
  height = CHART_DIMENSIONS.DEFAULT_HEIGHT,
}) => {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [showPredictions, setShowPredictions] = useState(true);
  const [visibleMetrics, setVisibleMetrics] = useState({
    revenue: true,
    orders: true,
    conversion: false,
  });

  const chartHeight = ensureMinHeight(height);

  // Process and validate chart data
  const chartData = useMemo(() => {
    debugLog.info('=== CHART DATA PROCESSING STARTED ===', {
      hasData: !!data,
      hasHistorical: !!(data && data.historical),
      isHistoricalArray: Array.isArray(data?.historical),
      dataKeys: data ? Object.keys(data) : [],
      loading,
      error,
    }, 'UnifiedAnalyticsChart');

    if (!data || !data.historical || !Array.isArray(data.historical)) {
      return [];
    }

    try {
      // Process historical data
      const processedHistorical = data.historical.map(processHistoricalItem);
      
      // Process predictions if enabled
      let processedPredictions: any[] = [];
      if (showPredictions && data.predictions && Array.isArray(data.predictions)) {
        processedPredictions = data.predictions.map(processHistoricalItem);
      }

      // Combine and sort data
      const combinedData = [...processedHistorical, ...processedPredictions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      debugLog.info('Processed chart data', {
        totalPoints: combinedData.length,
        historicalPoints: processedHistorical.length,
        predictionPoints: processedPredictions.length,
        hasValidData: validateChartData(combinedData)
      }, 'UnifiedAnalyticsChart');

      return combinedData;
    } catch (error) {
      debugLog.error('Error processing chart data', { error }, 'UnifiedAnalyticsChart');
      return [];
    }
  }, [data, showPredictions]);

  const handleChartTypeChange = (newType: ChartType) => {
    if (newType && newType !== chartType) {
      debugLog.info('Chart type change', { oldType: chartType, newType }, 'UnifiedAnalyticsChart');
      setChartType(newType);
    }
  };

  const handleMetricToggle = (metric: keyof typeof visibleMetrics) => {
    setVisibleMetrics(prev => ({
      ...prev,
      [metric]: !prev[metric],
    }));
  };

  // Render loading state
  if (loading) {
    return <LoadingIndicator height={chartHeight} message="Loading analytics data…" />;
  }

  // Render error state
  if (error) {
    return (
      <Box
        sx={{
          height: chartHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: 'rgba(255, 0, 0, 0.05)',
          borderRadius: 2,
          border: '1px solid rgba(255, 0, 0, 0.1)',
          p: 3,
        }}
      >
        <Typography variant="h6" color="error" textAlign="center">
          Failed to load analytics data
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {error}
        </Typography>
      </Box>
    );
  }

  // Render no data state
  if (!data || !validateChartData(chartData)) {
    return (
      <Box
        sx={{
          height: chartHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
          borderRadius: 2,
          border: '1px solid rgba(0, 0, 0, 0.1)',
          p: 3,
        }}
      >
        <Typography variant="h6" color="text.secondary" textAlign="center">
          No analytics data available
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Data will appear here once your store starts receiving orders.
        </Typography>
      </Box>
    );
  }

  const shouldShowPredictionLine = showPredictions && 
    data && 
    data.predictions && 
    data.predictions.length > 0;
  
  const predictionDate = shouldShowPredictionLine ? data.predictions[0]?.date : undefined;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Chart Controls */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={(_, value) => value && handleChartTypeChange(value)}
          size="small"
        >
          <ToggleButton value="area" aria-label="Area Chart">
            <Timeline /> Area
          </ToggleButton>
          <ToggleButton value="line" aria-label="Line Chart">
            <ShowChart /> Line
          </ToggleButton>
          <ToggleButton value="bar" aria-label="Bar Chart">
            <BarChartIcon /> Bar
          </ToggleButton>
        </ToggleButtonGroup>

        <FormControlLabel
          control={
            <Switch
              checked={showPredictions}
              onChange={(e) => setShowPredictions(e.target.checked)}
              size="small"
            />
          }
          label="Show Predictions"
        />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label="Revenue"
            color={visibleMetrics.revenue ? 'primary' : 'default'}
            onClick={() => handleMetricToggle('revenue')}
            size="small"
          />
          <Chip
            label="Orders"
            color={visibleMetrics.orders ? 'primary' : 'default'}
            onClick={() => handleMetricToggle('orders')}
            size="small"
          />
          <Chip
            label="Conversion"
            color={visibleMetrics.conversion ? 'primary' : 'default'}
            onClick={() => handleMetricToggle('conversion')}
            size="small"
          />
        </Box>
      </Box>

      {/* Chart Container */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          backgroundColor: '#fff',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: 2,
        }}
      >
        <Box sx={{ height: chartHeight }}>
          <ChartErrorBoundary fallbackHeight={chartHeight}>
            <ResponsiveContainer width="100%" height="100%">
              {(() => {
                switch (chartType) {
                  case 'line':
                    return (
                      <SimpleLineChart
                        data={chartData}
                        visibleMetrics={visibleMetrics}
                        shouldShowPredictionLine={shouldShowPredictionLine}
                        predictionDate={predictionDate}
                      />
                    );
                  case 'bar':
                    return (
                      <SimpleBarChart
                        data={chartData}
                        visibleMetrics={visibleMetrics}
                        shouldShowPredictionLine={shouldShowPredictionLine}
                        predictionDate={predictionDate}
                      />
                    );
                  default:
                    return (
                      <SimpleAreaChart
                        data={chartData}
                        visibleMetrics={visibleMetrics}
                        shouldShowPredictionLine={shouldShowPredictionLine}
                        predictionDate={predictionDate}
                      />
                    );
                }
              })()}
            </ResponsiveContainer>
          </ChartErrorBoundary>
        </Box>

        {/* Chart Summary */}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {chartData.length} data points • Last updated: {new Date().toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total Revenue: ${data.total_revenue?.toLocaleString() || '0'}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default UnifiedAnalyticsChart; 