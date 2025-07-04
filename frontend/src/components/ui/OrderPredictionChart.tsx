import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { TrendingUp, TrendingDown, ShoppingCart } from '@mui/icons-material';

interface OrderPredictionData {
  date: string;
  orders_count: number;
  isPrediction?: boolean;
  confidence_min?: number;
  confidence_max?: number;
  confidence_score?: number;
}

interface OrderPredictionChartProps {
  data: OrderPredictionData[];
  loading?: boolean;
  error?: string | null;
  height?: number;
}

const OrderPredictionChart: React.FC<OrderPredictionChartProps> = ({
  data,
  loading = false,
  error = null,
  height = 400,
}) => {
  // Process and validate data
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map(item => ({
      date: item.date,
      orders_count: Math.max(0, Math.round(item.orders_count || 0)),
      isPrediction: Boolean(item.isPrediction),
      confidence_min: Math.round(item.confidence_min || 0),
      confidence_max: Math.round(item.confidence_max || 0),
      confidence_score: item.confidence_score || 0,
    })).filter(item => item.date && !isNaN(item.orders_count));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (processedData.length === 0) return null;
    
    const historicalData = processedData.filter(d => !d.isPrediction);
    const predictionData = processedData.filter(d => d.isPrediction);
    
    const currentOrders = historicalData.reduce((sum, d) => sum + d.orders_count, 0);
    const predictedOrders = predictionData.reduce((sum, d) => sum + d.orders_count, 0);
    
    const growthRate = historicalData.length > 0 ? 
      ((predictedOrders / predictionData.length) - (currentOrders / historicalData.length)) / 
      (currentOrders / historicalData.length) * 100 : 0;
    
    return {
      currentOrders,
      predictedOrders,
      growthRate,
      historicalDays: historicalData.length,
      predictionDays: predictionData.length,
      avgDailyOrders: historicalData.length > 0 ? (currentOrders / historicalData.length).toFixed(1) : 0,
    };
  }, [processedData]);

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const formatTooltip = (value: number, name: string) => {
    return [value.toLocaleString(), name];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <Typography>Loading order predictions...</Typography>
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

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            Order Predictions
          </Typography>
          {stats && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={`${stats.growthRate >= 0 ? '+' : ''}${stats.growthRate.toFixed(1)}%`}
                color={stats.growthRate >= 0 ? 'success' : 'error'}
                size="small"
                icon={stats.growthRate >= 0 ? <TrendingUp /> : <TrendingDown />}
              />
              <Chip
                label={`${formatNumber(stats.predictedOrders)} predicted`}
                variant="outlined"
                size="small"
                icon={<ShoppingCart />}
              />
            </Box>
          )}
        </Box>

        <ResponsiveContainer width="100%" height={height - 100}>
          <LineChart
            data={processedData}
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
            
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
              tick={{ fontSize: 12 }}
            />
            
            <YAxis
              tickFormatter={formatNumber}
              stroke="rgba(0, 0, 0, 0.6)"
              tick={{ fontSize: 12 }}
              label={{
                value: 'Orders',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle' }
              }}
            />
            
            <Tooltip
              labelFormatter={(label) => {
                try {
                  return new Date(label).toLocaleDateString('en-US', { 
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
                } catch {
                  return label;
                }
              }}
              formatter={formatTooltip}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }}
            />
            
            <Legend />
            
            {/* Historical Orders */}
            <Line
              type="monotone"
              dataKey="orders_count"
              stroke="#10b981"
              strokeWidth={3}
              name="Historical Orders"
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            
            {/* Prediction line separator */}
            {predictionStartDate && (
              <ReferenceLine
                x={predictionStartDate}
                stroke="rgba(139, 92, 246, 0.6)"
                strokeDasharray="5,5"
                strokeWidth={2}
                label={{ value: "Predictions →", position: "top" }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OrderPredictionChart; 