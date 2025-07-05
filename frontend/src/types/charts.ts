// Centralised analytics-chart typings
export interface RevenuePoint {
  created_at: string; // ISO date string
  total_price: number; // monetary value in base currency unit
}

export interface HistoricalPoint {
  kind: 'historical';
  date: string; // YYYY-MM-DD
  revenue: number;
  orders_count: number;
  conversion_rate: number; // percentage 0-100
  avg_order_value: number;
  isPrediction?: false;
}

export interface PredictionPoint extends Omit<HistoricalPoint, 'kind' | 'isPrediction'> {
  kind: 'prediction';
  isPrediction: true;
  confidence_interval: {
    revenue_min: number;
    revenue_max: number;
    orders_min: number;
    orders_max: number;
  };
  prediction_type: string;
  confidence_score: number; // 0 – 1
  // Flattened helpers used in tooltip
  revenue_min?: number;
  revenue_max?: number;
  orders_min?: number;
  orders_max?: number;
}

export type UnifiedDatum = HistoricalPoint | PredictionPoint;

/** Recharts payload shape received by custom tooltips */
export interface ChartPayload<T = unknown> {
  dataKey: keyof T;
  value: number;
  payload: T;
  color?: string;
  name?: string;
}

export interface TooltipProps<T = unknown> {
  active?: boolean;
  label?: string;
  payload?: ChartPayload<T>[];
}