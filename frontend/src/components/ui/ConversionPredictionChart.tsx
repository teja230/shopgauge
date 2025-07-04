import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
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
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { TrendingUp, TrendingDown, Percent } from '@mui/icons-material';

interface ConversionPredictionData {
  date: string;
  conversion_rate: number;
  isPrediction?: boolean;
  confidence_min?: number;
  confidence_max?: number;
  confidence_score?: number;
}

interface ConversionPredictionChartProps {
  data: ConversionPredictionData[];
  loading?: boolean;
  error?: string | null;
  height?: number;
}

const ConversionPredictionChart: React.FC<ConversionPredictionChartProps> = ({
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
      conversion_rate: Math.max(0, Math.min(100, item.conversion_rate || 0)),
      isPrediction: Boolean(item.isPrediction),
      confidence_min: Math.max(0, Math.min(100, item.confidence_min || 0)),
      confidence_max: Math.max(0, Math.min(100, item.confidence_max || 0)),
      confidence_score: item.confidence_score || 0,
    })).filter(item => item.date && !isNaN(item.conversion_rate));
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (processedData.length === 0) return null;
    
    const historicalData = processedData.filter(d => !d.isPrediction);
    const predictionData = processedData.filter(d => d.isPrediction);
    
    const avgHistoricalConversion = historicalData.length > 0 ? 
      historicalData.reduce((sum, d) => sum + d.conversion_rate, 0) / historicalData.length : 0;
    
    const avgPredictedConversion = predictionData.length > 0 ? 
      predictionData.reduce((sum, d) => sum + d.conversion_rate, 0) / predictionData.length : 0;
    
    const growthRate = avgHistoricalConversion > 0 ? 
      ((avgPredictedConversion - avgHistoricalConversion) / avgHistoricalConversion) * 100 : 0;
    
    return {
      avgHistoricalConversion,
      avgPredictedConversion,
      growthRate,
      historicalDays: historicalData.length,
      predictionDays: predictionData.length,
    };
  }, [processedData]);

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatTooltip = (value: number, name: string) => {
    return [`${value.toFixed(2)}%`, name];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <Typography>Loading conversion predictions...</Typography>
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
            Conversion Rate Predictions
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
                label={`${formatPercentage(stats.avgPredictedConversion)} avg`}
                variant="outlined"
                size="small"
                icon={<Percent />}
              />
            </Box>
          )}
        </Box>

        <ResponsiveContainer width="100%" height={height - 100}>
          <BarChart
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
              tickFormatter={formatPercentage}
              stroke="rgba(0, 0, 0, 0.6)"
              tick={{ fontSize: 12 }}
              domain={[0, 'dataMax']}
              label={{
                value: 'Conversion Rate (%)',
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
            
            {/* Historical Conversion Rate */}
            <Bar
              dataKey="conversion_rate"
              fill="#f59e0b"
              name="Conversion Rate"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
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
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ConversionPredictionChart; 