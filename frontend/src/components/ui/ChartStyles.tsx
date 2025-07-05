import type { Theme } from '@mui/material/styles';

// Shared chart container styles
export const chartContainerStyles = (theme: Theme) => ({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

// Shared chart content area styles
export const chartContentStyles = (theme: Theme, height?: number) => ({
  flex: 1,
  minHeight: 300,
  height: height || 400,
  width: '100%',
  position: 'relative',
  '& .recharts-wrapper': {
    width: '100% !important',
    height: '100% !important',
  },
  '& .recharts-surface': {
    overflow: 'visible',
  },
  '& .recharts-cartesian-grid-horizontal line': {
    stroke: theme.palette.divider,
    strokeOpacity: 0.3,
  },
  '& .recharts-cartesian-grid-vertical line': {
    stroke: theme.palette.divider,
    strokeOpacity: 0.3,
  },
});

// Shared chart header styles
export const chartHeaderStyles = (theme: Theme) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  mb: theme.spacing(2),
  flexWrap: 'wrap',
  gap: 1,
});

// Shared chart title styles
export const chartTitleStyles = (theme: Theme) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  color: theme.palette.text.primary,
  fontWeight: 600,
});

// Shared toggle button group styles
export const toggleButtonGroupStyles = (theme: Theme, isMobile: boolean) => ({
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  '& .MuiToggleButton-root': {
    px: theme.spacing(1),
    py: theme.spacing(0.5),
    minWidth: 'auto',
    border: 'none',
    '&.Mui-selected': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
    },
  },
});

// Shared stats row styles
export const statsRowStyles = (theme: Theme) => ({
  display: 'flex',
  gap: theme.spacing(1),
  mb: theme.spacing(2),
  flexWrap: 'wrap',
});

// Shared loading container styles
export const loadingContainerStyles = (theme: Theme, height?: number) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: height || 400,
  flexDirection: 'column',
  gap: 2,
});

// Shared error container styles
export const errorContainerStyles = (theme: Theme, height?: number) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: height || 400,
  flexDirection: 'column',
  gap: 2,
});

// Shared tooltip styles
export const tooltipStyles = (theme: Theme) => ({
  p: 2,
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 2,
  minWidth: 200,
  backdropFilter: 'blur(10px)',
});

// Enhanced Color Scheme for Consistent Chart Visualization
// Historical data: Strong, solid colors for real data
// Forecast data: Lighter, dashed versions to indicate predictions

export const UNIFIED_COLOR_SCHEME = {
  historical: {
    revenue: '#2563eb',      // Strong blue for revenue (primary)
    orders: '#10b981',       // Strong green for orders  
    conversion: '#f59e0b',   // Strong amber for conversion
  },
  forecast: {
    revenue: '#93c5fd',      // Light blue for revenue predictions
    orders: '#6ee7b7',       // Light green for order predictions
    conversion: '#fbbf24',   // Light amber for conversion predictions
  },
  confidence: {
    high: '#059669',         // Green for high confidence (>70%)
    medium: '#d97706',       // Orange for medium confidence (40-70%)
    low: '#dc2626',          // Red for low confidence (<40%)
  },
  gradients: {
    revenue: {
      historical: 'linear-gradient(180deg, rgba(37, 99, 235, 0.3) 0%, rgba(37, 99, 235, 0.05) 100%)',
      forecast: 'linear-gradient(180deg, rgba(147, 197, 253, 0.4) 0%, rgba(147, 197, 253, 0.1) 100%)',
    },
    orders: {
      historical: 'linear-gradient(180deg, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0.05) 100%)',
      forecast: 'linear-gradient(180deg, rgba(110, 231, 183, 0.4) 0%, rgba(110, 231, 183, 0.1) 100%)',
    },
    conversion: {
      historical: 'linear-gradient(180deg, rgba(245, 158, 11, 0.3) 0%, rgba(245, 158, 11, 0.05) 100%)',
      forecast: 'linear-gradient(180deg, rgba(251, 191, 36, 0.4) 0%, rgba(251, 191, 36, 0.1) 100%)',
    },
  }
};

// Chart styling configurations
export const chartTypeConfig = {
  line: {
    strokeWidth: {
      historical: 3,
      forecast: 2,
    },
    strokeDasharray: {
      historical: '',
      forecast: '8 4',
    },
    dot: {
      historical: { r: 4, strokeWidth: 2 },
      forecast: { r: 3, strokeWidth: 1 },
    },
  },
  area: {
    strokeWidth: {
      historical: 3,
      forecast: 2,
    },
    strokeDasharray: {
      historical: '',
      forecast: '8 4',
    },
    fillOpacity: {
      historical: 0.6,
      forecast: 0.4,
    },
  },
  bar: {
    opacity: {
      historical: 0.9,
      forecast: 0.7,
    },
    radius: [2, 2, 0, 0],
  },
};

// Shared chart common props
export const chartCommonProps = {
  margin: { top: 10, right: 30, left: 20, bottom: 20 },
};

// Shared gradient definitions
export const createGradientDefs = (gradientId: string, predictionGradientId: string, theme: Theme) => (
  <defs>
    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
      <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.05} />
    </linearGradient>
    <linearGradient id={predictionGradientId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={theme.palette.secondary.main} stopOpacity={0.3} />
      <stop offset="95%" stopColor={theme.palette.secondary.main} stopOpacity={0.05} />
    </linearGradient>
  </defs>
);

// Shared axis styles
export const axisStyles = (theme: Theme) => ({
  stroke: theme.palette.text.secondary,
  tick: { fontSize: 12, fill: theme.palette.text.secondary },
  axisLine: { stroke: theme.palette.divider },
});

// Shared grid styles
export const gridStyles = (theme: Theme) => ({
  strokeDasharray: "3 3",
  stroke: theme.palette.divider,
  opacity: 0.6,
});

// Shared dot styles
export const dotStyles = (color: string) => ({
  fill: color,
  strokeWidth: 2,
  r: 4,
});

// Shared active dot styles
export const activeDotStyles = (color: string) => ({
  r: 6,
  fill: color,
  stroke: '#fff',
  strokeWidth: 2,
});

// Shared bar styles
export const barStyles = (color: string) => ({
  fill: color,
  radius: [4, 4, 0, 0] as [number, number, number, number],
  opacity: 0.8,
  isAnimationActive: false,
});

// Shared line styles
export const lineStyles = (color: string) => ({
  stroke: color,
  strokeWidth: 3,
  connectNulls: false,
  isAnimationActive: false,
});

// Shared area styles
export const areaStyles = (color: string, gradientId: string) => ({
  stroke: color,
  strokeWidth: 3,
  fill: `url(#${gradientId})`,
  connectNulls: false,
  isAnimationActive: false,
});

// Shared reference line styles
export const referenceLineStyles = (theme: Theme) => ({
  stroke: theme.palette.secondary.main,
  strokeDasharray: "5,5",
  strokeWidth: 2,
  label: {
    value: "AI Forecasts →",
    position: "top" as const,
    style: { fill: theme.palette.secondary.main, fontWeight: 600 }
  },
});

// Shared chip styles for stats
export const statChipStyles = (theme: Theme) => ({
  fontWeight: 600,
});

// Shared forecast chip styles
export const forecastChipStyles = (theme: Theme) => ({
  fontWeight: 600,
  variant: "outlined",
  size: "small",
});

// Shared container styles for prediction view
export const predictionContainerStyles = (theme: Theme, height?: number) => ({
  width: '100%',
  minHeight: { xs: 450, sm: 500, md: height || 550 },
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
  border: `1px solid ${theme.palette.divider}`,
  overflow: 'hidden',
});

// Shared header styles for prediction view
export const predictionHeaderStyles = (theme: Theme) => ({
  p: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
});

// Shared content area styles for prediction view
export const predictionContentStyles = (theme: Theme) => ({
  flex: 1,
  minHeight: 400,
  p: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.default,
  position: 'relative',
});

// Shared toggle button styles for prediction view
export const predictionToggleStyles = (theme: Theme, isMobile: boolean) => ({
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  width: isMobile ? '100%' : 'auto',
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontWeight: 600,
    px: theme.spacing(2),
    py: theme.spacing(1.5),
    border: 'none',
    color: theme.palette.text.secondary,
    minHeight: isMobile ? 48 : 44,
    width: isMobile ? '100%' : 'auto',
    justifyContent: isMobile ? 'flex-start' : 'center',
    borderRadius: theme.shape.borderRadius,
    position: 'relative',
    '&.Mui-selected': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      boxShadow: `0 2px 8px ${theme.palette.primary.main}30`,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '60%',
        height: 2,
        backgroundColor: theme.palette.primary.main,
        borderRadius: 1,
      },
    },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      transform: 'translateY(-1px)',
    },
    transition: 'all 0.2s ease',
  },
});

// Shared forecast toggle styles
export const forecastToggleStyles = (theme: Theme, showPredictions: boolean) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  p: 1.5,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: showPredictions ? `${theme.palette.secondary.main}10` : theme.palette.background.default,
  border: `1px solid ${showPredictions ? theme.palette.secondary.main : theme.palette.divider}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: showPredictions ? `${theme.palette.secondary.main}15` : theme.palette.action.hover,
  },
});

// Shared stats display styles
export const statsDisplayStyles = (theme: Theme) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  mb: theme.spacing(2),
  p: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
});

// Shared stat box styles
export const statBoxStyles = (theme: Theme, isForecast = false) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  p: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${isForecast ? theme.palette.secondary.main + '40' : theme.palette.divider}`,
  minWidth: 120,
  flex: 1,
  position: 'relative',
  ...(isForecast && {
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: theme.palette.secondary.main,
      borderRadius: `${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0 0`,
    },
  }),
}); 