import React, { useState, useMemo, useLayoutEffect, useRef } from 'react';
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
import type { TooltipProps, ChartPayload, UnifiedDatum, PredictionPoint } from '../../types/charts';
import { useMediaQuery, useTheme } from '@mui/material';

interface HistoricalData {
  date: string;
  revenue: number;
  orders_count: number;
  conversion_rate: number;
  avg_order_value: number;
}

interface PredictionData {
  date: string;
  revenue: number;
  orders_count: number;
  conversion_rate: number;
  avg_order_value: number;
  confidence_interval: {
    revenue_min: number;
    revenue_max: number;
    orders_min: number;
    orders_max: number;
  };
  prediction_type: string;
  confidence_score: number;
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

// Helper function to safely get numeric value
const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return defaultValue;
  }
  return Number(value);
};

// Helper function to safely process historical data item
const processHistoricalItem = (item: any) => {
  return {
    date: item.date || '',
    revenue: safeNumber(item.revenue),
    orders_count: safeNumber(item.orders_count),
    conversion_rate: safeNumber(item.conversion_rate),
    avg_order_value: safeNumber(item.avg_order_value),
  };
};

const UnifiedAnalyticsChart: React.FC<UnifiedAnalyticsChartProps> = ({
  data,
  loading = false,
  error = null,
  height = 500,
}) => {
  const [chartType, setChartType] = useState<ChartType>('combined');
  const [showPredictions, setShowPredictions] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [visibleMetrics, setVisibleMetrics] = useState({
    revenue: true,
    orders: true,
    conversion: true,
  });
  const [predictionLoading, setPredictionLoading] = useState(false);

  // Generate a unique id prefix for gradient defs to avoid DOM ID collisions
  const gradientIdPrefix = useMemo(() => {
    return `ua-${Math.random().toString(36).substring(2, 8)}`;
  }, []);

  // Process and combine historical and prediction data with error handling
  const chartData = useMemo(() => {
    try {
      if (!data || !data.historical || !Array.isArray(data.historical)) {
        console.log('UnifiedAnalyticsChart: No valid data available');
        return [];
      }

      let historical = data.historical.map(processHistoricalItem);
      
      // Apply time range filter
      if (timeRange !== 'all') {
        const days = timeRange === 'last30' ? 30 : 7;
        historical = historical.slice(-days);
      }

      const combinedData = historical.map((item, index) => ({
        ...item,
        key: `historical-${item.date}-${index}`,
        type: 'historical',
        isPrediction: false,
        // Ensure all numeric values are valid
        revenue: safeNumber(item.revenue),
        orders_count: safeNumber(item.orders_count),
        conversion_rate: safeNumber(item.conversion_rate),
        avg_order_value: safeNumber(item.avg_order_value),
      }));

      // Add predictions if enabled and available
      if (showPredictions && data.predictions && Array.isArray(data.predictions)) {
        const predictions = data.predictions.map((item, index) => {
          const ci = item.confidence_interval || {};
          return {
            date: item.date || '',
            key: `prediction-${item.date}-${index}`,
            revenue: safeNumber(item.revenue),
            orders_count: safeNumber(item.orders_count),
            conversion_rate: safeNumber(item.conversion_rate),
            avg_order_value: safeNumber(item.avg_order_value),
            type: 'prediction',
            isPrediction: true,
            confidence_score: safeNumber(item.confidence_score, 0),
            revenue_min: safeNumber(ci.revenue_min),
            revenue_max: safeNumber(ci.revenue_max),
            orders_min: safeNumber(ci.orders_min),
            orders_max: safeNumber(ci.orders_max),
          };
        });
        combinedData.push(...predictions);
      }

      // Filter out any invalid entries
      const validData = combinedData.filter(item => 
        item.date && 
        typeof item.revenue === 'number' && 
        !isNaN(item.revenue) &&
        typeof item.orders_count === 'number' &&
        !isNaN(item.orders_count)
      );

      console.log('UnifiedAnalyticsChart: Processed chart data:', {
        totalPoints: validData.length,
        historicalPoints: validData.filter(d => !d.isPrediction).length,
        predictionPoints: validData.filter(d => d.isPrediction).length,
        hasValidData: validData.length > 0
      });

      return validData;
    } catch (err) {
      console.error('Error processing chart data:', err);
      return [];
    }
  }, [data, timeRange, showPredictions]);

  // Calculate summary statistics with error handling
  const stats = useMemo(() => {
    try {
      if (!data || !data.historical || !Array.isArray(data.historical) || data.historical.length === 0) {
        console.log('UnifiedAnalyticsChart: No historical data for stats calculation');
        return null;
      }

      const historical = data.historical.map(processHistoricalItem);
      const recent7Days = historical.slice(-7);
      const previous7Days = historical.slice(-14, -7);

      const recentRevenue = recent7Days.reduce((sum, item) => sum + safeNumber(item.revenue), 0);
      const previousRevenue = previous7Days.reduce((sum, item) => sum + safeNumber(item.revenue), 0);
      const revenueChange = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      const recentOrders = recent7Days.reduce((sum, item) => sum + safeNumber(item.orders_count), 0);
      const previousOrders = previous7Days.reduce((sum, item) => sum + safeNumber(item.orders_count), 0);
      const ordersChange = previousOrders > 0 ? ((recentOrders - previousOrders) / previousOrders) * 100 : 0;

      const avgConversion = recent7Days.length > 0 ? 
        recent7Days.reduce((sum, item) => sum + safeNumber(item.conversion_rate), 0) / recent7Days.length : 0;
      const prevAvgConversion = previous7Days.length > 0 ? 
        previous7Days.reduce((sum, item) => sum + safeNumber(item.conversion_rate), 0) / previous7Days.length : 0;
      const conversionChange = prevAvgConversion > 0 ? ((avgConversion - prevAvgConversion) / prevAvgConversion) * 100 : 0;

      // Future predictions summary
      const futurePredictions = (data.predictions && Array.isArray(data.predictions)) ? data.predictions.slice(0, 30) : [];
      const predictedRevenue = futurePredictions.reduce((sum, item) => sum + safeNumber(item.revenue), 0);

      return {
        current: {
          revenue: recentRevenue,
          orders: recentOrders,
          conversion: avgConversion,
        },
        changes: {
          revenue: revenueChange,
          orders: ordersChange,
          conversion: conversionChange,
        },
        predictions: {
          revenue: predictedRevenue,
          days: futurePredictions.length,
        },
      };
    } catch (err) {
      console.error('Error calculating stats:', err);
      return null;
    }
  }, [data]);

  const formatXAxisTick = (tickItem: string) => {
    try {
      const date = new Date(tickItem);
      if (isNaN(date.getTime())) return tickItem;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return tickItem;
    }
  };

  const formatYAxisTick = (value: number, axis: 'revenue' | 'orders' | 'conversion') => {
    try {
      const numValue = safeNumber(value);
      switch (axis) {
        case 'revenue':
          if (numValue >= 1000000) return `$${(numValue / 1000000).toFixed(1)}M`;
          if (numValue >= 1000) return `$${(numValue / 1000).toFixed(1)}K`;
          return `$${numValue.toFixed(0)}`;
        case 'orders':
          return Math.round(numValue).toString();
        case 'conversion':
          return `${numValue.toFixed(1)}%`;
        default:
          return numValue.toString();
      }
    } catch {
      return value.toString();
    }
  };

  const CustomTooltip: React.FC<TooltipProps<UnifiedDatum>> = ({ active, payload, label }) => {
    try {
      if (active && payload && payload.length) {
        const entry = payload[0] as ChartPayload<UnifiedDatum>;
        const data = entry.payload;
        // Better detection that works with latest dataset structure
        const isPrediction = (data as any).isPrediction === true || data.kind === 'prediction';

        return (
          <Paper
            elevation={12}
            sx={{
              p: 2.5,
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              border: isPrediction ? '2px solid #e3f2fd' : '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 3,
              minWidth: 280,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              {isPrediction && <AutoGraph color="primary" fontSize="small" />}
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                {(() => {
                  if (typeof label === 'string' || typeof label === 'number') {
                    const d = new Date(label);
                    if (!Number.isNaN(d.getTime())) {
                      return d.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      });
                    }
                  }
                  return String(label);
                })()}
              </Typography>
              {isPrediction && (
                <Chip
                  size="small"
                  label={
                    (data as PredictionPoint).confidence_score !== undefined && (data as PredictionPoint).confidence_score !== null
                      ? `${Math.round(safeNumber((data as PredictionPoint).confidence_score) * 100)}% confidence`
                      : 'Prediction'
                  }
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
            
            <Divider sx={{ mb: 1.5 }} />
            
            {(payload as ChartPayload<UnifiedDatum>[]).map((entry, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: entry.color,
                    }}
                  />
                  <Typography variant="body2" fontWeight={500}>
                    {entry.dataKey === 'revenue' && 'Revenue'}
                    {entry.dataKey === 'orders_count' && 'Orders'}
                    {entry.dataKey === 'conversion_rate' && 'Conversion'}
                    {entry.dataKey === 'avg_order_value' && 'AOV'}
                  </Typography>
                </Box>
                <Typography variant="body2" fontWeight={600}>
                  {entry.dataKey === 'revenue' && `$${safeNumber(entry.value).toLocaleString()}`}
                  {entry.dataKey === 'orders_count' && safeNumber(entry.value)}
                  {entry.dataKey === 'conversion_rate' && `${safeNumber(entry.value).toFixed(1)}%`}
                  {entry.dataKey === 'avg_order_value' && `$${safeNumber(entry.value).toFixed(2)}`}
                </Typography>
              </Box>
            ))}
            
            {isPrediction && (data as PredictionPoint).revenue_min !== undefined && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Confidence Range
                </Typography>
                <Typography variant="body2" fontSize="0.8rem">
                  Revenue: ${safeNumber((data as PredictionPoint).revenue_min).toLocaleString()} - ${safeNumber((data as PredictionPoint).revenue_max).toLocaleString()}
                </Typography>
                <Typography variant="body2" fontSize="0.8rem">
                  Orders: {safeNumber((data as PredictionPoint).orders_min)} - {safeNumber((data as PredictionPoint).orders_max)}
                </Typography>
              </Box>
            )}
          </Paper>
        );
      }
      return null;
    } catch (err) {
      console.error('Error rendering tooltip:', err);
      return null;
    }
  };

  // ------------------------------------------------------------------
  // Responsive helpers – detect small/mobile screens so we can adjust
  // toggle button layout (icons-only on very small screens, scrollbar
  // for overflow, etc.).
  // ------------------------------------------------------------------

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Render different chart types based on selection
  const renderChart = () => {
    try {
      // Validate chart data before rendering
      if (!chartData || chartData.length === 0) {
        console.warn('UnifiedAnalyticsChart: No chart data available for rendering');
        return (
          <Box sx={{ 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 2
          }}>
            <Typography variant="h6" color="text.secondary">
              No data to display
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Chart data is being processed...
            </Typography>
          </Box>
        );
      }

      const commonProps = {
        data: chartData,
        margin: { top: 20, right: 30, left: 20, bottom: 20 },
      };

      const commonXAxis = (
        <XAxis
          dataKey="date"
          tickFormatter={formatXAxisTick}
          stroke="rgba(0, 0, 0, 0.4)"
          tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(0, 0, 0, 0.1)' }}
          label={{
            value: 'Date',
            position: 'insideBottomRight',
            offset: -6,
            fill: 'rgba(0, 0, 0, 0.54)',
            fontSize: 12,
          }}
        />
      );

      const commonYAxisRevenue = (
        <YAxis
          yAxisId="revenue"
          orientation="left"
          tickFormatter={(value) => formatYAxisTick(value, 'revenue')}
          stroke="rgba(0, 0, 0, 0.4)"
          tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 11 }}
          label={{
            value: 'Revenue (USD)',
            angle: -90,
            position: 'insideLeft',
            offset: -10,
            fill: 'rgba(0, 0, 0, 0.54)',
            fontSize: 12,
          }}
        />
      );

      const commonYAxisOrders = (
        <YAxis
          yAxisId="orders"
          orientation="right"
          tickFormatter={(value) => formatYAxisTick(value, 'orders')}
          stroke="rgba(0, 0, 0, 0.4)"
          tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 11 }}
          label={{
            value: 'Orders',
            angle: 90,
            position: 'insideRight',
            offset: 10,
            fill: 'rgba(0, 0, 0, 0.54)',
            fontSize: 12,
          }}
        />
      );

      const commonGrid = (
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.06)" />
      );

      const commonTooltip = <Tooltip content={<CustomTooltip />} />;
      const commonLegend = <Legend />;

      const shouldShowPredictionLine = showPredictions && data?.predictions && data.predictions.length > 0;

      switch (chartType) {
        case 'line':
          return (
            <LineChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxisRevenue}
              {commonTooltip}
              {commonLegend}
              {visibleMetrics.revenue && (
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={3}
                  name="Revenue"
                  dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                />
              )}
              {visibleMetrics.orders && (
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="orders_count"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Orders"
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                />
              )}
              {shouldShowPredictionLine && data?.predictions?.[0]?.date && (
                <ReferenceLine
                  x={data.predictions[0].date}
                  stroke="rgba(0, 0, 0, 0.3)"
                  strokeDasharray="2,2"
                  label="Predictions"
                />
              )}
            </LineChart>
          );

        case 'area':
          return (
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={`${gradientIdPrefix}-revenueGradient`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              {commonGrid}
              {commonXAxis}
              {commonYAxisRevenue}
              {commonTooltip}
              {commonLegend}
              {visibleMetrics.revenue && (
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill={`url(#${gradientIdPrefix}-revenueGradient)`}
                  name="Revenue"
                  dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                />
              )}
              {shouldShowPredictionLine && data?.predictions?.[0]?.date && (
                <ReferenceLine
                  x={data.predictions[0].date}
                  stroke="rgba(0, 0, 0, 0.3)"
                  strokeDasharray="2,2"
                  label="Predictions"
                />
              )}
            </AreaChart>
          );

        case 'bar':
          return (
            <BarChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxisRevenue}
              {commonTooltip}
              {commonLegend}
              {visibleMetrics.revenue && (
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  fill="#2563eb"
                  name="Revenue"
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                />
              )}
              {shouldShowPredictionLine && data?.predictions?.[0]?.date && (
                <ReferenceLine
                  x={data.predictions[0].date}
                  stroke="rgba(0, 0, 0, 0.3)"
                  strokeDasharray="2,2"
                  label="Predictions"
                />
              )}
            </BarChart>
          );

        case 'candlestick':
          return (
            <ComposedChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxisRevenue}
              {commonTooltip}
              {commonLegend}
              {visibleMetrics.revenue && (
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  fill="#10b981"
                  name="Revenue"
                  radius={[2, 2, 0, 0]}
                  opacity={0.8}
                />
              )}
              {visibleMetrics.orders && (
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="orders_count"
                  stroke="#6b7280"
                  strokeWidth={1}
                  name="Orders"
                  dot={false}
                />
              )}
              {shouldShowPredictionLine && data?.predictions?.[0]?.date && (
                <ReferenceLine
                  x={data.predictions[0].date}
                  stroke="rgba(0, 0, 0, 0.3)"
                  strokeDasharray="2,2"
                  label="Predictions"
                />
              )}
            </ComposedChart>
          );

        case 'waterfall':
          return (
            <ComposedChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxisRevenue}
              {commonTooltip}
              {commonLegend}
              {visibleMetrics.revenue && (
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  fill="#10b981"
                  name="Revenue"
                  radius={[2, 2, 0, 0]}
                  opacity={0.8}
                />
              )}
              {visibleMetrics.orders && (
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="orders_count"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Orders"
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
                />
              )}
              {shouldShowPredictionLine && data?.predictions?.[0]?.date && (
                <ReferenceLine
                  x={data.predictions[0].date}
                  stroke="rgba(0, 0, 0, 0.3)"
                  strokeDasharray="2,2"
                  label="Predictions"
                />
              )}
            </ComposedChart>
          );

        case 'stacked':
          return (
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={`${gradientIdPrefix}-stackedRevenueGradient`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={`${gradientIdPrefix}-ordersGradient`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              {commonGrid}
              {commonXAxis}
              {commonYAxisRevenue}
              {commonTooltip}
              {commonLegend}
              {visibleMetrics.revenue && (
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill={`url(#${gradientIdPrefix}-stackedRevenueGradient)`}
                  name="Revenue"
                  stackId="1"
                />
              )}
              {visibleMetrics.orders && (
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="orders_count"
                  stroke="#10b981"
                  strokeWidth={1}
                  fill={`url(#${gradientIdPrefix}-ordersGradient)`}
                  name="Orders"
                  stackId="2"
                />
              )}
              {shouldShowPredictionLine && data?.predictions?.[0]?.date && (
                <ReferenceLine
                  x={data.predictions[0].date}
                  stroke="rgba(0, 0, 0, 0.3)"
                  strokeDasharray="2,2"
                  label="Predictions"
                />
              )}
            </AreaChart>
          );

        case 'composed':
        case 'combined':
          return (
            <ComposedChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxisRevenue}
              {commonYAxisOrders}
              {commonTooltip}
              {commonLegend}
              
              {visibleMetrics.revenue && (
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  fill="#2563eb"
                  name="Revenue"
                  radius={[2, 2, 0, 0]}
                  opacity={0.8}
                />
              )}
              
              {visibleMetrics.orders && (
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="orders_count"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="Orders"
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                  strokeDasharray={showPredictions ? "5,5" : ""}
                />
              )}
              
              {visibleMetrics.conversion && (
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="conversion_rate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Conversion Rate (%)"
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 2 }}
                  strokeDasharray={showPredictions ? "3,3" : ""}
                />
              )}
              
              {shouldShowPredictionLine && data?.predictions?.[0]?.date && (
                <ReferenceLine
                  x={data.predictions[0].date}
                  stroke="rgba(0, 0, 0, 0.3)"
                  strokeDasharray="2,2"
                  label="Predictions"
                />
              )}
            </ComposedChart>
          );

        case 'revenue_focus':
          return (
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={`${gradientIdPrefix}-revenueFocusGradient`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              {commonGrid}
              {commonXAxis}
              {commonYAxisRevenue}
              {commonTooltip}
              {commonLegend}
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={4}
                fill={`url(#${gradientIdPrefix}-revenueFocusGradient)`}
                name="Revenue"
                dot={{ fill: '#2563eb', strokeWidth: 3, r: 5 }}
              />
              {shouldShowPredictionLine && data?.predictions?.[0]?.date && (
                <ReferenceLine
                  x={data.predictions[0].date}
                  stroke="rgba(0, 0, 0, 0.3)"
                  strokeDasharray="2,2"
                  label="Predictions"
                />
              )}
            </AreaChart>
          );

        default:
          return (
            <ComposedChart {...commonProps}>
              {commonGrid}
              {commonXAxis}
              {commonYAxisRevenue}
              {commonYAxisOrders}
              {commonTooltip}
              {commonLegend}
              
              {visibleMetrics.revenue && (
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  fill="#2563eb"
                  name="Revenue"
                  radius={[2, 2, 0, 0]}
                  opacity={0.8}
                />
              )}
              
              {visibleMetrics.orders && (
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="orders_count"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="Orders"
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
                  strokeDasharray={showPredictions ? "5,5" : ""}
                />
              )}
              
              {visibleMetrics.conversion && (
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="conversion_rate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Conversion Rate (%)"
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 2 }}
                  strokeDasharray={showPredictions ? "3,3" : ""}
                />
              )}
              
              {shouldShowPredictionLine && data?.predictions?.[0]?.date && (
                <ReferenceLine
                  x={data.predictions[0].date}
                  stroke="rgba(0, 0, 0, 0.3)"
                  strokeDasharray="2,2"
                  label="Predictions"
                />
              )}
            </ComposedChart>
          );
      }
    } catch (error) {
      console.error('Error rendering chart:', error);
      return (
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2
        }}>
          <Typography variant="h6" color="text.secondary">
            Chart Rendering Error
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Unable to render the selected chart type. Please try a different chart type.
          </Typography>
        </Box>
      );
    }
  };

  // ============================================
  // ResizeObserver gate – only render the chart
  // once the container has a measurable width.
  // This prevents Recharts from throwing errors
  // when mounted inside hidden or zero-width
  // containers (e.g. before layout is ready).
  // ============================================

  const [containerReady, setContainerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    if (containerRef.current.offsetWidth > 0) {
      setContainerReady(true);
      return;
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerReady(true);
          ro.disconnect();
          break;
        }
      }
    });

    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (loading) {
    return <LoadingIndicator height={height} message="Loading analytics data…" />;
  }

  if (error) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: 'rgba(255, 0, 0, 0.02)',
          borderRadius: 2,
          border: '1px solid rgba(255, 0, 0, 0.1)',
        }}
      >
        <Typography variant="h6" color="error">
          Failed to load analytics data
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      </Box>
    );
  }

  // Enhanced data validation
  const hasValidData = data && 
    data.historical && 
    Array.isArray(data.historical) && 
    data.historical.length > 0 &&
    chartData &&
    chartData.length > 0;

  if (!hasValidData) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
          borderRadius: 2,
        }}
      >
        <Analytics sx={{ fontSize: 48, color: 'rgba(0, 0, 0, 0.2)' }} />
        <Typography variant="body2" color="text.secondary">
          No analytics data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      {/* Header with Controls */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Analytics color="primary" />
            Advanced Analytics & Forecasts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Revenue, orders, and conversion rate with 60-day forecasting
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
          {/*
            Chart-type selector – on mobile we switch to a horizontally
            scrollable, icons-only (to save space) list. On larger
            screens we render the existing label + icon combination.
          */}
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_, newType) => newType && setChartType(newType)}
            size="small"
            sx={{
              overflowX: 'auto',
              flexWrap: isMobile ? 'nowrap' : 'wrap',
              maxWidth: '100%',
              '& .MuiToggleButton-root': {
                flex: '0 0 auto',
                px: isMobile ? 1.2 : 2,
              },
            }}
          >
            <ToggleButton value="combined">
              <Analytics fontSize="small" />
              {!isMobile && 'Combined'}
            </ToggleButton>
            <ToggleButton value="revenue_focus">
              <ShowChart fontSize="small" />
              {!isMobile && 'Revenue Focus'}
            </ToggleButton>
            <ToggleButton value="line">
              <ShowChart fontSize="small" />
              {!isMobile && 'Line'}
            </ToggleButton>
            <ToggleButton value="area">
              <Timeline fontSize="small" />
              {!isMobile && 'Area'}
            </ToggleButton>
            <ToggleButton value="bar">
              <BarChartIcon fontSize="small" />
              {!isMobile && 'Bar'}
            </ToggleButton>
            <ToggleButton value="candlestick">
              <CandlestickChart fontSize="small" />
              {!isMobile && 'Candle'}
            </ToggleButton>
            <ToggleButton value="waterfall">
              <WaterfallChart fontSize="small" />
              {!isMobile && 'Waterfall'}
            </ToggleButton>
            <ToggleButton value="stacked">
              <StackedLineChart fontSize="small" />
              {!isMobile && 'Stacked'}
            </ToggleButton>
            <ToggleButton value="composed">
              <Analytics fontSize="small" />
              {!isMobile && 'Composed'}
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Modern Prediction Controls */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
            {/* AI Prediction Toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ToggleButton
                value={showPredictions ? "on" : "off"}
                selected={showPredictions}
                onChange={() => {
                  if (!showPredictions) {
                    setPredictionLoading(true);
                    // Simulate loading for better UX
                    setTimeout(() => {
                      setShowPredictions(true);
                      setPredictionLoading(false);
                    }, 800);
                  } else {
                    setShowPredictions(false);
                  }
                }}
                disabled={predictionLoading}
                sx={{
                  minWidth: 200,
                  background: showPredictions ? 
                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                    'transparent',
                  border: showPredictions ? 'none' : '2px solid rgba(102, 126, 234, 0.3)',
                  color: showPredictions ? 'white' : 'primary.main',
                  fontWeight: 600,
                  borderRadius: 3,
                  py: 1.5,
                  px: 3,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: showPredictions ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: showPredictions ? 
                    '0 8px 25px rgba(102, 126, 234, 0.3)' : 
                    '0 2px 8px rgba(0, 0, 0, 0.1)',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: showPredictions ? 
                      '0 12px 35px rgba(102, 126, 234, 0.4)' : 
                      '0 4px 15px rgba(102, 126, 234, 0.2)',
                    background: showPredictions ? 
                      'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)' : 
                      'rgba(102, 126, 234, 0.05)',
                  },
                  '&.Mui-selected': {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                  },
                }}
              >
                {predictionLoading ? (
                  <AutoGraph sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
                ) : (
                  showPredictions ? <Stop /> : <AutoFixHigh />
                )}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', ml: 1 }}>
                  <Typography variant="button" fontWeight="inherit">
                    {predictionLoading ? 'Analyzing your data…' : (showPredictions ? 'Stop Predictions' : 'Predict Future')}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
                    {predictionLoading ? 'Our AI models are processing your forecast…' : (showPredictions ? 'Hide AI forecasting' : 'AI-powered 60-day forecast')}
                  </Typography>
                </Box>
              </ToggleButton>

              {/* Prediction Confidence Indicator */}
              {showPredictions && data?.predictions?.length > 0 && (
                <MuiTooltip title={`Prediction confidence: ${Math.round((data.predictions[0]?.confidence_score || 0) * 100)}%`}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(34, 197, 94, 0.1) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      animation: 'pulse 2s infinite',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.7 },
                      },
                    }}
                  >
                    <Insights color="success" fontSize="small" />
                    <Typography variant="caption" fontWeight={600} color="success.main">
                      {Math.round((data.predictions[0]?.confidence_score || 0) * 100)}% Confidence
                    </Typography>
                  </Box>
                </MuiTooltip>
              )}
            </Box>

            {/* Time Range Selector */}
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(_, newRange) => newRange && setTimeRange(newRange)}
              size="small"
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: 2,
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: 1.5,
                  px: 2,
                  py: 0.5,
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  },
                },
              }}
            >
              <ToggleButton value="last7">7D</ToggleButton>
              <ToggleButton value="last30">30D</ToggleButton>
              <ToggleButton value="all">All</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Box>

      {/* Summary Statistics */}
      {stats && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Card elevation={0} sx={{ border: '1px solid rgba(0, 0, 0, 0.1)', flex: 1, minWidth: 200 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Revenue (7d)
                  </Typography>
                  <Typography variant="h6" color="primary" fontWeight={600}>
                    ${stats.current.revenue.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {stats.changes.revenue >= 0 ? (
                    <TrendingUp color="success" fontSize="small" />
                  ) : (
                    <TrendingDown color="error" fontSize="small" />
                  )}
                  <Typography
                    variant="body2"
                    color={stats.changes.revenue >= 0 ? 'success.main' : 'error.main'}
                    fontWeight={600}
                  >
                    {Math.abs(stats.changes.revenue).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid rgba(0, 0, 0, 0.1)', flex: 1, minWidth: 200 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Orders (7d)
                  </Typography>
                  <Typography variant="h6" color="success.main" fontWeight={600}>
                    {stats.current.orders}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {stats.changes.orders >= 0 ? (
                    <TrendingUp color="success" fontSize="small" />
                  ) : (
                    <TrendingDown color="error" fontSize="small" />
                  )}
                  <Typography
                    variant="body2"
                    color={stats.changes.orders >= 0 ? 'success.main' : 'error.main'}
                    fontWeight={600}
                  >
                    {Math.abs(stats.changes.orders).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: '1px solid rgba(0, 0, 0, 0.1)', flex: 1, minWidth: 200 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Next 30d Forecast
                  </Typography>
                  <Typography variant="h6" color="info.main" fontWeight={600}>
                    ${stats.predictions.revenue.toLocaleString()}
                  </Typography>
                </Box>
                <MuiTooltip title="Predicted revenue for the next 30 days">
                  <IconButton size="small">
                    <InfoOutlined fontSize="small" />
                  </IconButton>
                </MuiTooltip>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Metric Visibility Controls */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {Object.entries(visibleMetrics).map(([key, visible]) => (
          <Chip
            key={key}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
            onClick={() => setVisibleMetrics(prev => ({ ...prev, [key]: !visible }))}
            color={visible ? 'primary' : 'default'}
            variant={visible ? 'filled' : 'outlined'}
            size="small"
            icon={visible ? <Visibility /> : <VisibilityOff />}
          />
        ))}
      </Box>

      {/* Chart Container */}
      <Paper
        ref={containerRef}
        elevation={0}
        sx={{
          p: 3,
          backgroundColor: '#fff',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {containerReady && (
          <ResponsiveContainer width="100%" height={height}>
            {renderChart()}
          </ResponsiveContainer>
        )}
        
        {/* Watermark */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 12,
            fontSize: '0.7rem',
            color: 'text.secondary',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            border: '1px solid rgba(0, 0, 0, 0.08)',
          }}
        >
          🚀 AI-Powered Advanced Analytics
        </Box>
      </Paper>

      {/* Enhanced Predictions Info Panel */}
      {showPredictions && data.predictions && data.predictions.length > 0 && (
        <Box 
          sx={{ 
            mt: 2, 
            p: 2,
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(34, 197, 94, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                🔮 AI Predictions Active
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Showing <strong>{data.predictions.length}-day forecast</strong> using advanced algorithms including 
                linear regression, moving averages, and seasonal patterns.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ⚡ Algorithms: Linear Regression • Moving Averages • Seasonal Decomposition
              </Typography>
            </Box>
            <Chip
              icon={<Insights />}
              label={`${Math.round((data.predictions[0]?.confidence_score || 0) * 100)}% Confidence`}
              size="small"
              color="success"
              variant="outlined"
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default UnifiedAnalyticsChart; 