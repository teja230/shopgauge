import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import { TrendingUp, TrendingDown } from '@mui/icons-material';

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

const RevenuePredictionChart: React.FC<RevenuePredictionChartProps> = ({
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

  const formatTooltip = (value: number, name: string) => {
    return [`$${value.toLocaleString()}`, name];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <Typography>Loading revenue predictions...</Typography>
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
            Revenue Predictions
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
                label={`${formatCurrency(stats.predictedRevenue)} predicted`}
                variant="outlined"
                size="small"
              />
            </Box>
          )}
        </Box>

        <ResponsiveContainer width="100%" height={height - 100}>
          <AreaChart
            data={processedData}
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="predictionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            
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
              tickFormatter={formatCurrency}
              stroke="rgba(0, 0, 0, 0.6)"
              tick={{ fontSize: 12 }}
              label={{
                value: 'Revenue (USD)',
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
            
            {/* Historical Revenue */}
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              name="Historical Revenue"
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
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RevenuePredictionChart; 