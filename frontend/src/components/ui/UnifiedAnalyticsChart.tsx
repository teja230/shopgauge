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
    debugLog.error('Error processing historical item', {
      error: error instanceof Error ? error.message : String(error),
      item: item ? { ...item, date: item.date } : null,
      errorStack: error instanceof Error ? error.stack : undefined
    }, 'processHistoricalItem');
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

// Add a debug helper for chart rendering using Debug Panel
const debugChartRender = (componentName: string, props: any) => {
  debugLog.info(`${componentName} Debug - Props`, {
    hasCommonProps: !!props.commonProps,
    dataLength: props.commonProps?.data?.length || 0,
    dataSample: props.commonProps?.data?.slice(0, 2) || [],
    visibleMetrics: props.visibleMetrics,
    chartHeight: props.commonProps?.height,
    shouldShowPredictionLine: props.shouldShowPredictionLine,
    predictionDate: props.predictionDate,
    gradientIdPrefix: props.gradientIdPrefix
  }, componentName);
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

const MemoizedComposedChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonYAxisOrders, commonTooltip, commonLegend, visibleMetrics, showPredictions, shouldShowPredictionLine, predictionDate }: any) => {
  // Add debug logging for ComposedChart rendering
  try {
    debugLog.info('MemoizedComposedChart rendering', {
      hasCommonProps: !!commonProps,
      dataLength: commonProps?.data?.length || 0,
      hasYAxisRevenue: !!commonYAxisRevenue,
      hasYAxisOrders: !!commonYAxisOrders,
      visibleMetrics,
      showPredictions,
      shouldShowPredictionLine,
      predictionDate,
      dataSample: commonProps?.data?.slice(0, 3) || []
    }, 'MemoizedComposedChart');

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
    );
  } catch (error) {
    debugLog.error('Error in MemoizedComposedChart', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      hasCommonProps: !!commonProps,
      dataLength: commonProps?.data?.length || 0
    }, 'MemoizedComposedChart');
    
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>Chart rendering error</span>
      </div>
    );
  }
});

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

const MemoizedRevenueFocusChart = memo(({ commonProps, commonGrid, commonXAxis, commonYAxisRevenue, commonTooltip, commonLegend, visibleMetrics, shouldShowPredictionLine, predictionDate, gradientIdPrefix }: any) => {
  // Add debug logging for this specific chart
  useEffect(() => {
    debugChartRender('MemoizedRevenueFocusChart', {
      commonProps,
      visibleMetrics,
      shouldShowPredictionLine,
      predictionDate,
      gradientIdPrefix
    });
  }, [commonProps, visibleMetrics, shouldShowPredictionLine, predictionDate, gradientIdPrefix]);

  // Validate data before rendering
  if (!commonProps || !commonProps.data || !Array.isArray(commonProps.data) || commonProps.data.length === 0) {
    debugLog.error('MemoizedRevenueFocusChart: Invalid data props', {
      hasCommonProps: !!commonProps,
      hasData: !!(commonProps && commonProps.data),
      isArray: !!(commonProps && Array.isArray(commonProps.data)),
      dataLength: commonProps?.data?.length || 0
    }, 'MemoizedRevenueFocusChart');
    return null;
  }

  // Validate that we have revenue data
  const hasRevenueData = commonProps.data.some((item: any) => 
    item && typeof item.revenue === 'number' && !isNaN(item.revenue) && item.revenue > 0
  );
  
  if (!hasRevenueData) {
    debugLog.error('MemoizedRevenueFocusChart: No valid revenue data found', {
      dataLength: commonProps.data?.length || 0,
      dataSample: commonProps.data?.slice(0, 3) || [],
      hasAnyRevenue: commonProps.data?.some((item: any) => item && 'revenue' in item),
      revenueTypes: commonProps.data?.map((item: any) => typeof item?.revenue).slice(0, 5)
    }, 'MemoizedRevenueFocusChart');
    return null;
  }

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
  );
});

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
      debugLog.error('Error processing chart data', {
        error: err instanceof Error ? err.message : String(err),
        hasData: !!data,
        hasHistorical: !!(data && data.historical),
        historicalLength: data?.historical?.length || 0,
        errorStack: err instanceof Error ? err.stack : undefined
      }, 'UnifiedAnalyticsChart');
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

      debugLog.info('Processing historical data for chart (console fallback)', {
        historicalLength: data.historical.length,
        sampleItem: data.historical[0],
        dataStructure: {
          hasPredictions: !!(data.predictions),
          predictionsLength: Array.isArray(data.predictions) ? data.predictions.length : 0,
          totalRevenue: data.total_revenue,
          totalOrders: data.total_orders,
        }
      }, 'UnifiedAnalyticsChart');
    }

    if (chartData.length > 0) {
      debugLog.info('Processed chart data summary', {
        totalPoints: chartData.length,
        historicalPoints: chartData.filter(d => !d.isPrediction).length,
        predictionPoints: chartData.filter(d => d.isPrediction).length,
        hasValidData: chartData.length > 0
      }, 'UnifiedAnalyticsChart');
    }
  }, [data, chartData, loading, error]);

  // Calculate summary statistics with error handling
  const stats = useMemo(() => {
    try {
      if (!data || !data.historical || !Array.isArray(data.historical) || data.historical.length === 0) {
        debugLog.warn('No historical data for stats calculation', {
          hasData: !!data,
          hasHistorical: !!(data && data.historical),
          isArray: !!(data && Array.isArray(data.historical)),
          length: data?.historical?.length || 0
        }, 'UnifiedAnalyticsChart');
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
      debugLog.error('Error calculating stats', {
        error: err instanceof Error ? err.message : String(err),
        hasData: !!data,
        hasHistorical: !!(data && data.historical),
        historicalLength: data?.historical?.length || 0,
        errorStack: err instanceof Error ? err.stack : undefined
      }, 'UnifiedAnalyticsChart');
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
      debugLog.error('Error rendering tooltip', {
        error: err instanceof Error ? err.message : String(err),
        hasActive: !!active,
        hasPayload: !!(payload && payload.length),
        label: label,
        errorStack: err instanceof Error ? err.stack : undefined
      }, 'CustomTooltip');
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
      domain={['dataMin', 'dataMax']}
      type="number"
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
      domain={['dataMin', 'dataMax']}
      type="number"
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
    debugLog.error('Rendering error state', { 
      error, 
      height: chartHeight,
      errorType: typeof error,
      errorMessage: error || 'Unknown error'
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
          mb: 2,
          flexWrap: 'wrap',
          gap: 1.5,
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
                  minWidth: 160,
                  background: showPredictions ? 
                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                    'transparent',
                  border: showPredictions ? 'none' : '1px solid rgba(102, 126, 234, 0.3)',
                  color: showPredictions ? 'white' : 'primary.main',
                  fontWeight: 500,
                  borderRadius: 2,
                  py: 1,
                  px: 2,
                  transition: 'all 0.3s ease',
                  boxShadow: showPredictions ? 
                    '0 4px 12px rgba(102, 126, 234, 0.2)' : 
                    '0 1px 4px rgba(0, 0, 0, 0.1)',
                  '&:hover': {
                    boxShadow: showPredictions ? 
                      '0 6px 16px rgba(102, 126, 234, 0.3)' : 
                      '0 2px 8px rgba(102, 126, 234, 0.15)',
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
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', ml: 0.5 }}>
                  <Typography variant="caption" fontWeight="inherit" fontSize="0.8rem">
                    {predictionLoading ? 'Analyzing…' : (showPredictions ? 'Stop Predictions' : 'AI Predictions')}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7, fontSize: '0.65rem' }}>
                    {predictionLoading ? 'Processing forecast…' : (showPredictions ? 'Hide forecasting' : '60-day forecast')}
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
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Card elevation={0} sx={{ border: '1px solid rgba(0, 0, 0, 0.1)', flex: 1, minWidth: 180 }}>
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
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

          <Card elevation={0} sx={{ border: '1px solid rgba(0, 0, 0, 0.1)', flex: 1, minWidth: 180 }}>
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
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

          <Card elevation={0} sx={{ border: '1px solid rgba(0, 0, 0, 0.1)', flex: 1, minWidth: 180 }}>
            <CardContent sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
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
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
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
          p: SPACING.MEDIUM,
          backgroundColor: '#fff',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: 2,
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
              
              // Additional debug logging
              debugLog.info('Chart Render Debug', {
                chartType,
                safeChartDataLength: safeChartData.length,
                visibleMetrics,
                chartHeight,
                dataSample: safeChartData.slice(0, 3),
                hasRevenueData: safeChartData.some(item => item && typeof item.revenue === 'number' && !isNaN(item.revenue) && item.revenue > 0),
                commonPropsValid: !!(commonProps && commonProps.data && commonProps.data.length > 0)
              }, 'UnifiedAnalyticsChart');
              
              return null;
            })()}
            
            {/* Render chart based on selected type */}
            <div style={{ width: '100%', height: chartHeight, minHeight: '200px' }}>
              
              <ResponsiveContainer width="100%" height={chartHeight}>
                {(() => {
                  debugLog.info('=== INSIDE RESPONSIVE CONTAINER ===', {
                    chartHeight,
                    chartType,
                    dataLength: commonProps?.data?.length || 0,
                    containerDimensions: { width: '100%', height: chartHeight }
                  }, 'UnifiedAnalyticsChart');
                  
                  const shouldShowPredictionLine = showPredictions && data && data.predictions && data.predictions.length > 0;
                  const predictionDate = data && data.predictions && data.predictions[0] ? data.predictions[0].date : undefined;
                  
                  // Comprehensive data validation to prevent React invariant violations
                  if (!commonProps || !commonProps.data || commonProps.data.length === 0) {
                    debugLog.error('Invalid commonProps in chart render', {
                      hasCommonProps: !!commonProps,
                      hasData: !!(commonProps && commonProps.data),
                      dataLength: commonProps?.data?.length || 0,
                      chartType,
                      safeChartDataLength: safeChartData.length
                    }, 'UnifiedAnalyticsChart');
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 0, 0, 0.1)' }}>
                        <Typography variant="body2" color="error">Chart data error</Typography>
                      </div>
                    );
                  }

                  // Validate each data point to prevent React invariant violations
                  const validatedData = commonProps.data.filter((item: any) => {
                    if (!item || typeof item !== 'object') return false;
                    
                    // Check for required fields
                    if (!item.date || typeof item.date !== 'string') return false;
                    
                    // Validate numeric fields - must be finite numbers
                    const numericChecks = [
                      { field: 'revenue', value: item.revenue },
                      { field: 'orders_count', value: item.orders_count },
                      { field: 'conversion_rate', value: item.conversion_rate },
                      { field: 'avg_order_value', value: item.avg_order_value }
                    ];
                    
                    for (const check of numericChecks) {
                      if (check.value !== undefined && check.value !== null) {
                        const value = Number(check.value);
                        if (!Number.isFinite(value)) {
                          debugLog.warn(`Invalid numeric value in ${check.field}`, {
                            field: check.field,
                            value: check.value,
                            type: typeof check.value,
                            isFinite: Number.isFinite(value)
                          }, 'UnifiedAnalyticsChart');
                          return false;
                        }
                      }
                    }
                    
                    return true;
                  });

                  // Ensure we have valid data after filtering
                  if (validatedData.length === 0) {
                    debugLog.error('No valid data points after validation', {
                      originalLength: commonProps.data.length,
                      validatedLength: validatedData.length,
                      sampleInvalidData: commonProps.data.slice(0, 3)
                    }, 'UnifiedAnalyticsChart');
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 165, 0, 0.1)' }}>
                        <Typography variant="body2" color="error">Invalid chart data format</Typography>
                      </div>
                    );
                  }

                  // Create safe props with validated data
                  const safeProps = {
                    ...commonProps,
                    data: validatedData
                  };

                  debugLog.info('Data validation passed', {
                    originalLength: commonProps.data.length,
                    validatedLength: validatedData.length,
                    sampleValidData: validatedData.slice(0, 2)
                  }, 'UnifiedAnalyticsChart');
                  
                  try {
                    debugLog.info('=== ABOUT TO RENDER CHART WITH VALIDATED DATA ===', {
                      chartType,
                      validatedDataLength: safeProps.data.length,
                      sampleValidatedData: safeProps.data.slice(0, 2)
                    }, 'UnifiedAnalyticsChart');
                    
                    // Additional React-specific error boundary
                    try {
                      // Render chart based on type with working configuration
                      switch (chartType) {
                      case 'combined':
                      case 'composed':
                        debugLog.info('Rendering working combined chart', {
                          chartType,
                          dataLength: commonProps?.data?.length || 0,
                          visibleMetrics
                        }, 'UnifiedAnalyticsChart');
                        
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={safeProps.data}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.06)" />
                              <XAxis 
                                dataKey="date" 
                                stroke="rgba(0, 0, 0, 0.4)"
                                tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 12 }}
                                axisLine={{ stroke: 'rgba(0, 0, 0, 0.1)' }}
                                tickFormatter={(tickItem) => {
                                  try {
                                    return new Date(tickItem).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                  } catch {
                                    return tickItem;
                                  }
                                }}
                              />
                              <YAxis 
                                yAxisId="revenue"
                                orientation="left"
                                stroke="rgba(0, 0, 0, 0.4)"
                                tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 11 }}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                                domain={['dataMin', 'dataMax']}
                                type="number"
                              />
                              <YAxis 
                                yAxisId="orders"
                                orientation="right"
                                stroke="rgba(0, 0, 0, 0.4)"
                                tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 11 }}
                                tickFormatter={(value) => Math.round(value).toString()}
                                domain={['dataMin', 'dataMax']}
                                type="number"
                              />
                              <Tooltip 
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0]?.payload;
                                    return (
                                      <div style={{ background: 'white', border: '1px solid #ccc', borderRadius: '4px', padding: '12px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                                        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#374151' }}>
                                          {new Date(label).toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric',
                                            year: 'numeric'
                                          })}
                                        </p>
                                        {visibleMetrics.revenue && (
                                          <p style={{ margin: '4px 0', color: '#2563eb', fontSize: '14px' }}>
                                            💰 Revenue: ${data?.revenue?.toLocaleString()}
                                          </p>
                                        )}
                                        {visibleMetrics.orders && (
                                          <p style={{ margin: '4px 0', color: '#10b981', fontSize: '14px' }}>
                                            📦 Orders: {data?.orders_count}
                                          </p>
                                        )}
                                        {visibleMetrics.conversion && (
                                          <p style={{ margin: '4px 0', color: '#f59e0b', fontSize: '14px' }}>
                                            📈 Conversion: {data?.conversion_rate?.toFixed(2)}%
                                          </p>
                                        )}
                                        {data?.isPrediction && (
                                          <p style={{ margin: '4px 0', color: '#8b5cf6', fontSize: '12px', fontStyle: 'italic' }}>
                                            🔮 Prediction
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend />
                              
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
                                  connectNulls={false}
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
                                  connectNulls={false}
                                />
                              )}
                              
                              {shouldShowPredictionLine && predictionDate && (
                                <ReferenceLine
                                  x={predictionDate}
                                  stroke="rgba(139, 92, 246, 0.5)"
                                  strokeDasharray="5,5"
                                  strokeWidth={2}
                                  label={{ value: "Predictions →", position: "top" }}
                                />
                              )}
                            </ComposedChart>
                          </ResponsiveContainer>
                        );
                        
                      case 'area':
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={safeProps.data}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient id="areaRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.06)" />
                              <XAxis 
                                dataKey="date" 
                                stroke="rgba(0, 0, 0, 0.4)"
                                tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 12 }}
                                tickFormatter={(tickItem) => {
                                  try {
                                    return new Date(tickItem).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                  } catch {
                                    return tickItem;
                                  }
                                }}
                              />
                              <YAxis 
                                stroke="rgba(0, 0, 0, 0.4)"
                                tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 11 }}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                                domain={['dataMin', 'dataMax']}
                                type="number"
                              />
                              <Tooltip 
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div style={{ background: 'white', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}>
                                        <p style={{ margin: 0, fontWeight: 'bold' }}>{`Date: ${label}`}</p>
                                        <p style={{ margin: 0, color: '#2563eb' }}>{`Revenue: $${payload[0]?.value?.toLocaleString()}`}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#2563eb"
                                strokeWidth={2}
                                fill="url(#areaRevenueGradient)"
                                fillOpacity={0.3}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        );
                        
                      default:
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={safeProps.data}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
                              <XAxis 
                                dataKey="date" 
                                stroke="rgba(0, 0, 0, 0.4)"
                                tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 12 }}
                                tickFormatter={(tickItem) => {
                                  try {
                                    return new Date(tickItem).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                  } catch {
                                    return tickItem;
                                  }
                                }}
                              />
                              <YAxis 
                                stroke="rgba(0, 0, 0, 0.4)"
                                tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: 11 }}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                              />
                              <Tooltip 
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div style={{ background: 'white', border: '1px solid #ccc', borderRadius: '4px', padding: '8px' }}>
                                        <p style={{ margin: 0, fontWeight: 'bold' }}>{`Date: ${label}`}</p>
                                        <p style={{ margin: 0, color: '#2563eb' }}>{`Revenue: $${payload[0]?.value?.toLocaleString()}`}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#2563eb"
                                strokeWidth={2}
                                fill="url(#revenueGradient)"
                                fillOpacity={0.3}
                              />
                              <defs>
                                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                                </linearGradient>
                              </defs>
                            </AreaChart>
                          </ResponsiveContainer>
                        );
                    }
                    } catch (reactError) {
                      debugLog.error('React invariant violation in chart rendering', {
                        error: reactError instanceof Error ? reactError.message : String(reactError),
                        chartType,
                        validatedDataLength: safeProps.data.length,
                        errorStack: reactError instanceof Error ? reactError.stack : undefined
                      }, 'UnifiedAnalyticsChart');
                      return (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                          <Typography variant="h6" color="error">React Rendering Error</Typography>
                          <Typography variant="body2" color="text.secondary">Chart rendering failed. Please refresh the page.</Typography>
                        </div>
                      );
                    }
                    
                    // Switch statement temporarily disabled for debugging
                    // switch (chartType) {
                    //   case 'line':
                    //     return (
                    //       <MemoizedLineChart
                    //         commonProps={commonProps}
                    //         commonGrid={commonGrid}
                    //         commonXAxis={commonXAxis}
                    //         commonYAxisRevenue={commonYAxisRevenue}
                    //         commonTooltip={commonTooltip}
                    //         commonLegend={commonLegend}
                    //         visibleMetrics={visibleMetrics}
                    //         shouldShowPredictionLine={shouldShowPredictionLine}
                    //         predictionDate={predictionDate}
                    //       />
                    //     );
                    //   case 'area':
                    //     return (
                    //       <MemoizedAreaChart
                    //         commonProps={commonProps}
                    //         commonGrid={commonGrid}
                    //         commonXAxis={commonXAxis}
                    //         commonYAxisRevenue={commonYAxisRevenue}
                    //         commonTooltip={commonTooltip}
                    //         commonLegend={commonLegend}
                    //         visibleMetrics={visibleMetrics}
                    //         shouldShowPredictionLine={shouldShowPredictionLine}
                    //         predictionDate={predictionDate}
                    //         gradientIdPrefix={gradientIdPrefix}
                    //       />
                    //     );
                    //   case 'bar':
                    //     return (
                    //       <MemoizedBarChart
                    //         commonProps={commonProps}
                    //         commonGrid={commonGrid}
                    //         commonXAxis={commonXAxis}
                    //         commonYAxisRevenue={commonYAxisRevenue}
                    //         commonTooltip={commonTooltip}
                    //         commonLegend={commonLegend}
                    //         visibleMetrics={visibleMetrics}
                    //         shouldShowPredictionLine={shouldShowPredictionLine}
                    //         predictionDate={predictionDate}
                    //       />
                    //     );
                    //   case 'combined':
                    //   case 'composed':
                    //     debugLog.info('Rendering combined/composed chart', {
                    //       chartType,
                    //       hasCommonProps: !!commonProps,
                    //       dataLength: commonProps?.data?.length || 0,
                    //       hasYAxisRevenue: !!commonYAxisRevenue,
                    //       hasYAxisOrders: !!commonYAxisOrders,
                    //       visibleMetrics,
                    //       showPredictions,
                    //       shouldShowPredictionLine,
                    //       predictionDate,
                    //       commonPropsKeys: commonProps ? Object.keys(commonProps) : [],
                    //       dataSample: commonProps?.data?.slice(0, 2) || []
                    //     }, 'UnifiedAnalyticsChart');
                    //     
                    //     // Temporary fallback to AreaChart for debugging
                    //     debugLog.info('Using AreaChart fallback for combined chart', {
                    //       chartType,
                    //       dataLength: commonProps?.data?.length || 0
                    //     }, 'UnifiedAnalyticsChart');
                    //     
                    //     return (
                    //       <MemoizedAreaChart
                    //         commonProps={commonProps}
                    //         commonGrid={commonGrid}
                    //         commonXAxis={commonXAxis}
                    //         commonYAxisRevenue={commonYAxisRevenue}
                    //         commonTooltip={commonTooltip}
                    //         commonLegend={commonLegend}
                    //         visibleMetrics={visibleMetrics}
                    //         shouldShowPredictionLine={shouldShowPredictionLine}
                    //         predictionDate={predictionDate}
                    //         gradientIdPrefix={gradientIdPrefix}
                    //       />
                    //     );
                    //   case 'revenue_focus':
                    //     debugLog.info('Rendering revenue_focus chart', {
                    //       dataLength: commonProps.data?.length,
                    //       hasRevenueData: commonProps.data?.some((item: any) => item && typeof item.revenue === 'number' && !isNaN(item.revenue) && item.revenue > 0),
                    //       visibleRevenue: visibleMetrics.revenue,
                    //       dataSample: commonProps.data?.slice(0, 2),
                    //       chartHeight,
                    //       shouldShowPredictionLine,
                    //       predictionDate
                    //     }, 'UnifiedAnalyticsChart');
                    //     return (
                    //       <MemoizedRevenueFocusChart
                    //         commonProps={commonProps}
                    //         commonGrid={commonGrid}
                    //         commonXAxis={commonXAxis}
                    //         commonYAxisRevenue={commonYAxisRevenue}
                    //         commonTooltip={commonTooltip}
                    //         commonLegend={commonLegend}
                    //         visibleMetrics={visibleMetrics}
                    //         shouldShowPredictionLine={shouldShowPredictionLine}
                    //         predictionDate={predictionDate}
                    //         gradientIdPrefix={gradientIdPrefix}
                    //       />
                    //     );
                    //   case 'candlestick':
                    //     return (
                    //       <MemoizedCandlestickChart
                    //         commonProps={commonProps}
                    //         commonGrid={commonGrid}
                    //         commonXAxis={commonXAxis}
                    //         commonYAxisRevenue={commonYAxisRevenue}
                    //         commonTooltip={commonTooltip}
                    //         commonLegend={commonLegend}
                    //         visibleMetrics={visibleMetrics}
                    //         shouldShowPredictionLine={shouldShowPredictionLine}
                    //         predictionDate={predictionDate}
                    //       />
                    //     );
                    //   case 'waterfall':
                    //     return (
                    //       <MemoizedWaterfallChart
                    //         commonProps={commonProps}
                    //         commonGrid={commonGrid}
                    //         commonXAxis={commonXAxis}
                    //         commonYAxisRevenue={commonYAxisRevenue}
                    //         commonTooltip={commonTooltip}
                    //         commonLegend={commonLegend}
                    //         visibleMetrics={visibleMetrics}
                    //         shouldShowPredictionLine={shouldShowPredictionLine}
                    //         predictionDate={predictionDate}
                    //       />
                    //     );
                    //   case 'stacked':
                    //     return (
                    //       <MemoizedStackedChart
                    //         commonProps={commonProps}
                    //         commonGrid={commonGrid}
                    //         commonXAxis={commonXAxis}
                    //         commonYAxisRevenue={commonYAxisRevenue}
                    //         commonTooltip={commonTooltip}
                    //         commonLegend={commonLegend}
                    //         visibleMetrics={visibleMetrics}
                    //         shouldShowPredictionLine={shouldShowPredictionLine}
                    //         predictionDate={predictionDate}
                    //         gradientIdPrefix={gradientIdPrefix}
                    //       />
                    //     );
                    //   default:
                    //     return (
                    //       <MemoizedComposedChart
                    //         commonProps={commonProps}
                    //         commonGrid={commonGrid}
                    //         commonXAxis={commonXAxis}
                    //         commonYAxisRevenue={commonYAxisRevenue}
                    //         commonYAxisOrders={commonYAxisOrders}
                    //         commonTooltip={commonTooltip}
                    //         commonLegend={commonLegend}
                    //         visibleMetrics={visibleMetrics}
                    //         showPredictions={showPredictions}
                    //         shouldShowPredictionLine={shouldShowPredictionLine}
                    //         predictionDate={predictionDate}
                    //       />
                    //     );
                    // }
                  } catch (error) {
                    debugLog.error('Error rendering chart', {
                      error: error instanceof Error ? error.message : String(error),
                      chartType,
                      dataLength: commonProps?.data?.length || 0,
                      hasCommonProps: !!commonProps,
                      errorStack: error instanceof Error ? error.stack : undefined
                    }, 'UnifiedAnalyticsChart');
                    return (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                        <Typography variant="h6" color="error">Chart Rendering Error</Typography>
                        <Typography variant="body2" color="text.secondary">Unable to render the chart. Please try refreshing.</Typography>
                      </div>
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
            mt: SPACING.SMALL, 
            p: SPACING.SMALL,
            borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(34, 197, 94, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" fontWeight={600} gutterBottom sx={{ fontSize: '0.8rem' }}>
                🔮 AI Predictions Active
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.75rem', display: 'block' }}>
                {data.predictions.length}-day forecast using ML algorithms
              </Typography>
            </Box>
            <Chip
              icon={<Insights fontSize="small" />}
              label={`${Math.round((data.predictions[0]?.confidence_score || 0) * 100)}%`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default UnifiedAnalyticsChart; 