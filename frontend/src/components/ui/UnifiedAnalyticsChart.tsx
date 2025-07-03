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

// Helper function to safely get numeric value
const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return defaultValue;
  }
  const num = Number(value);
  // Additional checks for SVG-safe values
  if (!isFinite(num) || num < -1e10 || num > 1e10) {
    return defaultValue;
  }
  return num;
};

// Helper function to validate date strings for SVG rendering
const safeDateString = (dateStr: any): string => {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date().toISOString().split('T')[0];
  }
  
  // Check if it's a valid date string
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  
  return dateStr;
};

// Helper function to safely process historical data item
const processHistoricalItem = (item: any) => {
  try {
    // Handle the current API format with 'kind' and 'isPrediction' fields
    const processedItem = {
      date: safeDateString(item.date),
      revenue: safeNumber(item.revenue),
      orders_count: safeNumber(item.orders_count),
      conversion_rate: safeNumber(item.conversion_rate),
      avg_order_value: safeNumber(item.avg_order_value),
      // Preserve the API format fields
      ...(item.kind && { kind: item.kind }),
      ...(typeof item.isPrediction === 'boolean' && { isPrediction: item.isPrediction }),
    };
    
    // Additional validation to ensure all numeric values are SVG-safe
    if (isNaN(processedItem.revenue) || !isFinite(processedItem.revenue) || processedItem.revenue < 0) {
      processedItem.revenue = 0;
    }
    if (isNaN(processedItem.orders_count) || !isFinite(processedItem.orders_count) || processedItem.orders_count < 0) {
      processedItem.orders_count = 0;
    }
    if (isNaN(processedItem.conversion_rate) || !isFinite(processedItem.conversion_rate) || processedItem.conversion_rate < 0) {
      processedItem.conversion_rate = 0;
    }
    if (isNaN(processedItem.avg_order_value) || !isFinite(processedItem.avg_order_value) || processedItem.avg_order_value < 0) {
      processedItem.avg_order_value = 0;
    }
    
    // Cap extremely large values that might cause SVG rendering issues
    processedItem.revenue = Math.min(processedItem.revenue, 1e9);
    processedItem.orders_count = Math.min(processedItem.orders_count, 1e6);
    processedItem.conversion_rate = Math.min(processedItem.conversion_rate, 100);
    processedItem.avg_order_value = Math.min(processedItem.avg_order_value, 1e6);
    
    return processedItem;
  } catch (error) {
    console.error('Error processing historical item:', error, item);
    // Return a safe default structure
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

// Create memoized chart components to prevent re-renders and isolate each chart type
const MemoizedLineChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonTooltip, commonLegend, visibleMetrics, shouldShowPredictionLine, predictionDate }: any) => (
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
        connectNulls={false}
        isAnimationActive={false}
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
        connectNulls={false}
        isAnimationActive={false}
      />
    )}
    {shouldShowPredictionLine && predictionDate && (
      <ReferenceLine
        x={predictionDate}
        stroke="rgba(0, 0, 0, 0.3)"
        strokeDasharray="2,2"
        label="Predictions"
      />
    )}
  </LineChart>
));

const MemoizedAreaChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonTooltip, commonLegend, visibleMetrics, shouldShowPredictionLine, predictionDate, gradientIdPrefix }: any) => (
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
        connectNulls={false}
        isAnimationActive={false}
      />
    )}
    {shouldShowPredictionLine && predictionDate && (
      <ReferenceLine
        x={predictionDate}
        stroke="rgba(0, 0, 0, 0.3)"
        strokeDasharray="2,2"
        label="Predictions"
      />
    )}
  </AreaChart>
));

const MemoizedBarChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonTooltip, commonLegend, visibleMetrics, shouldShowPredictionLine, predictionDate }: any) => (
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
        isAnimationActive={false}
      />
    )}
    {shouldShowPredictionLine && predictionDate && (
      <ReferenceLine
        x={predictionDate}
        stroke="rgba(0, 0, 0, 0.3)"
        strokeDasharray="2,2"
        label="Predictions"
      />
    )}
  </BarChart>
));

const MemoizedComposedChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonYAxisOrders, commonTooltip, commonLegend, visibleMetrics, showPredictions, shouldShowPredictionLine, predictionDate }: any) => (
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
        isAnimationActive={false}
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
        connectNulls={false}
        isAnimationActive={false}
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
        connectNulls={false}
        isAnimationActive={false}
      />
    )}
    
    {shouldShowPredictionLine && predictionDate && (
      <ReferenceLine
        x={predictionDate}
        stroke="rgba(0, 0, 0, 0.3)"
        strokeDasharray="2,2"
        label="Predictions"
      />
    )}
  </ComposedChart>
));

// Add memoized components for all other chart types to prevent React invariant errors
const MemoizedCandlestickChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonTooltip, commonLegend, visibleMetrics, shouldShowPredictionLine, predictionDate }: any) => (
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
        isAnimationActive={false}
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
        connectNulls={false}
        isAnimationActive={false}
      />
    )}
    {shouldShowPredictionLine && predictionDate && (
      <ReferenceLine
        x={predictionDate}
        stroke="rgba(0, 0, 0, 0.3)"
        strokeDasharray="2,2"
        label="Predictions"
      />
    )}
  </ComposedChart>
));

const MemoizedWaterfallChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonTooltip, commonLegend, visibleMetrics, shouldShowPredictionLine, predictionDate }: any) => (
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
        isAnimationActive={false}
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
        connectNulls={false}
        isAnimationActive={false}
      />
    )}
    {shouldShowPredictionLine && predictionDate && (
      <ReferenceLine
        x={predictionDate}
        stroke="rgba(0, 0, 0, 0.3)"
        strokeDasharray="2,2"
        label="Predictions"
      />
    )}
  </ComposedChart>
));

const MemoizedStackedChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonTooltip, commonLegend, visibleMetrics, shouldShowPredictionLine, predictionDate, gradientIdPrefix }: any) => (
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
        connectNulls={false}
        isAnimationActive={false}
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
        connectNulls={false}
        isAnimationActive={false}
      />
    )}
    {shouldShowPredictionLine && predictionDate && (
      <ReferenceLine
        x={predictionDate}
        stroke="rgba(0, 0, 0, 0.3)"
        strokeDasharray="2,2"
        label="Predictions"
      />
    )}
  </AreaChart>
));

const MemoizedRevenueFocusChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonTooltip, commonLegend, visibleMetrics, shouldShowPredictionLine, predictionDate, gradientIdPrefix }: any) => (
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
    {visibleMetrics.revenue && (
      <Area
        yAxisId="revenue"
        type="monotone"
        dataKey="revenue"
        stroke="#2563eb"
        strokeWidth={4}
        fill={`url(#${gradientIdPrefix}-revenueFocusGradient)`}
        name="Revenue"
        dot={{ fill: '#2563eb', strokeWidth: 3, r: 5 }}
        connectNulls={false}
        isAnimationActive={false}
      />
    )}
    {shouldShowPredictionLine && predictionDate && (
      <ReferenceLine
        x={predictionDate}
        stroke="rgba(0, 0, 0, 0.3)"
        strokeDasharray="2,2"
        label="Predictions"
      />
    )}
  </AreaChart>
));

const UnifiedAnalyticsChart: React.FC<UnifiedAnalyticsChartProps> = ({
  data,
  loading = false,
  error = null,
  height = CHART_DIMENSIONS.DEFAULT_HEIGHT,
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
  
  // Simplified chart key for chart type changes
  const [chartKey, setChartKey] = useState(0);
  
  // Generate a unique id prefix for gradient defs to avoid DOM ID collisions
  const gradientIdPrefix = useMemo(() => {
    return `ua-${chartType}-${Math.random().toString(36).substring(2, 8)}`;
  }, [chartType]);

  // Simplified chart type change handler
  const handleChartTypeChange = (newType: ChartType) => {
    if (newType && newType !== chartType) {
      debugLog.info('Chart type change', {
        oldType: chartType,
        newType,
      }, 'UnifiedAnalyticsChart');
      setChartType(newType);
      setChartKey(prev => prev + 1);
    }
  };

  // Process and combine historical and prediction data with error handling
  const chartData = useMemo(() => {
    try {
      // Enhanced validation to prevent React invariant errors
      if (!data) {
        return [];
      }
      
      if (!data.historical) {
        return [];
      }
      
      if (!Array.isArray(data.historical)) {
        return [];
      }
      
      if (data.historical.length === 0) {
        return [];
      }

      let historical = data.historical.map(processHistoricalItem).filter(item => 
        item && item.date && typeof item.revenue === 'number' && !isNaN(item.revenue)
      );
      
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
          const ci = item.confidence_interval;
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
            revenue_min: ci ? safeNumber(ci.revenue_min) : 0,
            revenue_max: ci ? safeNumber(ci.revenue_max) : 0,
            orders_min: ci ? safeNumber(ci.orders_min) : 0,
            orders_max: ci ? safeNumber(ci.orders_max) : 0,
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

      return validData;
    } catch (err) {
      console.error('Error processing chart data:', err);
      return [];
    }
  }, [data, timeRange, showPredictions]);

  // Debug logging for chart data processing (moved outside of useMemo)
  useLayoutEffect(() => {
    debugLog.info('=== CHART DATA PROCESSING STARTED ===', { 
      hasData: !!data,
      hasHistorical: !!(data && data.historical),
      isHistoricalArray: !!(data && Array.isArray(data.historical)),
      dataKeys: data ? Object.keys(data) : [],
      loading,
      error
    }, 'UnifiedAnalyticsChart');
    
    if (data && data.historical && Array.isArray(data.historical) && data.historical.length > 0) {
      debugLog.info('Processing historical data for chart', {
        historicalLength: data.historical.length,
        sampleItem: data.historical[0],
        sampleItemKeys: data.historical[0] ? Object.keys(data.historical[0]) : [],
        dataStructure: {
          hasPredictions: !!(data.predictions),
          predictionsLength: Array.isArray(data.predictions) ? data.predictions.length : 0,
          totalRevenue: data.total_revenue,
          totalOrders: data.total_orders,
          samplePrediction: data.predictions && data.predictions[0] ? data.predictions[0] : null,
          samplePredictionKeys: data.predictions && data.predictions[0] ? Object.keys(data.predictions[0]) : [],
        }
      }, 'UnifiedAnalyticsChart');

      console.log('UnifiedAnalyticsChart: Processing historical data', {
        historicalLength: data.historical.length,
        sampleItem: data.historical[0],
        dataStructure: {
          hasPredictions: !!(data.predictions),
          predictionsLength: Array.isArray(data.predictions) ? data.predictions.length : 0,
          totalRevenue: data.total_revenue,
          totalOrders: data.total_orders,
        }
      });
    }

    if (chartData.length > 0) {
      console.log('UnifiedAnalyticsChart: Processed chart data:', {
        totalPoints: chartData.length,
        historicalPoints: chartData.filter(d => !d.isPrediction).length,
        predictionPoints: chartData.filter(d => d.isPrediction).length,
        hasValidData: chartData.length > 0
      });
    }
  }, [data, chartData, loading, error]);

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

  // Create sanitized chart data with aggressive validation to prevent React invariant errors
  const safeChartData = useMemo(() => {
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      return [];
    }

    return chartData
      .filter(item => {
        // Ultra-strict validation
        if (!item || typeof item !== 'object') return false;
        
        // Validate date
        if (typeof item.date !== 'string' || item.date.length === 0) return false;
        const dateTest = new Date(item.date);
        if (isNaN(dateTest.getTime())) return false;
        
        // Validate all numeric fields with strict bounds
        const fields = ['revenue', 'orders_count', 'conversion_rate', 'avg_order_value'];
        for (const field of fields) {
          const value = item[field];
          if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return false;
          if (value < 0 || value === Infinity || value === -Infinity) return false;
        }
        
        // Additional bounds checking
        if (item.revenue > 1e9 || item.orders_count > 1e6 || 
            item.conversion_rate > 100 || item.avg_order_value > 1e6) return false;
        
        return true;
      })
      .map((item, index) => {
        // Create a completely new object to prevent any reference issues
        const sanitizedItem = {
          // Ensure date is properly formatted
          date: safeDateString(item.date),
          
          // Clamp all numeric values to safe ranges
          revenue: Math.round(Math.max(0, Math.min(1e9, safeNumber(item.revenue))) * 100) / 100,
          orders_count: Math.round(Math.max(0, Math.min(1e6, safeNumber(item.orders_count)))),
          conversion_rate: Math.round(Math.max(0, Math.min(100, safeNumber(item.conversion_rate))) * 100) / 100,
          avg_order_value: Math.round(Math.max(0, Math.min(1e6, safeNumber(item.avg_order_value))) * 100) / 100,
          
          // Ensure safe metadata
          key: `data-${item.date}-${index}`,
          type: String(item.type || 'historical'),
          isPrediction: Boolean(item.isPrediction),
          
          // Add any additional safe properties
          ...(item.confidence_score !== undefined && { 
            confidence_score: Math.max(0, Math.min(1, safeNumber(item.confidence_score))) 
          }),
        };
        
        // Final validation of the sanitized item
        Object.keys(sanitizedItem).forEach(key => {
          const value = (sanitizedItem as any)[key];
          if (value === undefined || value === null) {
            delete (sanitizedItem as any)[key];
          }
        });
        
        return sanitizedItem;
      });
  }, [chartData]);

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
  
  // Ensure height meets minimum requirements
  const chartHeight = ensureMinHeight(height);

  // Prepare common chart props and components
  const commonProps = useMemo(() => ({
    data: safeChartData,
    margin: { 
      top: SPACING.MEDIUM, 
      right: SPACING.LARGE, 
      left: SPACING.MEDIUM, 
      bottom: SPACING.MEDIUM 
    },
  }), [safeChartData]);

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

  // Simplified container reference for the chart
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debug logging for component render states
  useLayoutEffect(() => {
    debugLog.info('=== UNIFIED ANALYTICS CHART RENDER ===', { 
      loading,
      error,
      hasData: !!data,
      hasHistorical: !!(data && data.historical),
      historicalLength: data?.historical?.length || 0,
      chartDataLength: chartData.length,
      safeChartDataLength: safeChartData.length,
      chartType,
      showPredictions,
    }, 'UnifiedAnalyticsChart');
  }, [loading, error, data, chartData.length, safeChartData.length, chartType, showPredictions]);

  if (loading) {
    debugLog.info('Rendering loading state', { height: chartHeight }, 'UnifiedAnalyticsChart');
    return <LoadingIndicator height={chartHeight} message="Loading analytics data…" />;
  }

  if (error) {
    debugLog.error('Rendering error state', { error, height: chartHeight }, 'UnifiedAnalyticsChart');
    console.error('UnifiedAnalyticsChart: Error state triggered with error:', error);
    return (
      <Box
        sx={{
          height: chartHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: SPACING.MEDIUM,
          backgroundColor: 'rgba(255, 0, 0, 0.02)',
          borderRadius: 2,
          border: '1px solid rgba(255, 0, 0, 0.1)',
          p: SPACING.LARGE,
        }}
      >
        <Typography variant="h6" color="error" textAlign="center">
          Failed to load analytics data
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          The Advanced Analytics chart encountered an error. Please try refreshing the page.
        </Typography>
        <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ mt: 1 }}>
          Error: {error}
        </Typography>
      </Box>
    );
  }

  // Enhanced data validation with better error messaging
  const hasValidData = data && 
    data.historical && 
    Array.isArray(data.historical) && 
    data.historical.length > 0 &&
    chartData &&
    chartData.length > 0;

  debugLog.info('Data validation check', { 
    hasValidData,
    hasData: !!data,
    hasHistorical: !!(data && data.historical),
    isHistoricalArray: !!(data && Array.isArray(data.historical)),
    historicalLength: data?.historical?.length || 0,
    hasChartData: !!chartData,
    chartDataLength: chartData.length
  }, 'UnifiedAnalyticsChart');

  if (!hasValidData) {
    // Check if we have data but it's not valid
    if (data && (!data.historical || !Array.isArray(data.historical))) {
      debugLog.error('Invalid data format detected', { 
        hasData: !!data,
        hasHistorical: !!(data && data.historical),
        isHistoricalArray: !!(data && Array.isArray(data.historical)),
        dataKeys: data ? Object.keys(data) : []
      }, 'UnifiedAnalyticsChart');
      
      return (
        <Box
          sx={{
            height: chartHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: SPACING.MEDIUM,
            backgroundColor: 'rgba(255, 165, 0, 0.02)',
            borderRadius: 2,
            border: '1px solid rgba(255, 165, 0, 0.1)',
            p: SPACING.LARGE,
          }}
        >
          <Typography variant="h6" color="warning.main" textAlign="center">
            Invalid data format
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            The analytics data format is not valid. Please try refreshing the page.
          </Typography>
        </Box>
      );
    }

    // No data available
    debugLog.warn('No valid data available for chart', { 
      hasData: !!data,
      hasHistorical: !!(data && data.historical),
      historicalLength: data?.historical?.length || 0,
      chartDataLength: chartData.length
    }, 'UnifiedAnalyticsChart');
    
    return (
      <Box
        sx={{
          height: chartHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: SPACING.MEDIUM,
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
          borderRadius: 2,
          p: SPACING.LARGE,
        }}
      >
        <Analytics sx={{ fontSize: 48, color: 'rgba(0, 0, 0, 0.2)' }} />
        <Typography variant="h6" color="text.secondary" textAlign="center">
          No analytics data available
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Analytics data will appear here once your store has sufficient data.
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
            onChange={(_, newType) => newType && handleChartTypeChange(newType)}
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
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
                    },
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
          p: SPACING.LARGE,
          backgroundColor: '#fff',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: 3,
          position: 'relative',
          overflow: 'hidden',
          minHeight: CHART_DIMENSIONS.MIN_HEIGHT,
        }}
      >
        {safeChartData.length > 0 && (
          <React.Fragment>
            {/* Debug logging for chart rendering */}
            {(() => {
              debugLog.info('About to render chart', {
                chartType,
                safeChartDataLength: safeChartData.length,
                visibleMetrics,
                chartHeight
              }, 'UnifiedAnalyticsChart');
              return null;
            })()}
            
            {/* Render chart based on selected type */}
            <div style={{ width: '100%', height: chartHeight }}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                {(() => {
                  const shouldShowPredictionLine = showPredictions && data && data.predictions && data.predictions.length > 0;
                  const predictionDate = data && data.predictions && data.predictions[0] ? data.predictions[0].date : undefined;
                  
                  switch (chartType) {
                    case 'line':
                      return (
                        <MemoizedLineChart
                          commonProps={commonProps}
                          commonGrid={commonGrid}
                          commonXAxis={commonXAxis}
                          commonYAxisRevenue={commonYAxisRevenue}
                          commonTooltip={commonTooltip}
                          commonLegend={commonLegend}
                          visibleMetrics={visibleMetrics}
                          shouldShowPredictionLine={shouldShowPredictionLine}
                          predictionDate={predictionDate}
                        />
                      );
                    case 'area':
                      return (
                        <MemoizedAreaChart
                          commonProps={commonProps}
                          commonGrid={commonGrid}
                          commonXAxis={commonXAxis}
                          commonYAxisRevenue={commonYAxisRevenue}
                          commonTooltip={commonTooltip}
                          commonLegend={commonLegend}
                          visibleMetrics={visibleMetrics}
                          shouldShowPredictionLine={shouldShowPredictionLine}
                          predictionDate={predictionDate}
                          gradientIdPrefix={gradientIdPrefix}
                        />
                      );
                    case 'bar':
                      return (
                        <MemoizedBarChart
                          commonProps={commonProps}
                          commonGrid={commonGrid}
                          commonXAxis={commonXAxis}
                          commonYAxisRevenue={commonYAxisRevenue}
                          commonTooltip={commonTooltip}
                          commonLegend={commonLegend}
                          visibleMetrics={visibleMetrics}
                          shouldShowPredictionLine={shouldShowPredictionLine}
                          predictionDate={predictionDate}
                        />
                      );
                    case 'combined':
                    case 'composed':
                      return (
                        <MemoizedComposedChart
                          commonProps={commonProps}
                          commonGrid={commonGrid}
                          commonXAxis={commonXAxis}
                          commonYAxisRevenue={commonYAxisRevenue}
                          commonYAxisOrders={commonYAxisOrders}
                          commonTooltip={commonTooltip}
                          commonLegend={commonLegend}
                          visibleMetrics={visibleMetrics}
                          showPredictions={showPredictions}
                          shouldShowPredictionLine={shouldShowPredictionLine}
                          predictionDate={predictionDate}
                        />
                      );
                    case 'revenue_focus':
                      return (
                        <MemoizedRevenueFocusChart
                          commonProps={commonProps}
                          commonGrid={commonGrid}
                          commonXAxis={commonXAxis}
                          commonYAxisRevenue={commonYAxisRevenue}
                          commonTooltip={commonTooltip}
                          commonLegend={commonLegend}
                          visibleMetrics={visibleMetrics}
                          shouldShowPredictionLine={shouldShowPredictionLine}
                          predictionDate={predictionDate}
                          gradientIdPrefix={gradientIdPrefix}
                        />
                      );
                    case 'candlestick':
                      return (
                        <MemoizedCandlestickChart
                          commonProps={commonProps}
                          commonGrid={commonGrid}
                          commonXAxis={commonXAxis}
                          commonYAxisRevenue={commonYAxisRevenue}
                          commonTooltip={commonTooltip}
                          commonLegend={commonLegend}
                          visibleMetrics={visibleMetrics}
                          shouldShowPredictionLine={shouldShowPredictionLine}
                          predictionDate={predictionDate}
                        />
                      );
                    case 'waterfall':
                      return (
                        <MemoizedWaterfallChart
                          commonProps={commonProps}
                          commonGrid={commonGrid}
                          commonXAxis={commonXAxis}
                          commonYAxisRevenue={commonYAxisRevenue}
                          commonTooltip={commonTooltip}
                          commonLegend={commonLegend}
                          visibleMetrics={visibleMetrics}
                          shouldShowPredictionLine={shouldShowPredictionLine}
                          predictionDate={predictionDate}
                        />
                      );
                    case 'stacked':
                      return (
                        <MemoizedStackedChart
                          commonProps={commonProps}
                          commonGrid={commonGrid}
                          commonXAxis={commonXAxis}
                          commonYAxisRevenue={commonYAxisRevenue}
                          commonTooltip={commonTooltip}
                          commonLegend={commonLegend}
                          visibleMetrics={visibleMetrics}
                          shouldShowPredictionLine={shouldShowPredictionLine}
                          predictionDate={predictionDate}
                          gradientIdPrefix={gradientIdPrefix}
                        />
                      );
                    default:
                      return (
                        <MemoizedComposedChart
                          commonProps={commonProps}
                          commonGrid={commonGrid}
                          commonXAxis={commonXAxis}
                          commonYAxisRevenue={commonYAxisRevenue}
                          commonYAxisOrders={commonYAxisOrders}
                          commonTooltip={commonTooltip}
                          commonLegend={commonLegend}
                          visibleMetrics={visibleMetrics}
                          showPredictions={showPredictions}
                          shouldShowPredictionLine={shouldShowPredictionLine}
                          predictionDate={predictionDate}
                        />
                      );
                  }
                })()}
              </ResponsiveContainer>
            </div>
          </React.Fragment>
        )}
        
        {/* Show empty state when no data */}
        {safeChartData.length === 0 && (
          <Box sx={{ 
            height: chartHeight, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'column',
            gap: SPACING.MEDIUM
          }}>
            <Typography variant="h6" color="text.secondary">
              No data to display
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Chart data is being processed...
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Enhanced Predictions Info Panel */}
      {showPredictions && data.predictions && data.predictions.length > 0 && (
        <Box 
          sx={{ 
            mt: SPACING.MEDIUM, 
            p: SPACING.MEDIUM,
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