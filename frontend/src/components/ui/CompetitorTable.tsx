import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Stack,
  Chip,
  Skeleton,
  Alert,
  Tooltip,
  useTheme,
  useMediaQuery,
  Avatar,
  Collapse,
  Divider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  OpenInNew as OpenInNewIcon,
  ExpandMore as ExpandMoreIcon,
  AttachMoney as AttachMoneyIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Group as GroupIcon,
  Schedule as ScheduleIcon,
  Launch as LaunchIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';

export interface Competitor {
  id: string;
  url: string;
  label: string;
  price: number;
  inStock: boolean;
  percentDiff: number;
  lastChecked: string;
}

interface CompetitorTableProps {
  data: Competitor[];
  onDelete: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

// Mobile-first responsive container with improved performance
const ResponsiveContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  overflow: 'hidden',
  position: 'relative',
  // Desktop: Show table, hide cards
  [theme.breakpoints.up('md')]: {
    '& .desktop-table': {
      display: 'block',
    },
    '& .mobile-cards': {
      display: 'none',
    },
  },
  // Mobile/Tablet: Hide table, show cards
  [theme.breakpoints.down('md')]: {
    '& .desktop-table': {
      display: 'none',
    },
    '& .mobile-cards': {
      display: 'block',
    },
  },
}));

// Enhanced mobile card styling with better touch interactions
const CompetitorCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
    borderColor: theme.palette.primary.light,
  },
  '&:last-child': {
    marginBottom: 0,
  },
  // Touch device optimizations
  '@media (hover: none)': {
    '&:hover': {
      transform: 'none',
    },
  },
  // Active state for touch with better feedback
  '&:active': {
    transform: 'scale(0.98)',
    transition: 'transform 0.1s ease',
  },
}));

const CompetitorHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
  padding: theme.spacing(0.5),
}));

const MetricChip = styled(Chip)(({ theme }) => ({
  fontSize: '0.75rem',
  height: 32,
  fontWeight: 500,
  borderRadius: 20,
  '& .MuiChip-label': {
    paddingX: theme.spacing(1.5),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontFeatureSettings: '"tnum"', // Tabular numbers
  },
  '& .MuiChip-icon': {
    fontSize: '1rem',
    marginLeft: theme.spacing(0.5),
    marginRight: `-${theme.spacing(0.5)}`,
  },
  // Mobile optimizations with better touch targets
  [theme.breakpoints.down('sm')]: {
    fontSize: '0.8125rem',
    height: 36,
    minHeight: 36, // Ensure minimum touch target
    '& .MuiChip-label': {
      paddingX: theme.spacing(2),
    },
  },
}));

// Enhanced desktop table styling
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 16,
  boxShadow: theme.shadows[2],
  overflow: 'hidden',
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.grey[50],
  '& .MuiTableCell-head': {
    fontWeight: 600,
    color: theme.palette.text.primary,
    borderBottom: `2px solid ${theme.palette.divider}`,
    fontSize: '0.875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: theme.spacing(2),
    [theme.breakpoints.down('lg')]: {
      padding: theme.spacing(1.5),
      fontSize: '0.8125rem',
    },
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:last-child .MuiTableCell-root': {
    borderBottom: 0,
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  [theme.breakpoints.down('lg')]: {
    fontSize: '0.8125rem',
    padding: theme.spacing(1.5),
  },
}));

const ActionButtonGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  gap: theme.spacing(1),
  alignItems: 'center',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    width: '100%',
  },
}));

const StyledActionButton = styled(Button)(({ theme }) => ({
  minHeight: 44,
  borderRadius: 12,
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.875rem',
  padding: theme.spacing(1, 2),
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-1px)',
  },
  [theme.breakpoints.down('sm')]: {
    minHeight: 48,
    width: '100%',
    fontSize: '0.9375rem',
  },
  '@media (hover: none)': {
    '&:hover': {
      transform: 'none',
    },
  },
}));

// Loading skeleton component
const CompetitorSkeleton: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    return (
      <Stack spacing={2}>
        {[...Array(3)].map((_, index) => (
          <Card key={index} sx={{ p: 3, borderRadius: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Skeleton variant="circular" width={40} height={40} />
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" height={24} />
                  <Skeleton variant="text" width="40%" height={20} />
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 20 }} />
                <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 20 }} />
              </Stack>
            </Stack>
          </Card>
        ))}
      </Stack>
    );
  }

  return (
    <StyledTableContainer>
      <Table>
        <StyledTableHead>
          <TableRow>
            <StyledTableCell>Competitor</StyledTableCell>
            <StyledTableCell>Price</StyledTableCell>
            <StyledTableCell>Status</StyledTableCell>
            <StyledTableCell>Change</StyledTableCell>
            <StyledTableCell>Last Checked</StyledTableCell>
            <StyledTableCell>Actions</StyledTableCell>
          </TableRow>
        </StyledTableHead>
        <TableBody>
          {[...Array(3)].map((_, index) => (
            <StyledTableRow key={index}>
              <StyledTableCell>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="text" width={120} height={20} />
                </Stack>
              </StyledTableCell>
              <StyledTableCell><Skeleton variant="text" width={60} height={20} /></StyledTableCell>
              <StyledTableCell><Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 12 }} /></StyledTableCell>
              <StyledTableCell><Skeleton variant="text" width={50} height={20} /></StyledTableCell>
              <StyledTableCell><Skeleton variant="text" width={80} height={20} /></StyledTableCell>
              <StyledTableCell><Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 6 }} /></StyledTableCell>
            </StyledTableRow>
          ))}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );
};

// Helper functions
const getStatusColor = (inStock: boolean): 'success' | 'error' => 
  inStock ? 'success' : 'error';

const getStatusLabel = (inStock: boolean): string => 
  inStock ? 'In Stock' : 'Out of Stock';

const getPriceChangeColor = (percentDiff: number): 'error' | 'success' | 'default' => {
  if (percentDiff > 0) return 'error'; // Price increased (bad for competition)
  if (percentDiff < 0) return 'success'; // Price decreased (good for competition)
  return 'default';
};

const getPriceChangeIcon = (percentDiff: number): React.ReactElement | undefined => {
  if (percentDiff > 0) return <TrendingUpIcon fontSize="small" />;
  if (percentDiff < 0) return <TrendingDownIcon fontSize="small" />;
  return undefined;
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

const formatPercentChange = (percentDiff: number): string | null => {
  if (percentDiff === 0) return null;
  const sign = percentDiff > 0 ? '+' : '';
  return `${sign}${percentDiff.toFixed(1)}%`;
};

const formatLastChecked = (lastChecked: string): string => {
  try {
    const date = parseISO(lastChecked);
    const timeAgo = format(date, 'PPpp');
    
    // Show more precise time for recent checks
    const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutesAgo < 1) return 'Just now';
    if (minutesAgo === 1) return '1 minute ago';
    if (minutesAgo < 60) return `${minutesAgo} minutes ago`;
    
    return timeAgo;
  } catch {
    return 'Unknown';
  }
};

const getDomainFromUrl = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return url;
  }
};

const getCompetitorInitials = (label: string): string => {
  return label
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

// Mobile competitor card component
const MobileCompetitorCard: React.FC<{
  competitor: Competitor;
  onDelete: (id: string) => void;
}> = ({ competitor, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(competitor.id);
  };

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(competitor.url, '_blank', 'noopener,noreferrer');
  };

  const handleCardClick = () => {
    setExpanded(!expanded);
  };

  const percentChangeText = formatPercentChange(competitor.percentDiff);

  return (
    <CompetitorCard onClick={handleCardClick}>
      <CardContent sx={{ pb: 1 }}>
        <CompetitorHeader>
          <Avatar 
            sx={{ 
              bgcolor: 'primary.main', 
              width: 40, 
              height: 40,
              fontSize: '0.875rem',
              fontWeight: 600
            }}
          >
            {getCompetitorInitials(competitor.label)}
              </Avatar>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="subtitle1" 
              fontWeight={600} 
              noWrap
              sx={{ lineHeight: 1.2, mb: 0.5 }}
            >
              {competitor.label}
            </Typography>
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {getDomainFromUrl(competitor.url)}
            </Typography>
          </Box>

          <IconButton
            size="small"
            onClick={handleCardClick}
            sx={{ 
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
              minWidth: 44,
              minHeight: 44,
            }}
            aria-label={expanded ? 'Show less' : 'Show more'}
          >
            <ExpandMoreIcon />
          </IconButton>
        </CompetitorHeader>

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <MetricChip
            label={formatPrice(competitor.price)}
            color="primary"
            variant="filled"
            icon={<AttachMoneyIcon />}
          />
          
          <MetricChip
            label={getStatusLabel(competitor.inStock)}
            color={getStatusColor(competitor.inStock)}
            variant="outlined"
            icon={competitor.inStock ? <CheckCircleIcon /> : <CancelIcon />}
          />
          
          {percentChangeText && (
            <MetricChip
              label={percentChangeText}
              color={getPriceChangeColor(competitor.percentDiff)}
              variant="outlined"
              icon={getPriceChangeIcon(competitor.percentDiff)}
            />
          )}
        </Stack>

        <Collapse in={expanded} timeout={300}>
          <Divider sx={{ mb: 2 }} />
          
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Last Checked
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <ScheduleIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {formatLastChecked(competitor.lastChecked)}
                </Typography>
              </Stack>
            </Box>

            <ActionButtonGroup>
              <StyledActionButton
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={handleOpenUrl}
                sx={{ flex: 1 }}
              >
                Visit Site
              </StyledActionButton>
              
              <StyledActionButton
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                sx={{ flex: 1 }}
              >
                Remove
              </StyledActionButton>
            </ActionButtonGroup>
          </Stack>
        </Collapse>
      </CardContent>
    </CompetitorCard>
  );
};

// Desktop table row component
const DesktopTableRow: React.FC<{
  competitor: Competitor;
  onDelete: (id: string) => void;
}> = ({ competitor, onDelete }) => {
  const percentChangeText = formatPercentChange(competitor.percentDiff);

  const handleDelete = () => {
    onDelete(competitor.id);
  };

  const handleOpenUrl = () => {
    window.open(competitor.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <StyledTableRow>
      <StyledTableCell>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar 
            sx={{ 
              bgcolor: 'primary.main', 
              width: 32, 
              height: 32,
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            {getCompetitorInitials(competitor.label)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {competitor.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {getDomainFromUrl(competitor.url)}
            </Typography>
          </Box>
        </Stack>
      </StyledTableCell>

      <StyledTableCell>
        <Typography variant="body2" fontWeight={600} color="primary">
          {formatPrice(competitor.price)}
        </Typography>
      </StyledTableCell>

      <StyledTableCell>
        <Chip
          label={getStatusLabel(competitor.inStock)}
          color={getStatusColor(competitor.inStock)}
          size="small"
          variant="outlined"
          icon={competitor.inStock ? <CheckCircleIcon /> : <CancelIcon />}
        />
      </StyledTableCell>

      <StyledTableCell>
        {percentChangeText ? (
          <Chip
            label={percentChangeText}
            color={getPriceChangeColor(competitor.percentDiff)}
            size="small"
            variant="outlined"
            icon={getPriceChangeIcon(competitor.percentDiff)}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No change
          </Typography>
        )}
      </StyledTableCell>

      <StyledTableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          <ScheduleIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {formatLastChecked(competitor.lastChecked)}
          </Typography>
        </Stack>
      </StyledTableCell>

      <StyledTableCell>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Visit competitor website">
            <IconButton 
              size="small" 
              onClick={handleOpenUrl}
              sx={{ minWidth: 36, minHeight: 36 }}
            >
              <LaunchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Remove competitor">
            <IconButton 
              size="small" 
              color="error" 
              onClick={handleDelete}
              sx={{ minWidth: 36, minHeight: 36 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </StyledTableCell>
    </StyledTableRow>
  );
};

// Main component
export const CompetitorTable: React.FC<CompetitorTableProps> = ({ 
  data = [], 
  onDelete, 
  loading = false,
  error = null,
  onRetry,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Loading state
  if (loading) {
    return <CompetitorSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          onRetry && (
            <Button 
              color="inherit" 
              size="small" 
              onClick={onRetry}
              sx={{ minHeight: 44 }}
            >
              Retry
            </Button>
          )
        }
        sx={{ borderRadius: 2 }}
      >
        <Typography variant="body2" sx={{ mb: 1 }}>
          Failed to load competitor data
        </Typography>
        {error}
      </Alert>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <Card sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
        <GroupIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No competitors yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add competitors to track their prices and inventory status.
        </Typography>
      </Card>
    );
  }

  return (
    <ResponsiveContainer>
      {/* Mobile Cards */}
      <Box className="mobile-cards">
        <Stack spacing={2}>
          {data.map((competitor) => (
            <MobileCompetitorCard
              key={competitor.id}
              competitor={competitor}
              onDelete={onDelete}
            />
          ))}
        </Stack>
      </Box>

      {/* Desktop Table */}
      <Box className="desktop-table">
        <StyledTableContainer>
          <Table>
            <StyledTableHead>
              <TableRow>
                <TableCell>Competitor</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Change</TableCell>
                <TableCell>Last Checked</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </StyledTableHead>
            <TableBody>
              {data.map((competitor) => (
                <DesktopTableRow
                  key={competitor.id}
                  competitor={competitor}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        </StyledTableContainer>
      </Box>
    </ResponsiveContainer>
  );
};

export default CompetitorTable;
