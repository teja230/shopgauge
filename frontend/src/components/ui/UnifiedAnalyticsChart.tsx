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
import { useNotifications } from '../../hooks/useNotifications';
import { UNIFIED_COLOR_SCHEME } from './ChartStyles';

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

// Use unified color scheme for consistency across all charts
const COLOR_SCHEME = UNIFIED_COLOR_SCHEME;

// Helper function for conversion rate formatting with proper precision
const formatConversionRate = (value: number): string => {
  if (value < 0.01) {
    return value.toFixed(4); // Show 4 decimal places for very small values like 0.0006
  } else if (value < 0.1) {
    return value.toFixed(3); // Show 3 decimal places for small values like 0.06
  } else if (value < 1) {
    return value.toFixed(2); // Show 2 decimal places for values like 0.12
  } else {
    return value.toFixed(1); // Show 1 decimal place for larger values
  }
};

// Standardized tooltip formatter to ensure consistent labeling across all chart types
const standardTooltipFormatter = (value: number, name: string, props: any): [string, string] => {
  const isPrediction = props.payload?.isPrediction;
  // Updated terminology: "Recent Data" for last 60 days, "AI Forecast" for predictions
  const prefix = isPrediction ? '🔮 AI Forecast: ' : '📊 Recent Data: ';
  
  // Standardize display names regardless of dataKey or name prop
  if (name.includes('Revenue') || name === 'revenue') {
    return [`${prefix}$${value.toLocaleString()}`, 'Revenue'];
  }
  if (name.includes('Orders') || name === 'orders_count') {
    return [`${prefix}${value.toLocaleString()}`, 'Orders'];
  }
  if (name.includes('Conversion') || name === 'conversion_rate') {
    return [`${prefix}${formatConversionRate(value)}%`, 'Conversion Rate'];
  }
  return [`${prefix}${value.toLocaleString()}`, name];
};

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

// Enhanced Line Chart component with historical vs forecast color separation
const SimpleLineChart = memo(({ data, visibleMetrics, shouldShowPredictionLine, predictionDate, showPredictions, isMobile }: any) => {
  if (!validateChartData(data)) {
    return null;
  }

  // Separate historical and forecast data
  const historicalData = data.filter((item: any) => !item.isPrediction);
  const forecastData = data.filter((item: any) => item.isPrediction);

  // Mobile-optimized margins with proportionate bottom space
  const margins = isMobile 
    ? { top: 15, right: 20, left: 20, bottom: 60 }
    : { top: 25, right: 40, left: 40, bottom: 70 };

  return (
    <LineChart
      data={data}
      margin={margins}
    >
      <defs>
        {/* Enhanced gradients for better visual distinction */}
        <linearGradient id="revenueLineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.3} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="ordersLineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.orders} stopOpacity={0.3} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.orders} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="conversionLineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.3} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.05} />
        </linearGradient>
        
        {/* Forecast gradients with distinct styling */}
        <linearGradient id="revenueForecastGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0.2} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0.03} />
        </linearGradient>
        <linearGradient id="ordersForecastGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.orders} stopOpacity={0.2} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.orders} stopOpacity={0.03} />
        </linearGradient>
        <linearGradient id="conversionForecastGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.conversion} stopOpacity={0.2} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.conversion} stopOpacity={0.03} />
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
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 12 }}
        label={{ 
          value: 'Date', 
          position: 'insideBottom', 
          offset: -5,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <YAxis
        yAxisId="left"
        stroke="rgba(0, 0, 0, 0.6)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 11 }}
        tickFormatter={(value) => `$${value.toLocaleString()}`}
        label={{ 
          value: 'Revenue (USD)', 
          angle: -90, 
          position: 'insideLeft',
          offset: -10,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        stroke="rgba(0, 0, 0, 0.6)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 11 }}
        tickFormatter={(value) => value.toLocaleString()}
        label={{ 
          value: 'Orders & Conversion (%)', 
          angle: 90, 
          position: 'insideRight',
          offset: 10,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <Tooltip
        labelFormatter={(label) => {
          try {
            return new Date(label).toLocaleDateString();
          } catch {
            return label;
          }
        }}
        formatter={standardTooltipFormatter}
        contentStyle={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      />
      <Legend 
        formatter={(value, entry) => (
          <span style={{ color: entry.color, fontSize: '12px', fontWeight: 500 }}>
            {value}
          </span>
        )}
      />
      
      {/* Historical Data Lines with enhanced visual distinction */}
      {visibleMetrics.revenue && (
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke={UNIFIED_COLOR_SCHEME.historical.revenue}
          strokeWidth={3}
          name="Revenue"
          strokeDasharray=""
          dot={(props: any) => {
            const { payload } = props;
            const isPrediction = payload?.isPrediction;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={isPrediction ? 3 : 4}
                fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                strokeWidth={isPrediction ? 1 : 2}
                opacity={isPrediction ? 0.8 : 1}
              />
            );
          }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.orders && (
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders_count"
          stroke={UNIFIED_COLOR_SCHEME.historical.orders}
          strokeWidth={2}
          name="Orders"
          strokeDasharray=""
          dot={(props: any) => {
            const { payload } = props;
            const isPrediction = payload?.isPrediction;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={isPrediction ? 2.5 : 3}
                fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                strokeWidth={isPrediction ? 1 : 2}
                opacity={isPrediction ? 0.8 : 1}
              />
            );
          }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.conversion && (
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="conversion_rate"
          stroke={UNIFIED_COLOR_SCHEME.historical.conversion}
          strokeWidth={2}
          name="Conversion Rate"
          strokeDasharray=""
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
          connectNulls={false}
          isAnimationActive={false}
        />
      )}

      {/* Forecast Data Lines - Only show if predictions are enabled and we have forecast data */}
      {showPredictions && forecastData.length > 0 && visibleMetrics.revenue && (
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke={UNIFIED_COLOR_SCHEME.forecast.revenue}
          strokeWidth={3}
          strokeDasharray="8 4"
          name="Revenue (AI Forecast)"
          dot={{ fill: UNIFIED_COLOR_SCHEME.forecast.revenue, stroke: '#ffffff', strokeWidth: 2, r: 4 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}
      {showPredictions && forecastData.length > 0 && visibleMetrics.orders && (
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders_count"
          stroke={UNIFIED_COLOR_SCHEME.forecast.orders}
          strokeWidth={2}
          strokeDasharray="8 4"
          name="Orders (AI Forecast)"
          dot={{ fill: UNIFIED_COLOR_SCHEME.forecast.orders, stroke: '#ffffff', strokeWidth: 2, r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}
      {showPredictions && forecastData.length > 0 && visibleMetrics.conversion && (
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="conversion_rate"
          stroke={UNIFIED_COLOR_SCHEME.forecast.conversion}
          strokeWidth={2}
          strokeDasharray="8 4"
          name="Conversion Rate (AI Forecast)"
          dot={{ fill: UNIFIED_COLOR_SCHEME.forecast.conversion, stroke: '#ffffff', strokeWidth: 2, r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}

      {/* Enhanced Prediction separator line */}
      {shouldShowPredictionLine && predictionDate && showPredictions && (
        <ReferenceLine
          x={predictionDate}
          stroke="#9333ea"
          strokeWidth={3}
          strokeDasharray="10 5"
          opacity={0.9}
          label={{ 
            value: "🔮 AI Forecasts →", 
            position: "top",
            style: { 
              fontSize: '12px', 
              fontWeight: 600,
              fill: '#9333ea'
            }
          }}
        />
      )}
    </LineChart>
  );
});

// Enhanced Area Chart component with historical vs forecast color separation
const SimpleAreaChart = memo(({ data, visibleMetrics, shouldShowPredictionLine, predictionDate, showPredictions, isMobile }: any) => {
  if (!validateChartData(data)) {
    return null;
  }

  // Separate historical and forecast data
  const historicalData = data.filter((item: any) => !item.isPrediction);
  const forecastData = data.filter((item: any) => item.isPrediction);

  // Mobile-optimized margins with proportionate bottom space
  const margins = isMobile 
    ? { top: 15, right: 20, left: 20, bottom: 60 }
    : { top: 25, right: 40, left: 40, bottom: 70 };

  return (
    <AreaChart
      data={data}
      margin={margins}
    >
      <defs>
        {/* Historical gradients */}
        <linearGradient id="revenueGradientHistorical" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.4} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="ordersGradientHistorical" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.orders} stopOpacity={0.4} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.orders} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="conversionGradientHistorical" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.4} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.05} />
        </linearGradient>
        
        {/* Forecast gradients */}
        <linearGradient id="revenueGradientForecast" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0.3} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="ordersGradientForecast" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.orders} stopOpacity={0.3} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.orders} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="conversionGradientForecast" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.conversion} stopOpacity={0.3} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.conversion} stopOpacity={0.05} />
        </linearGradient>

        {/* Forecast patterns for better distinction */}
        <pattern id="forecastPattern" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="4" height="4" fill={UNIFIED_COLOR_SCHEME.forecast.revenue} fillOpacity="0.05"/>
          <path d="M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2" stroke={UNIFIED_COLOR_SCHEME.forecast.revenue} strokeWidth="0.5" strokeOpacity="0.2"/>
        </pattern>
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
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 12 }}
        label={{ 
          value: 'Date', 
          position: 'insideBottom', 
          offset: -5,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <YAxis
        yAxisId="left"
        stroke="rgba(0, 0, 0, 0.6)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 11 }}
        tickFormatter={(value) => `$${value.toLocaleString()}`}
        label={{ 
          value: 'Revenue (USD)', 
          angle: -90, 
          position: 'insideLeft',
          offset: -10,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        stroke="rgba(0, 0, 0, 0.6)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 11 }}
        tickFormatter={(value) => value.toLocaleString()}
        label={{ 
          value: 'Orders & Conversion (%)', 
          angle: 90, 
          position: 'insideRight',
          offset: 10,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <Tooltip
        labelFormatter={(label) => {
          try {
            return new Date(label).toLocaleDateString();
          } catch {
            return label;
          }
        }}
        formatter={standardTooltipFormatter}
        contentStyle={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      />
      <Legend 
        formatter={(value, entry) => (
          <span style={{ color: entry.color, fontSize: '12px', fontWeight: 500 }}>
            {value}
          </span>
        )}
      />
      
            {/* Historical Data Areas */}
      {visibleMetrics.revenue && (
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke={UNIFIED_COLOR_SCHEME.historical.revenue}
          strokeWidth={3}
          fill="url(#revenueGradientHistorical)"
          name="Revenue (Recent)"
          dot={{ fill: UNIFIED_COLOR_SCHEME.historical.revenue, strokeWidth: 2, r: 4 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.orders && (
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="orders_count"
          stroke={UNIFIED_COLOR_SCHEME.historical.orders}
          strokeWidth={2}
          fill="url(#ordersGradientHistorical)"
          name="Orders (Recent)"
          dot={{ fill: UNIFIED_COLOR_SCHEME.historical.orders, strokeWidth: 2, r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}
      {visibleMetrics.conversion && (
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="conversion_rate"
          stroke={UNIFIED_COLOR_SCHEME.historical.conversion}
          strokeWidth={2}
          fill="url(#conversionGradientHistorical)"
          name="Conversion Rate (Recent)"
          dot={{ fill: UNIFIED_COLOR_SCHEME.historical.conversion, strokeWidth: 2, r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}

      {/* Forecast Data Areas - Only show if predictions are enabled and we have forecast data */}
      {showPredictions && forecastData.length > 0 && visibleMetrics.revenue && (
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke={UNIFIED_COLOR_SCHEME.forecast.revenue}
          strokeWidth={3}
          strokeDasharray="8 4"
          fill="url(#revenueGradientForecast)"
          name="Revenue (AI Forecast)"
          dot={{ fill: UNIFIED_COLOR_SCHEME.forecast.revenue, stroke: '#ffffff', strokeWidth: 2, r: 4 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}
      {showPredictions && forecastData.length > 0 && visibleMetrics.orders && (
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="orders_count"
          stroke={UNIFIED_COLOR_SCHEME.forecast.orders}
          strokeWidth={2}
          strokeDasharray="8 4"
          fill="url(#ordersGradientForecast)"
          name="Orders (AI Forecast)"
          dot={{ fill: UNIFIED_COLOR_SCHEME.forecast.orders, stroke: '#ffffff', strokeWidth: 2, r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}
      {showPredictions && forecastData.length > 0 && visibleMetrics.conversion && (
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="conversion_rate"
          stroke={UNIFIED_COLOR_SCHEME.forecast.conversion}
          strokeWidth={2}
          strokeDasharray="8 4"
          fill="url(#conversionGradientForecast)"
          name="Conversion Rate (AI Forecast)"
          dot={{ fill: UNIFIED_COLOR_SCHEME.forecast.conversion, stroke: '#ffffff', strokeWidth: 2, r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      )}

      {/* Prediction separator line */}
      {shouldShowPredictionLine && predictionDate && showPredictions && (
        <ReferenceLine
          x={predictionDate}
          stroke="#9333ea"
          strokeWidth={3}
          strokeDasharray="10 5"
          opacity={0.9}
          label={{ 
            value: "🔮 AI Forecasts →", 
            position: "top",
            style: { 
              fontSize: '12px', 
              fontWeight: 600,
              fill: '#9333ea'
            }
          }}
        />
      )}
    </AreaChart>
  );
});

// Enhanced Composed Chart component for combined visualization
const SimpleComposedChart = memo(({ data, visibleMetrics, shouldShowPredictionLine, predictionDate, showPredictions, isMobile }: any) => {
  if (!validateChartData(data)) {
    return null;
  }

  // Separate historical and forecast data
  const historicalData = data.filter((item: any) => !item.isPrediction);
  const forecastData = data.filter((item: any) => item.isPrediction);

  // Mobile-optimized margins with proportionate bottom space
  const margins = isMobile 
    ? { top: 15, right: 20, left: 20, bottom: 60 }
    : { top: 25, right: 40, left: 40, bottom: 70 };

  return (
    <ComposedChart
      data={data}
      margin={margins}
    >
      <defs>
        {/* Enhanced gradients for composed chart */}
        <linearGradient id="revenueComposedGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.4} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="revenueComposedForecastGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0.3} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.forecast.revenue} stopOpacity={0.03} />
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
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 12 }}
        label={{ 
          value: 'Date', 
          position: 'insideBottom', 
          offset: -5,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <YAxis
        yAxisId="left"
        stroke="rgba(0, 0, 0, 0.6)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 11 }}
        tickFormatter={(value) => `$${value.toLocaleString()}`}
        label={{ 
          value: 'Revenue (USD)', 
          angle: -90, 
          position: 'insideLeft',
          offset: -10,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        stroke="rgba(0, 0, 0, 0.6)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 11 }}
        tickFormatter={(value) => value.toLocaleString()}
        label={{ 
          value: 'Orders & Conversion (%)', 
          angle: 90, 
          position: 'insideRight',
          offset: 10,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <Tooltip
        labelFormatter={(label) => {
          try {
            return new Date(label).toLocaleDateString();
          } catch {
            return label;
          }
        }}
        formatter={standardTooltipFormatter}
        contentStyle={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      />
      <Legend 
        formatter={(value, entry) => (
          <span style={{ color: entry.color, fontSize: '12px', fontWeight: 500 }}>
            {value}
          </span>
        )}
      />
      
      {/* Revenue as Area Chart with enhanced gradients and forecast differentiation */}
      {visibleMetrics.revenue && (
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke={UNIFIED_COLOR_SCHEME.historical.revenue}
          strokeWidth={3}
          fill="url(#revenueComposedGradient)"
          name="Revenue"
          connectNulls={false}
          isAnimationActive={false}
          dot={(props: any) => {
            const { payload } = props;
            const isPrediction = payload?.isPrediction;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={isPrediction && showPredictions ? 3 : 4}
                fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                strokeWidth={isPrediction ? 1 : 2}
                opacity={isPrediction ? 0.8 : 1}
              />
            );
          }}
        />
      )}
      
      {/* Orders as Bar Chart with historical/forecast differentiation */}
      {visibleMetrics.orders && (
        <Bar
          yAxisId="right"
          dataKey="orders_count"
          name="Orders"
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
      )}
      
            {/* Conversion Rate as Line Chart with historical/forecast differentiation */}
      {visibleMetrics.conversion && (
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="conversion_rate"
          stroke={UNIFIED_COLOR_SCHEME.historical.conversion}
          strokeWidth={2}
          name="Conversion Rate"
          connectNulls={false}
          isAnimationActive={false}
          dot={{ fill: UNIFIED_COLOR_SCHEME.historical.conversion, strokeWidth: 2, r: 3 }}
        />
      )}

      {/* Prediction separator line */}
      {shouldShowPredictionLine && predictionDate && showPredictions && (
        <ReferenceLine
          x={predictionDate}
          stroke="#9333ea"
          strokeWidth={2}
          strokeDasharray="8 4"
          opacity={0.8}
          label={{ value: "🔮 AI Forecasts →", position: "top" }}
        />
      )}
    </ComposedChart>
  );
});

// Enhanced Stacked Chart component with AI data differentiation
const SimpleStackedChart = memo(({ data, visibleMetrics, shouldShowPredictionLine, predictionDate, showPredictions, isMobile }: any) => {
  if (!validateChartData(data)) {
    return null;
  }

  // Separate historical and forecast data
  const historicalData = data.filter((item: any) => !item.isPrediction);
  const forecastData = data.filter((item: any) => item.isPrediction);

  // Mobile-optimized margins with proportionate bottom space
  const margins = isMobile 
    ? { top: 15, right: 20, left: 20, bottom: 60 }
    : { top: 25, right: 40, left: 40, bottom: 70 };

  return (
    <AreaChart
      data={data}
      stackOffset="expand"
      margin={margins}
    >
      <defs>
        {/* Enhanced gradients for stacked chart */}
        <linearGradient id="revenueStackedGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.6} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.revenue} stopOpacity={0.1} />
        </linearGradient>
        <linearGradient id="ordersStackedGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.orders} stopOpacity={0.6} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.orders} stopOpacity={0.1} />
        </linearGradient>
        <linearGradient id="conversionStackedGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.6} />
          <stop offset="95%" stopColor={UNIFIED_COLOR_SCHEME.historical.conversion} stopOpacity={0.1} />
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
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 12 }}
        label={{ 
          value: 'Date', 
          position: 'insideBottom', 
          offset: -5,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <YAxis
        stroke="rgba(0, 0, 0, 0.6)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 11 }}
        tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
        label={{ 
          value: 'Percentage Distribution', 
          angle: -90, 
          position: 'insideLeft',
          offset: -10,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <Tooltip
        labelFormatter={(label) => {
          try {
            return new Date(label).toLocaleDateString();
          } catch {
            return label;
          }
        }}
        formatter={(value: number, name: string, props: any) => {
          const isPrediction = props.payload?.isPrediction;
          const prefix = isPrediction ? '🔮 AI Forecast: ' : '📊 Recent Data: ';
          const percentage = (value * 100).toFixed(1);
          
          // Standardize display names for stacked chart
          let displayName = name;
          if (name.includes('Revenue') || name === 'revenue') {
            displayName = 'Revenue';
          } else if (name.includes('Orders') || name === 'orders_count') {
            displayName = 'Orders';
          } else if (name.includes('Conversion') || name === 'conversion_rate') {
            displayName = 'Conversion Rate';
          }
          
          return [`${prefix}${percentage}%`, displayName];
        }}
        contentStyle={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      />
      <Legend 
        formatter={(value, entry) => (
          <span style={{ color: entry.color, fontSize: '12px', fontWeight: 500 }}>
            {value}
          </span>
        )}
      />
      
      {/* Stacked areas with enhanced gradients and AI differentiation */}
      {visibleMetrics.revenue && (
        <Area
          type="monotone"
          dataKey="revenue"
          stackId="1"
          stroke={UNIFIED_COLOR_SCHEME.historical.revenue}
          strokeWidth={2}
          fill="url(#revenueStackedGradient)"
          name="Revenue Distribution"
          connectNulls={false}
          isAnimationActive={false}
          dot={(props: any) => {
            const { payload } = props;
            const isPrediction = payload?.isPrediction;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={isPrediction && showPredictions ? 2 : 3}
                fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.revenue : UNIFIED_COLOR_SCHEME.historical.revenue}
                strokeWidth={isPrediction ? 1 : 2}
                opacity={isPrediction ? 0.7 : 1}
              />
            );
          }}
        />
      )}
      {visibleMetrics.orders && (
        <Area
          type="monotone"
          dataKey="orders_count"
          stackId="1"
          stroke={UNIFIED_COLOR_SCHEME.historical.orders}
          strokeWidth={2}
          fill="url(#ordersStackedGradient)"
          name="Orders Distribution"
          connectNulls={false}
          isAnimationActive={false}
          dot={(props: any) => {
            const { payload } = props;
            const isPrediction = payload?.isPrediction;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={isPrediction && showPredictions ? 2 : 3}
                fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.orders : UNIFIED_COLOR_SCHEME.historical.orders}
                strokeWidth={isPrediction ? 1 : 2}
                opacity={isPrediction ? 0.7 : 1}
              />
            );
          }}
        />
      )}
      {visibleMetrics.conversion && (
        <Area
          type="monotone"
          dataKey="conversion_rate"
          stackId="1"
          stroke={UNIFIED_COLOR_SCHEME.historical.conversion}
          strokeWidth={2}
          fill="url(#conversionStackedGradient)"
          name="Conversion Distribution"
          connectNulls={false}
          isAnimationActive={false}
          dot={(props: any) => {
            const { payload } = props;
            const isPrediction = payload?.isPrediction;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={isPrediction && showPredictions ? 2 : 3}
                fill={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
                stroke={isPrediction ? UNIFIED_COLOR_SCHEME.forecast.conversion : UNIFIED_COLOR_SCHEME.historical.conversion}
                strokeWidth={isPrediction ? 1 : 2}
                opacity={isPrediction ? 0.7 : 1}
              />
            );
          }}
        />
      )}

      {/* Prediction separator line */}
      {shouldShowPredictionLine && predictionDate && showPredictions && (
        <ReferenceLine
          x={predictionDate}
          stroke="#9333ea"
          strokeWidth={3}
          strokeDasharray="10 5"
          opacity={0.9}
          label={{ 
            value: "🔮 AI Forecasts →", 
            position: "top",
            style: { 
              fontSize: '12px', 
              fontWeight: 600,
              fill: '#9333ea'
            }
          }}
        />
      )}
    </AreaChart>
  );
});

// Enhanced Bar Chart component with historical vs forecast color separation
const SimpleBarChart = memo(({ data, visibleMetrics, shouldShowPredictionLine, predictionDate, showPredictions, isMobile }: any) => {
  if (!validateChartData(data)) {
    return null;
  }

  // Separate historical and forecast data
  const historicalData = data.filter((item: any) => !item.isPrediction);
  const forecastData = data.filter((item: any) => item.isPrediction);

  // Mobile-optimized margins with proportionate bottom space
  const margins = isMobile 
    ? { top: 15, right: 20, left: 20, bottom: 60 }
    : { top: 25, right: 40, left: 40, bottom: 70 };

  return (
    <BarChart
      data={data}
      margin={margins}
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
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 12 }}
        label={{ 
          value: 'Date', 
          position: 'insideBottom', 
          offset: -5,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <YAxis
        yAxisId="left"
        stroke="rgba(0, 0, 0, 0.6)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 11 }}
        tickFormatter={(value) => `$${value.toLocaleString()}`}
        label={{ 
          value: 'Revenue (USD)', 
          angle: -90, 
          position: 'insideLeft',
          offset: -10,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        stroke="rgba(0, 0, 0, 0.6)"
        tick={{ fill: 'rgba(0, 0, 0, 0.6)', fontSize: isMobile ? 10 : 11 }}
        tickFormatter={(value) => value.toLocaleString()}
        label={{ 
          value: 'Orders & Conversion (%)', 
          angle: 90, 
          position: 'insideRight',
          offset: 10,
          style: { textAnchor: 'middle', fontSize: '12px', fill: 'rgba(0, 0, 0, 0.7)' }
        }}
      />
      <Tooltip
        labelFormatter={(label) => {
          try {
            return new Date(label).toLocaleDateString();
          } catch {
            return label;
          }
        }}
        formatter={standardTooltipFormatter}
        contentStyle={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      />
      <Legend 
        formatter={(value, entry) => (
          <span style={{ color: entry.color, fontSize: '12px', fontWeight: 500 }}>
            {value}
          </span>
        )}
      />
      
      {/* Revenue Bars */}
      {visibleMetrics.revenue && (
        <Bar
          yAxisId="left"
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
      )}
      
      {/* Orders Bars */}
      {visibleMetrics.orders && (
        <Bar
          yAxisId="right"
          dataKey="orders_count"
          name="Orders"
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
      )}
      
      {/* Conversion Bars */}
      {visibleMetrics.conversion && (
        <Bar
          yAxisId="right"
          dataKey="conversion_rate"
          name="Conversion Rate"
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
      )}

      {/* Prediction separator line */}
      {shouldShowPredictionLine && predictionDate && showPredictions && (
        <ReferenceLine
          x={predictionDate}
          stroke="#9333ea"
          strokeWidth={2}
          strokeDasharray="8 4"
          opacity={0.8}
          label={{ value: "Forecasts", position: "top" }}
        />
      )}
    </BarChart>
  );
});

// Enhanced UI/UX components and utilities
const ConfidenceIndicator: React.FC<{ confidence: number }> = ({ confidence }) => {
  const confidencePercent = Math.round(confidence * 100);
  const getColor = (confidence: number) => {
    if (confidence >= 0.7) return '#10b981'; // Green for high confidence
    if (confidence >= 0.5) return '#f59e0b'; // Orange for medium confidence
    return '#ef4444'; // Red for low confidence
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: getColor(confidence),
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.5 },
          },
        }}
      />
      <Typography variant="caption" sx={{ color: getColor(confidence), fontWeight: 600 }}>
        {confidencePercent}%
      </Typography>
    </Box>
  );
};

const EnhancedTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  const isPrediction = data?.isPrediction;
  const confidence = data?.confidence_score;

  return (
    <Paper
      elevation={8}
      sx={{
        p: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: 2,
        minWidth: 200,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {new Date(label).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Typography>
        {isPrediction && confidence && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Confidence:
            </Typography>
            <ConfidenceIndicator confidence={confidence} />
          </Box>
        )}
      </Box>
      
      {payload.map((entry: any, index: number) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: entry.color,
              border: isPrediction ? '2px dashed rgba(255,255,255,0.8)' : 'none',
              animation: isPrediction ? 'shimmer 1.5s ease-in-out infinite' : 'none',
              '@keyframes shimmer': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.7 },
              },
            }}
          />
          <Typography variant="body2" fontWeight={600}>
            {entry.name}: {
              entry.name.includes('Revenue') 
                ? `$${entry.value?.toLocaleString()}` 
                : entry.name.includes('Conversion')
                ? `${formatConversionRate(entry.value || 0)}%`
                : entry.value?.toLocaleString()
            }
          </Typography>
          {isPrediction && (
            <Chip
              label="Forecast"
              size="small"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                color: '#9333ea',
                border: '1px solid rgba(147, 51, 234, 0.2)',
              }}
            />
          )}
        </Box>
      ))}
      
      {isPrediction && data?.confidence_interval && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Prediction Range:
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
            ${data.confidence_interval.revenue_min?.toLocaleString()} - ${data.confidence_interval.revenue_max?.toLocaleString()}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

const ChartLegend: React.FC<{ visibleMetrics: any; onToggle: (metric: 'revenue' | 'orders' | 'conversion') => void; showPredictions: boolean }> = ({
  visibleMetrics,
  onToggle,
  showPredictions
}) => {
  const legendItems = [
    { key: 'revenue', label: 'Revenue', color: UNIFIED_COLOR_SCHEME.historical.revenue, icon: '💰' },
    { key: 'orders', label: 'Orders', color: UNIFIED_COLOR_SCHEME.historical.orders, icon: '📦' },
    { key: 'conversion', label: 'Conversion Rate', color: UNIFIED_COLOR_SCHEME.historical.conversion, icon: '📈' },
  ];

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 2 }}>
      {legendItems.map((item) => (
        <Chip
          key={item.key}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {showPredictions && (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: UNIFIED_COLOR_SCHEME.forecast[item.key as keyof typeof UNIFIED_COLOR_SCHEME.forecast],
                    ml: 0.5,
                  }}
                />
              )}
            </Box>
          }
          onClick={() => onToggle(item.key as 'revenue' | 'orders' | 'conversion')}
          variant={visibleMetrics[item.key] ? 'filled' : 'outlined'}
          sx={{
            backgroundColor: visibleMetrics[item.key] ? `${item.color}20` : 'transparent',
            borderColor: item.color,
            color: visibleMetrics[item.key] ? item.color : 'text.secondary',
            '&:hover': {
              backgroundColor: `${item.color}30`,
            },
            transition: 'all 0.2s ease-in-out',
          }}
        />
      ))}
    </Box>
  );
};

const QuickInsights: React.FC<{ data: any; showPredictions: boolean }> = ({ data, showPredictions }) => {
  if (!data?.historical?.length) return null;

  const historical = data.historical;
  const predictions = data.predictions || [];
  
  const latestRevenue = historical[historical.length - 1]?.revenue || 0;
  const previousRevenue = historical[historical.length - 2]?.revenue || 0;
  const revenueChange = latestRevenue - previousRevenue;
  const revenueChangePercent = previousRevenue > 0 ? (revenueChange / previousRevenue) * 100 : 0;
  
  const avgConfidence = predictions.length > 0 
    ? predictions.reduce((sum: number, p: any) => sum + (p.confidence_score || 0), 0) / predictions.length 
    : 0;

  const insights = [
    {
      label: 'Latest Revenue',
      value: `$${latestRevenue.toLocaleString()}`,
      change: revenueChangePercent,
      icon: '💰',
    },
    {
      label: 'Total Orders',
      value: data.total_orders?.toLocaleString() || '0',
      icon: '📦',
    },
    {
      label: 'Data Points',
      value: historical.length.toString(),
      icon: '📊',
    },
  ];

  if (showPredictions && predictions.length > 0) {
    insights.push({
      label: 'Avg Confidence',
      value: `${Math.round(avgConfidence * 100)}%`,
      icon: '🎯',
    });
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: 2, 
      justifyContent: 'center',
      p: 2,
      backgroundColor: 'rgba(0, 0, 0, 0.02)',
      borderRadius: 2,
      mb: 2,
    }}>
      {insights.map((insight, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            backgroundColor: 'white',
            borderRadius: 1,
            border: '1px solid rgba(0, 0, 0, 0.1)',
            minWidth: 120,
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>{insight.icon}</span>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {insight.label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" fontWeight={600}>
                {insight.value}
              </Typography>
              {insight.change !== undefined && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    color: insight.change >= 0 ? '#10b981' : '#ef4444',
                  }}
                >
                  {insight.change >= 0 ? '↗️' : '↘️'}
                  <Typography variant="caption" fontWeight={600}>
                    {Math.abs(insight.change).toFixed(1)}%
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

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
  const { showSuccess, showInfo } = useNotifications();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const chartHeight = ensureMinHeight(height);

  // Handle prediction toggle with notifications
  const handlePredictionToggle = (checked: boolean) => {
    setShowPredictions(checked);
    
    if (checked) {
      showSuccess('Predictive analytics enabled - AI-powered forecasting is now active', {
        persistent: true,
        category: 'Predictive Analytics',
        duration: 4000
      });
    } else {
      showInfo('Predictive analytics disabled - displaying historical performance data only', {
        persistent: true,
        category: 'Analytics Mode',
        duration: 4000
      });
    }
  };

  // Process and validate chart data with enhanced error handling
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
      // Process historical data with safe handling
      const processedHistorical = data.historical
        .filter(item => item && typeof item === 'object' && item.date) // Filter out invalid items
        .map(processHistoricalItem);
      
      // Process predictions if enabled
      let processedPredictions: any[] = [];
      if (showPredictions && data.predictions && Array.isArray(data.predictions)) {
        processedPredictions = data.predictions
          .filter(item => item && typeof item === 'object' && item.date) // Filter out invalid items
          .map(processHistoricalItem);
      }

      // Combine and sort data
      const combinedData = [...processedHistorical, ...processedPredictions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      debugLog.info('Processed chart data', {
        totalPoints: combinedData.length,
        historicalPoints: processedHistorical.length,
        predictionPoints: processedPredictions.length,
        hasValidData: combinedData.length > 0 // Simplified validation
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
    const newState = !visibleMetrics[metric];
    setVisibleMetrics(prev => ({
      ...prev,
      [metric]: newState,
    }));
    
    // Show notification for metric toggle
    const metricNames = {
      revenue: 'Revenue',
      orders: 'Orders',
      conversion: 'Conversion Rate'
    };
    
    const action = newState ? 'enabled' : 'disabled';
    
    showInfo(`${metricNames[metric]} tracking ${action} in analytics dashboard`, {
      persistent: false,
      category: 'Data Visualization',
      duration: 1500
    });
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

  // Render no data state with more lenient validation
  if (!data || !data.historical || !Array.isArray(data.historical) || data.historical.length === 0) {
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
      {/* Quick Insights */}
      <QuickInsights data={data} showPredictions={showPredictions} />
      
      {/* Chart Controls */}
      <Box sx={{ 
        mb: 2, 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        flexWrap: 'wrap', 
        gap: isMobile ? 1 : 2, 
        alignItems: isMobile ? 'stretch' : 'center' 
      }}>
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={(_, value) => value && handleChartTypeChange(value)}
          size="small"
          sx={{ 
            alignSelf: isMobile ? 'center' : 'flex-start',
            '& .MuiToggleButton-root': {
              px: isMobile ? 0.5 : 1.5,
              fontSize: isMobile ? '0.7rem' : '0.8rem',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }
            }
          }}
        >
          <ToggleButton value="area" aria-label="Area Chart">
            <Timeline sx={{ fontSize: isMobile ? '0.9rem' : '1rem', mr: isMobile ? 0.25 : 0.5 }} /> 
            {isMobile ? 'Area' : 'Area'}
          </ToggleButton>
          <ToggleButton value="line" aria-label="Line Chart">
            <ShowChart sx={{ fontSize: isMobile ? '0.9rem' : '1rem', mr: isMobile ? 0.25 : 0.5 }} /> 
            {isMobile ? 'Line' : 'Line'}
          </ToggleButton>
          <ToggleButton value="bar" aria-label="Bar Chart">
            <BarChartIcon sx={{ fontSize: isMobile ? '0.9rem' : '1rem', mr: isMobile ? 0.25 : 0.5 }} /> 
            {isMobile ? 'Bar' : 'Bar'}
          </ToggleButton>
          {!isMobile && (
            <>
              <ToggleButton value="composed" aria-label="Combined Chart">
                <Timeline sx={{ fontSize: '1rem', mr: 0.5 }} /> 
                Combined
              </ToggleButton>
              <ToggleButton value="stacked" aria-label="Stacked Chart">
                <BarChartIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> 
                Stacked
              </ToggleButton>
            </>
          )}
        </ToggleButtonGroup>

        <FormControlLabel
          control={
            <Switch
              checked={showPredictions}
              onChange={(e) => handlePredictionToggle(e.target.checked)}
              size="small"
              sx={{
                '& .MuiSwitch-thumb': {
                  transition: 'all 0.2s ease-in-out',
                },
                '& .MuiSwitch-track': {
                  backgroundColor: showPredictions ? '#9333ea' : undefined,
                }
              }}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span>🔮</span>
              <span>AI Predictions</span>
            </Box>
          }
          sx={{ 
            alignSelf: isMobile ? 'center' : 'flex-start',
            '& .MuiFormControlLabel-label': {
              fontSize: isMobile ? '0.875rem' : '1rem',
            }
          }}
        />
      </Box>
      
      {/* Enhanced Legend */}
      <ChartLegend 
        visibleMetrics={visibleMetrics} 
        onToggle={handleMetricToggle} 
        showPredictions={showPredictions}
      />

      {/* Chart Container */}
      <Paper
        elevation={0}
        sx={{
          p: isMobile ? 1 : 2,
          backgroundColor: '#fff',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: 2,
          overflow: isMobile ? 'auto' : 'hidden', // Enable horizontal scroll on mobile
        }}
      >
        <Box sx={{ 
          height: isMobile ? Math.max(chartHeight, 400) : chartHeight,
          width: '100%',
          minWidth: isMobile ? '600px' : 'auto', // Set minimum width on mobile to prevent cutoff
          minHeight: isMobile ? 400 : 450,
          position: 'relative',
          overflowX: isMobile ? 'auto' : 'visible', // Enable horizontal scroll on mobile
          overflowY: 'visible',
          '& .recharts-wrapper': {
            width: '100% !important',
            height: '100% !important',
            minWidth: isMobile ? '600px' : 'auto', // Ensure chart has minimum width on mobile
          },
          '& .recharts-surface': {
            overflow: 'visible',
          }
        }}>
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
                        showPredictions={showPredictions}
                        isMobile={isMobile}
                      />
                    );
                  case 'bar':
                    return (
                      <SimpleBarChart
                        data={chartData}
                        visibleMetrics={visibleMetrics}
                        shouldShowPredictionLine={shouldShowPredictionLine}
                        predictionDate={predictionDate}
                        showPredictions={showPredictions}
                        isMobile={isMobile}
                      />
                    );
                  case 'composed':
                  case 'combined':
                    return (
                      <SimpleComposedChart
                        data={chartData}
                        visibleMetrics={visibleMetrics}
                        shouldShowPredictionLine={shouldShowPredictionLine}
                        predictionDate={predictionDate}
                        showPredictions={showPredictions}
                        isMobile={isMobile}
                      />
                    );
                  case 'stacked':
                    return (
                      <SimpleStackedChart
                        data={chartData}
                        visibleMetrics={visibleMetrics}
                        shouldShowPredictionLine={shouldShowPredictionLine}
                        predictionDate={predictionDate}
                        showPredictions={showPredictions}
                        isMobile={isMobile}
                      />
                    );
                  default:
                    return (
                      <SimpleAreaChart
                        data={chartData}
                        visibleMetrics={visibleMetrics}
                        shouldShowPredictionLine={shouldShowPredictionLine}
                        predictionDate={predictionDate}
                        showPredictions={showPredictions}
                        isMobile={isMobile}
                      />
                    );
                }
              })()}
            </ResponsiveContainer>
          </ChartErrorBoundary>
        </Box>

        {/* Chart Summary */}
        <Box sx={{ 
          mt: 2, 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'center' : 'center',
          gap: isMobile ? 1 : 0,
          textAlign: isMobile ? 'center' : 'left'
        }}>
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