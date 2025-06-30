import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Skeleton,
  Button,
  IconButton,
  LinearProgress,
  useTheme,
  useMediaQuery,
  Tooltip,
  Chip,
  Fade,
  Collapse,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
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
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'default',
  position: 'relative',
  overflow: 'visible',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  boxShadow: theme.shadows[2],
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    borderColor: theme.palette.primary.light,
  },
  // Mobile-first responsive design - disable hover effects on touch devices
  '@media (hover: none)': {
    '&:hover': {
      transform: 'none',
      boxShadow: theme.shadows[2],
      borderColor: theme.palette.divider,
    },
  },
  // Better mobile spacing and sizing
  [theme.breakpoints.down('sm')]: {
    borderRadius: 12,
    '&:hover': {
      transform: 'none',
    },
  },
}));

const StyledCardContent = styled(CardContent)(({ theme }) => ({
  padding: theme.spacing(3),
  paddingBottom: `${theme.spacing(3)} !important`,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
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
  marginBottom: theme.spacing(2),
  minHeight: 32,
  gap: theme.spacing(1),
}));

const MetricIconContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  flex: 1,
  minWidth: 0, // Allow text truncation
}));

const MetricLabelContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '2.25rem',
  lineHeight: 1.1,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5),
  fontFeatureSettings: '"tnum"', // Tabular numbers for better alignment
  wordBreak: 'break-word',
  // Mobile responsive font sizes with better scaling
  [theme.breakpoints.down('lg')]: {
    fontSize: '2rem',
  },
  [theme.breakpoints.down('md')]: {
    fontSize: '1.875rem',
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.75rem',
  },
  [theme.breakpoints.down('xs')]: {
    fontSize: '1.625rem',
  },
}));

const MetricLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: '0.025em',
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
  fontSize: '0.875rem',
  fontWeight: 600,
  color: deltaType === 'up' 
    ? theme.palette.success.main 
    : deltaType === 'down' 
    ? theme.palette.error.main 
    : theme.palette.text.secondary,
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
  height: 40,
  marginTop: theme.spacing(1),
  display: 'flex',
  alignItems: 'end',
  gap: 1,
  '& .trend-bar': {
    backgroundColor: theme.palette.primary.main,
    opacity: 0.7,
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

const MetricFooter = styled(Box)(({ theme }) => ({
  marginTop: 'auto',
  paddingTop: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
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
  onLoad,
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);
  
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
              <ErrorIcon color="error" />
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
                <Box sx={{ color: 'primary.main', display: 'flex' }}>
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
            {formatValue(value, unit)}
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