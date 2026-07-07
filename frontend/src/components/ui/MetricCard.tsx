import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
  IconButton,
  LinearProgress,
  useTheme,
  Tooltip,
  Chip,
  Fade,
  Collapse,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Minus as RemoveIcon,
  RefreshCw as RefreshIcon,
  ChevronDown as ExpandMoreIcon,
  AlertCircle as ErrorIcon,
} from 'lucide-react';
import { styled } from '@mui/material/styles';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onLoad?: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'compact' | 'detailed';
  subtitle?: string;
  trend?: number[];
  description?: string;
  progress?: number; // 0-100 percentage for progress display
  target?: number; // Target value for comparison
  unit?: string; // Currency, percentage, etc.
  period?: string; // Time period (e.g., "vs last month")
}

// Enhanced styled components with mobile-first enterprise design
const StyledMetricCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
  cursor: 'default',
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 8,
  boxShadow: '0 18px 40px -34px rgb(16 24 32 / 0.72)',
  isolation: 'isolate',
  '&::after': {
    content: '""',
    position: 'absolute',
    width: 132,
    height: 132,
    right: -58,
    top: -62,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(47,91,234,0.16), transparent 62%)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: 'linear-gradient(90deg, #2f5bea 0%, #7c9cff 100%)',
  },
  '&:hover': {
    boxShadow: '0 26px 58px -40px rgb(16 24 32 / 0.82)',
    borderColor: 'rgba(47, 91, 234, 0.32)',
    transform: 'translateY(-1px)',
  },
  // Mobile-first responsive design - disable hover effects on touch devices
  '@media (hover: none)': {
    '&:hover': {
      transform: 'none',
      boxShadow: '0 1px 2px rgb(15 23 42 / 0.06)',
      borderColor: theme.palette.divider,
    },
  },
  // Better mobile spacing and sizing
  [theme.breakpoints.down('sm')]: {
    borderRadius: 8,
    '&:hover': {
      transform: 'none',
    },
  },
}));

const StyledCardContent = styled(CardContent)(({ theme }) => ({
  padding: theme.spacing(2.25, 2.25, 2),
  paddingBottom: `${theme.spacing(2.25)} !important`,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  position: 'relative',
  zIndex: 1,
  // Mobile optimization
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2.5),
    paddingBottom: `${theme.spacing(2.5)} !important`,
  },
  [theme.breakpoints.down('xs')]: {
    padding: theme.spacing(2),
    paddingBottom: `${theme.spacing(2)} !important`,
  },
}));

const MetricHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(1.5),
  minHeight: 30,
  gap: theme.spacing(1),
}));

const MetricIconContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  flex: 1,
  minWidth: 0, // Allow text truncation
}));

const MetricLabelContainer = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  fontWeight: 850,
  fontSize: '1.72rem',
  lineHeight: 1.1,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5),
  fontFeatureSettings: '"tnum"', // Tabular numbers for better alignment
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  // Mobile responsive font sizes with better scaling
  [theme.breakpoints.down('lg')]: {
    fontSize: '1.65rem',
  },
  [theme.breakpoints.down('md')]: {
    fontSize: '1.65rem',
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.62rem',
  },
  [theme.breakpoints.down('xs')]: {
    fontSize: '1.625rem',
  },
}));

const MetricLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.72rem',
  color: theme.palette.text.secondary,
  fontWeight: 800,
  lineHeight: 1.3,
  letterSpacing: 0,
  textTransform: 'uppercase',
  marginBottom: theme.spacing(0.5),
  // Better mobile readability
  [theme.breakpoints.down('sm')]: {
    fontSize: '0.8125rem',
  },
  [theme.breakpoints.down('xs')]: {
    fontSize: '0.75rem',
  },
}));

const MetricSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  fontWeight: 400,
  lineHeight: 1.4,
  [theme.breakpoints.down('sm')]: {
    fontSize: '0.6875rem',
  },
}));

const DeltaContainer = styled(Box)<{ deltaType: 'up' | 'down' | 'neutral' }>(({ theme, deltaType }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  alignSelf: 'flex-start',
  padding: theme.spacing(0.45, 0.8),
  borderRadius: 999,
  border: '1px solid',
  fontSize: '0.78rem',
  fontWeight: 800,
  color: deltaType === 'up'
    ? theme.palette.success.main
    : deltaType === 'down'
    ? theme.palette.error.main
    : theme.palette.text.secondary,
  backgroundColor: deltaType === 'up'
    ? 'rgba(5, 150, 105, 0.10)'
    : deltaType === 'down'
    ? 'rgba(220, 38, 38, 0.10)'
    : 'rgba(16, 24, 32, 0.06)',
  borderColor: deltaType === 'up'
    ? 'rgba(5, 150, 105, 0.18)'
    : deltaType === 'down'
    ? 'rgba(220, 38, 38, 0.18)'
    : theme.palette.divider,
  marginBottom: theme.spacing(1),
  '& .MuiSvgIcon-root': {
    fontSize: '1rem',
  },
}));

const ActionButton = styled(IconButton)(({ theme }) => ({
  padding: theme.spacing(0.75),
  // Mobile optimization with larger touch targets
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
    minWidth: 44,
    minHeight: 44,
  },
}));

const TrendVisualization = styled(Box)(({ theme }) => ({
  height: 34,
  marginTop: theme.spacing(1.5),
  display: 'flex',
  alignItems: 'end',
  gap: 1,
  '& .trend-bar': {
    backgroundColor: theme.palette.primary.main,
    opacity: 0.82,
    borderRadius: '2px 2px 0 0',
    flex: 1,
    minWidth: 2,
    transition: 'all 0.3s ease',
  },
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  '& .MuiLinearProgress-root': {
    borderRadius: 4,
    height: 6,
  },
}));

// Helper functions
const getDeltaIcon = (deltaType: 'up' | 'down' | 'neutral') => {
  switch (deltaType) {
    case 'up': return <TrendingUpIcon />;
    case 'down': return <TrendingDownIcon />;
    default: return <RemoveIcon />;
  }
};

const formatValue = (val: string | number, unit?: string): string => {
  if (typeof val === 'number') {
    // Smart number formatting for large numbers
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M${unit || ''}`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K${unit || ''}`;
    }
    return `${val.toLocaleString()}${unit || ''}`;
  }
  return val + (unit || '');
};

const parseFormattedMetric = (formattedValue: string) => {
  const match = formattedValue.match(/^([^0-9-]*)(-?\d[\d,]*\.?\d*)(.*)$/);
  if (!match) return null;

  const [, prefix, numericValue, suffix] = match;
  const target = Number(numericValue.replace(/,/g, ''));
  if (!Number.isFinite(target)) return null;

  const decimals = numericValue.includes('.') ? numericValue.split('.')[1].length : 0;
  return { prefix, target, suffix, decimals };
};

const useAnimatedMetricValue = (formattedValue: string) => {
  const [displayValue, setDisplayValue] = useState(formattedValue);

  React.useEffect(() => {
    const parsed = parseFormattedMetric(formattedValue);
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!parsed || prefersReducedMotion || parsed.target === 0) {
      setDisplayValue(formattedValue);
      return undefined;
    }

    let frameId = 0;
    const duration = 250;
    const start = performance.now();

    const formatAnimatedValue = (value: number) =>
      `${parsed.prefix}${value.toLocaleString(undefined, {
        minimumFractionDigits: parsed.decimals,
        maximumFractionDigits: parsed.decimals,
      })}${parsed.suffix}`;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(formatAnimatedValue(parsed.target * eased));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [formattedValue]);

  return displayValue;
};

const renderMiniChart = (trend: number[], theme: any) => {
  if (!trend || trend.length === 0) return null;

  const max = Math.max(...trend);
  const min = Math.min(...trend);
  const range = max - min || 1;

  return (
    <TrendVisualization>
      {trend.map((value, index) => {
        const height = Math.max(4, ((value - min) / range) * 32);
        return (
          <div
            key={index}
            className="trend-bar"
            style={{
              height: `${height}px`,
              backgroundColor: value > (trend[index - 1] || value)
                ? theme.palette.success.main
                : theme.palette.error.main
            }}
          />
        );
      })}
    </TrendVisualization>
  );
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  delta,
  deltaType = 'neutral',
  loading = false,
  error = null,
  onRetry,
  icon,
  variant = 'default',
  subtitle,
  trend,
  description,
  progress,
  target,
  unit,
  period
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const formattedValue = formatValue(value, unit);
  const animatedValue = useAnimatedMetricValue(formattedValue);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRetry?.();
  };

  const handleExpand = () => {
    if (description || trend) {
      setExpanded(!expanded);
    }
  };

  // Loading state
  if (loading) {
    return (
      <StyledMetricCard>
        <StyledCardContent>
          <MetricHeader>
            <MetricIconContainer>
              <Skeleton variant="circular" width={32} height={32} />
              <MetricLabelContainer>
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="40%" height={16} />
              </MetricLabelContainer>
            </MetricIconContainer>
          </MetricHeader>

          <Skeleton variant="text" width="80%" height={48} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="50%" height={20} />

          {variant === 'detailed' && (
            <Box sx={{ mt: 2 }}>
              <Skeleton variant="rectangular" width="100%" height={40} />
            </Box>
          )}
        </StyledCardContent>
      </StyledMetricCard>
    );
  }

  // Error state
  if (error) {
    return (
      <StyledMetricCard>
        <StyledCardContent>
          <MetricHeader>
            <MetricIconContainer>
              <ErrorIcon color="#dc2626" />
              <MetricLabelContainer>
                <MetricLabel>{label}</MetricLabel>
                <MetricSubtitle color="error">Error loading data</MetricSubtitle>
              </MetricLabelContainer>
            </MetricIconContainer>
            {onRetry && (
              <Tooltip title="Retry">
                <ActionButton onClick={handleRetry} size="small">
                  <RefreshIcon />
                </ActionButton>
              </Tooltip>
            )}
          </MetricHeader>

          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        </StyledCardContent>
      </StyledMetricCard>
    );
  }

  return (
    <Fade in timeout={300}>
      <StyledMetricCard>
        <StyledCardContent>
          <MetricHeader>
            <MetricIconContainer>
              {icon && (
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'primary.main',
                    bgcolor: 'rgba(47, 91, 234, 0.08)',
                    border: '1px solid rgba(47, 91, 234, 0.18)',
                    boxShadow: '0 12px 24px -18px rgba(47,91,234,0.9)',
                    flexShrink: 0,
                    '& .MuiSvgIcon-root': {
                      fontSize: 19,
                    },
                  }}
                >
                  {icon}
                </Box>
              )}
              <MetricLabelContainer>
                <MetricLabel>{label}</MetricLabel>
                {subtitle && <MetricSubtitle>{subtitle}</MetricSubtitle>}
              </MetricLabelContainer>
            </MetricIconContainer>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {(description || trend) && (
                <Tooltip title={expanded ? "Show less" : "Show more"}>
                  <ActionButton
                    onClick={handleExpand}
                    size="small"
                    sx={{
                      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s ease'
                    }}
                  >
                    <ExpandMoreIcon />
                  </ActionButton>
                </Tooltip>
              )}
            </Box>
          </MetricHeader>

          <MetricValue>
            {animatedValue}
          </MetricValue>

          {delta && (
            <DeltaContainer deltaType={deltaType}>
              {getDeltaIcon(deltaType)}
              <Typography variant="inherit">
                {delta}
              </Typography>
              {period && (
                <Typography variant="caption" sx={{ opacity: 0.8, ml: 0.5 }}>
                  {period}
                </Typography>
              )}
            </DeltaContainer>
          )}

          {progress !== undefined && (
            <ProgressContainer>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {progress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: progress >= 80
                      ? theme.palette.success.main
                      : progress >= 50
                      ? theme.palette.warning.main
                      : theme.palette.error.main
                  }
                }}
              />
            </ProgressContainer>
          )}

          {target && (
            <Box sx={{ mt: 1 }}>
              <Chip
                label={`Target: ${formatValue(target, unit)}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
            </Box>
          )}

          <Collapse in={expanded} timeout={300}>
            <Box sx={{ mt: 2 }}>
              {description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {description}
                </Typography>
              )}

              {trend && renderMiniChart(trend, theme)}
            </Box>
          </Collapse>

          {variant === 'detailed' && !expanded && trend && (
            <Box sx={{ mt: 1 }}>
              {renderMiniChart(trend, theme)}
            </Box>
          )}

          {!trend && (
            <Box
              sx={{
                mt: 'auto',
                pt: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: 0.5,
                alignItems: 'end',
                opacity: 0.55,
              }}
            >
              {[10, 14, 12, 20, 18, 26, 22, 30].map((height, index) => (
                <Box
                  key={index}
                  sx={{
                    height,
                    borderRadius: '3px 3px 0 0',
                    bgcolor: index > 4 ? 'secondary.main' : 'primary.main',
                  }}
                />
              ))}
            </Box>
          )}
        </StyledCardContent>
      </StyledMetricCard>
    </Fade>
  );
};

// Additional variants for different use cases
export const CompactMetricCard: React.FC<Omit<MetricCardProps, 'variant'>> = (props) => (
  <MetricCard {...props} variant="compact" />
);

export const DetailedMetricCard: React.FC<Omit<MetricCardProps, 'variant'>> = (props) => (
  <MetricCard {...props} variant="detailed" />
);

export default MetricCard;
