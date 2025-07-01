import React, { useState, useMemo } from 'react';
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
  Alert,
  IconButton,
  Button,
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

  // Process and combine historical and prediction data
  const chartData = useMemo(() => {
    if (!data || !data.historical) return [];

    let historical = [...data.historical];
    
    // Apply time range filter
    if (timeRange !== 'all') {
      const days = timeRange === 'last30' ? 30 : 7;
      historical = historical.slice(-days);
    }

    const combinedData = historical.map(item => ({
      ...item,
      type: 'historical',
      isPrediction: false,
    }));

    // Add predictions if enabled
    if (showPredictions && data.predictions) {
      const predictions = data.predictions.map(item => ({
        date: item.date,
        revenue: item.revenue,
        orders_count: item.orders_count,
        conversion_rate: item.conversion_rate,
        avg_order_value: item.avg_order_value,
        type: 'prediction',
        isPrediction: true,
        confidence_score: item.confidence_score,
        revenue_min: item.confidence_interval.revenue_min,
        revenue_max: item.confidence_interval.revenue_max,
        orders_min: item.confidence_interval.orders_min,
        orders_max: item.confidence_interval.orders_max,
      }));
      combinedData.push(...predictions);
    }

    return combinedData;
  }, [data, timeRange, showPredictions]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (!data || !data.historical.length) return null;

    const historical = data.historical;
    const recent7Days = historical.slice(-7);
    const previous7Days = historical.slice(-14, -7);

    const recentRevenue = recent7Days.reduce((sum, item) => sum + item.revenue, 0);
    const previousRevenue = previous7Days.reduce((sum, item) => sum + item.revenue, 0);
    const revenueChange = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const recentOrders = recent7Days.reduce((sum, item) => sum + item.orders_count, 0);
    const previousOrders = previous7Days.reduce((sum, item) => sum + item.orders_count, 0);
    const ordersChange = previousOrders > 0 ? ((recentOrders - previousOrders) / previousOrders) * 100 : 0;

    const avgConversion = recent7Days.reduce((sum, item) => sum + item.conversion_rate, 0) / recent7Days.length;
    const prevAvgConversion = previous7Days.length > 0 ? previous7Days.reduce((sum, item) => sum + item.conversion_rate, 0) / previous7Days.length : 0;
    const conversionChange = prevAvgConversion > 0 ? ((avgConversion - prevAvgConversion) / prevAvgConversion) * 100 : 0;

    // Future predictions summary
    const futurePredictions = data.predictions ? data.predictions.slice(0, 30) : [];
    const predictedRevenue = futurePredictions.reduce((sum, item) => sum + item.revenue, 0);

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
        period: futurePredictions.length,
      },
    };
  }, [data]);

  const formatXAxisTick = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatYAxisTick = (value: number, axis: 'revenue' | 'orders' | 'conversion') => {
    switch (axis) {
      case 'revenue':
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
        return `$${value}`;
      case 'orders':
        return Math.round(value).toString();
      case 'conversion':
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPrediction = data.isPrediction;

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
              {new Date(label).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </Typography>
            {isPrediction && (
              <Chip
                size="small"
                label={`${Math.round(data.confidence_score * 100)}% confidence`}
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
          
          <Divider sx={{ mb: 1.5 }} />
          
          {payload.map((entry: any, index: number) => (
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
                {entry.dataKey === 'revenue' && `$${entry.value?.toLocaleString()}`}
                {entry.dataKey === 'orders_count' && entry.value}
                {entry.dataKey === 'conversion_rate' && `${entry.value?.toFixed(1)}%`}
                {entry.dataKey === 'avg_order_value' && `$${entry.value?.toFixed(2)}`}
              </Typography>
            </Box>
          ))}
          
          {isPrediction && data.revenue_min !== undefined && (
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Confidence Range
              </Typography>
              <Typography variant="body2" fontSize="0.8rem">
                Revenue: ${data.revenue_min?.toLocaleString()} - ${data.revenue_max?.toLocaleString()}
              </Typography>
              <Typography variant="body2" fontSize="0.8rem">
                Orders: {data.orders_min} - {data.orders_max}
              </Typography>
            </Box>
          )}
        </Paper>
      );
    }
    return null;
  };

  // Render different chart types based on selection
  const renderChart = () => {
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
      />
    );

    const commonYAxisRevenue = (
      <YAxis
        yAxisId="revenue"
        orientation="left"
        tickFormatter={(value) => formatYAxisTick(value, 'revenue')}
        stroke="rgba(0, 0, 0, 0.4)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 11 }}
      />
    );

    const commonYAxisOrders = (
      <YAxis
        yAxisId="orders"
        orientation="right"
        tickFormatter={(value) => formatYAxisTick(value, 'orders')}
        stroke="rgba(0, 0, 0, 0.4)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 11 }}
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
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#revenueGradient)"
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
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#revenueGradient)"
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
                fill="url(#ordersGradient)"
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
              <linearGradient id="revenueFocusGradient" x1="0" y1="0" x2="0" y2="1">
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
              fill="url(#revenueFocusGradient)"
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
  };

  if (loading) {
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
          borderRadius: 3,
        }}
      >
        <div className="animate-pulse">
          <Analytics sx={{ fontSize: 48, color: 'rgba(0, 0, 0, 0.2)' }} />
        </div>
        <Typography variant="body2" color="text.secondary">
          Loading analytics data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 3 }}>
        <Typography variant="h6">Failed to load analytics data</Typography>
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  if (!data || !data.historical.length) {
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
          borderRadius: 3,
          border: '2px dashed rgba(0, 0, 0, 0.1)',
        }}
      >
        <Analytics sx={{ fontSize: 48, color: 'rgba(0, 0, 0, 0.2)' }} />
        <Typography variant="h6" color="text.secondary">
          No analytics data available
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Analytics data will appear here once you start receiving orders and generating revenue
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
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
            Unified Analytics & Predictions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Revenue, orders, and conversion rate with 60-day forecasting
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
          {/* Chart Type Selector */}
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_, newType) => newType && setChartType(newType)}
            size="small"
          >
            <ToggleButton value="combined">
              <Analytics sx={{ mr: 0.5 }} fontSize="small" />
              Combined
            </ToggleButton>
            <ToggleButton value="revenue_focus">
              <ShowChart sx={{ mr: 0.5 }} fontSize="small" />
              Revenue Focus
            </ToggleButton>
            <ToggleButton value="line">
              <ShowChart sx={{ mr: 0.5 }} fontSize="small" />
              Line
            </ToggleButton>
            <ToggleButton value="area">
              <Timeline sx={{ mr: 0.5 }} fontSize="small" />
              Area
            </ToggleButton>
            <ToggleButton value="bar">
              <BarChartIcon sx={{ mr: 0.5 }} fontSize="small" />
              Bar
            </ToggleButton>
            <ToggleButton value="candlestick">
              <CandlestickChart sx={{ mr: 0.5 }} fontSize="small" />
              Candlestick
            </ToggleButton>
            <ToggleButton value="waterfall">
              <WaterfallChart sx={{ mr: 0.5 }} fontSize="small" />
              Waterfall
            </ToggleButton>
            <ToggleButton value="stacked">
              <StackedLineChart sx={{ mr: 0.5 }} fontSize="small" />
              Stacked
            </ToggleButton>
            <ToggleButton value="composed">
              <Analytics sx={{ mr: 0.5 }} fontSize="small" />
              Composed
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Modern Prediction Controls */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
            {/* AI Prediction Button */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant={showPredictions ? "contained" : "outlined"}
                size="large"
                onClick={() => {
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
                startIcon={
                  predictionLoading ? (
                    <AutoGraph sx={{ animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
                  ) : (
                    showPredictions ? <Stop /> : <AutoFixHigh />
                  )
                }
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
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography variant="button" fontWeight="inherit">
                    {predictionLoading ? 'Analyzing your data…' : (showPredictions ? 'Stop Predictions' : 'Predict Future')}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
                    {predictionLoading ? 'Our AI models are processing your forecast…' : (showPredictions ? 'Hide AI forecasting' : 'AI-powered 60-day forecast')}
                  </Typography>
                </Box>
              </Button>

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
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
        
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
          🚀 AI-Powered Analytics & Forecasting
        </Box>
      </Paper>

      {/* Enhanced Predictions Info Panel */}
      {showPredictions && data.predictions && data.predictions.length > 0 && (
        <Alert 
          severity="success" 
          sx={{ 
            mt: 2, 
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(34, 197, 94, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            '& .MuiAlert-icon': {
              color: 'success.main'
            }
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
        </Alert>
      )}
    </Box>
  );
};

export default UnifiedAnalyticsChart; 