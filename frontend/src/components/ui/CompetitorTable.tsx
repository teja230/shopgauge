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
  Archive as ArchiveIcon,
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
  Link as LinkIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import StoreLogo from './StoreLogo';

import { styled } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

export interface Competitor {
  id: string;
  url: string;
  label: string;
  price: number;
  inStock: boolean;
  percentDiff: number;
  lastChecked: string;
  shopifyProductId?: string; // Optional field for product association
  productTitle?: string; // Product title for display
  priceLoading?: boolean; // Indicates if price is being fetched
}

interface CompetitorTableProps {
  data: Competitor[];
  onDelete: (id: string) => void;
  onLinkProduct?: (competitor: Competitor) => void;
  onViewGraph?: (competitor: Competitor) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  sectionTitle?: string;
  sectionCount?: number;
  sectionColor?: 'green' | 'orange';
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
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

const StyledTableRow = styled(TableRow)<{ $highlighted?: boolean; $highlightColor?: 'success' | 'warning' }>(({ theme, $highlighted, $highlightColor }) => ({
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:last-child .MuiTableCell-root': {
    borderBottom: 0,
  },
  // Highlight styles
  ...($highlighted && {
    backgroundColor: $highlightColor === 'success' 
      ? 'rgba(34, 197, 94, 0.1)' // Green background for restore
      : 'rgba(245, 158, 11, 0.1)', // Orange background for archive/delete
    borderLeft: `4px solid ${
      $highlightColor === 'success' 
        ? theme.palette.success.main 
        : theme.palette.warning.main
    }`,
    '&:hover': {
      backgroundColor: $highlightColor === 'success' 
        ? 'rgba(34, 197, 94, 0.15)' 
        : 'rgba(245, 158, 11, 0.15)',
    },
  }),
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

const getPriceChangeColor = (percentDiff: number): 'success' | 'error' | 'default' => {
  if (percentDiff > 0) return 'success'; // Green for positive changes
  if (percentDiff < 0) return 'error'; // Red for negative changes
  return 'default'; // Default for no change
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
  // Handle special cases
  if (lastChecked === 'Never' || lastChecked === 'Unknown' || !lastChecked) {
    return 'Not checked yet';
  }
  
  try {
    let date: Date;
    
    // Handle different timestamp formats from backend
    if (lastChecked.includes('T') && lastChecked.includes('Z')) {
      // ISO format: "2025-07-29T17:59:19.391Z"
      date = parseISO(lastChecked);
    } else if (lastChecked.includes(' ') && lastChecked.includes(':')) {
      // Database format: "2025-07-29 17:59:19.391"
      date = new Date(lastChecked.replace(' ', 'T') + 'Z');
    } else {
      // Try direct parsing
      date = new Date(lastChecked);
    }
    
    // Validate the date
    if (isNaN(date.getTime())) {
      console.warn('Invalid date format for lastChecked:', lastChecked);
      return 'Not checked yet';
    }
    
    const timeAgo = format(date, 'PPpp');
    
    // Show more precise time for recent checks
    const secondsAgo = Math.floor((Date.now() - date.getTime()) / 1000);
    const minutesAgo = Math.floor(secondsAgo / 60);
    const hoursAgo = Math.floor(minutesAgo / 60);
    const daysAgo = Math.floor(hoursAgo / 24);
    
    if (secondsAgo < 30) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo} seconds ago`;
    if (minutesAgo < 1) return 'Just now';
    if (minutesAgo === 1) return '1 minute ago';
    if (minutesAgo < 60) return `${minutesAgo} minutes ago`;
    if (hoursAgo === 1) return '1 hour ago';
    if (hoursAgo < 24) return `${hoursAgo} hours ago`;
    if (daysAgo === 1) return '1 day ago';
    if (daysAgo < 7) return `${daysAgo} days ago`;
    
    return timeAgo;
  } catch (error) {
    console.warn('Error parsing lastChecked timestamp:', lastChecked, error);
    return 'Not checked yet';
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



const getProductLink = (competitor: Competitor, shop: string | null): string | null => {
  if (competitor.shopifyProductId) {
    // Only return link if we have a valid shop domain
    if (shop && shop.includes('.myshopify.com')) {
      // Use the same approach as Dashboard - create admin URL with product ID
      return `https://${shop}/admin/products/${competitor.shopifyProductId}`;
    }
  }
  return null;
};

// Modern loading spinner component with tooltip
const LoadingSpinner: React.FC<{ size?: number; tooltip?: string }> = ({ size = 20, tooltip = "Loading price data..." }) => (
  <Tooltip 
    title={tooltip}
    placement="top"
    arrow
  >
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid',
        borderColor: 'primary.light',
        borderTopColor: 'primary.main',
        animation: 'spin 1s linear infinite',
        '@keyframes spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        cursor: 'help'
      }}
    />
  </Tooltip>
);

// Mobile competitor card component
const MobileCompetitorCard: React.FC<{
  competitor: Competitor;
  onDelete: (id: string) => void;
  onViewGraph?: (competitor: Competitor) => void;
}> = ({ competitor, onDelete, onViewGraph }) => {
  const [expanded, setExpanded] = useState(false);
  const { shop } = useAuth();

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
          <StoreLogo 
            url={competitor.url}
            size={40}
            label={competitor.label}
          />
          
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
          {competitor.priceLoading ? (
            <MetricChip
              label="Loading..."
              color="default"
              variant="outlined"
              icon={<LoadingSpinner size={16} tooltip="Fetching current price from competitor website..." />}
            />
          ) : !competitor.inStock && competitor.price === 0 ? (
            <MetricChip
              label="Out of Stock"
              color="error"
              variant="outlined"
              icon={<CancelIcon />}
            />
          ) : competitor.price === 0 ? (
            <MetricChip
              label="Price Unavailable"
              color="default"
              variant="outlined"
              icon={<AttachMoneyIcon />}
            />
          ) : (
            <MetricChip
              label={formatPrice(competitor.price)}
              color="primary"
              variant="filled"
              icon={<AttachMoneyIcon />}
            />
          )}
          
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
                Product Association
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {competitor.shopifyProductId ? (
                  <Tooltip 
                    title={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {competitor.productTitle || 'Associated Product'}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          Click to view in your store
                        </Typography>
                      </Box>
                    }
                    arrow
                    placement="top"
                  >
                    <Chip
                      label="Associated"
                      color="success"
                      size="small"
                      variant="outlined"
                      icon={<CheckCircleIcon />}
                      onClick={() => {
                        const productLink = getProductLink(competitor, shop);
                        if (productLink) {
                          window.open(productLink, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'success.light',
                          color: 'success.contrastText'
                        }
                      }}
                    />
                  </Tooltip>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Auto-selected
                  </Typography>
                )}
              </Stack>
            </Box>

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
              
              {onViewGraph && (
                <StyledActionButton
                  variant="outlined"
                  color="info"
                  startIcon={<BarChartIcon />}
                  onClick={() => onViewGraph(competitor)}
                  disabled={!competitor.lastChecked}
                  sx={{ 
                    flex: 1,
                    opacity: competitor.lastChecked ? 1 : 0.4,
                    '&:disabled': {
                      opacity: 0.4,
                      cursor: 'not-allowed'
                    }
                  }}
                >
                  {competitor.lastChecked ? 'View History' : 'No Data'}
                </StyledActionButton>
              )}
              
              <StyledActionButton
                variant="outlined"
                color="warning"
                startIcon={<ArchiveIcon />}
                onClick={handleDelete}
                sx={{ flex: 1 }}
              >
                Archive
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
  onLinkProduct?: (competitor: Competitor) => void;
  onViewGraph?: (competitor: Competitor) => void;
  highlighted?: boolean;
  highlightColor?: 'success' | 'warning';
}> = ({ competitor, onDelete, onLinkProduct, onViewGraph, highlighted = false, highlightColor }) => {
  const percentChangeText = formatPercentChange(competitor.percentDiff);
  const { shop } = useAuth();

  const handleDelete = () => {
    onDelete(competitor.id);
  };

  const handleOpenUrl = () => {
    window.open(competitor.url, '_blank', 'noopener,noreferrer');
  };

  const handleProductClick = () => {
    const productLink = getProductLink(competitor, shop);
    if (productLink) {
      window.open(productLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <StyledTableRow
      $highlighted={highlighted}
      $highlightColor={highlightColor}
    >
      <StyledTableCell>
        <Stack direction="row" spacing={2} alignItems="center">
          <StoreLogo 
            url={competitor.url}
            size={32}
            label={competitor.label}
          />
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
        {competitor.priceLoading ? (
          <Box display="flex" alignItems="center" justifyContent="center">
            <LoadingSpinner size={20} tooltip="Fetching current price from competitor website..." />
          </Box>
        ) : !competitor.inStock && competitor.price === 0 ? (
          <Typography variant="body2" color="error" fontWeight={600}>
            Out of Stock
          </Typography>
        ) : competitor.price === 0 ? (
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Price Unavailable
          </Typography>
        ) : (
          <Typography variant="body2" fontWeight={600} color="primary">
            {formatPrice(competitor.price)}
          </Typography>
        )}
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
        {competitor.shopifyProductId ? (
          <Tooltip 
            title={
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>
                  {competitor.productTitle || 'Associated Product'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Click to view in your store
                </Typography>
              </Box>
            }
            arrow
            placement="top"
          >
            <Chip
              label="Associated"
              color="success"
              size="small"
              variant="outlined"
              icon={<CheckCircleIcon />}
              onClick={handleProductClick}
              sx={{ 
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'success.light',
                  color: 'success.contrastText'
                }
              }}
            />
          </Tooltip>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Auto-selected
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
          
          {onLinkProduct && (
            <Tooltip title={competitor.shopifyProductId ? "Change product association" : "Link to product"}>
              <IconButton 
                size="small" 
                color="primary"
                onClick={() => onLinkProduct(competitor)}
                sx={{ minWidth: 36, minHeight: 36 }}
              >
                <LinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          {onViewGraph && (
            <Tooltip title={competitor.lastChecked ? "View price history" : "No price history available"}>
              <IconButton 
                size="small" 
                color="info"
                onClick={() => onViewGraph(competitor)}
                disabled={!competitor.lastChecked}
                sx={{ 
                  minWidth: 36, 
                  minHeight: 36,
                  opacity: competitor.lastChecked ? 1 : 0.4,
                  '&:disabled': {
                    opacity: 0.4,
                    cursor: 'not-allowed'
                  }
                }}
              >
                <BarChartIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          <Tooltip title="Archive competitor">
            <IconButton 
              size="small" 
              color="warning" 
              onClick={handleDelete}
              sx={{ minWidth: 36, minHeight: 36 }}
            >
              <ArchiveIcon fontSize="small" />
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
  onLinkProduct,
  onViewGraph,
  loading = false,
  error = null,
  onRetry,
  sectionTitle,
  sectionCount,
  sectionColor = 'green',
  onToggleCollapse,
  isCollapsed = false,
}) => {
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(new Set());

  // Function to highlight a row briefly
  const highlightRow = (competitorId: string, color: 'success' | 'warning') => {
    setHighlightedRows(prev => new Set([...prev, competitorId]));
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      setHighlightedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(competitorId);
        return newSet;
      });
    }, 2000);
  };

  // Enhanced delete handler with highlighting
  const handleDeleteWithHighlight = (competitorId: string) => {
    highlightRow(competitorId, 'warning');
    onDelete(competitorId);
  };
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
      {/* Integrated Section Header */}
      {sectionTitle && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {onToggleCollapse && (
              <IconButton
                onClick={onToggleCollapse}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <svg
                  className={`w-4 h-4 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </IconButton>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box 
                sx={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: '50%',
                  backgroundColor: sectionColor === 'green' ? 'success.main' : 'warning.main'
                }} 
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {sectionTitle}
              </Typography>
              {sectionCount !== undefined && (
                <Chip
                  label={sectionCount}
                  size="small"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.75rem',
                    backgroundColor: 'grey.100',
                    color: 'text.secondary'
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Mobile Cards */}
      <Box className="mobile-cards">
        <Stack spacing={2}>
          {data.map((competitor) => (
            <MobileCompetitorCard
              key={competitor.id}
              competitor={competitor}
              onDelete={handleDeleteWithHighlight}
              onViewGraph={onViewGraph}
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
                <TableCell>
                  <span>Competitor</span>
                </TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Change</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Last Checked</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </StyledTableHead>
            <TableBody>
              {data.map((competitor) => (
                <DesktopTableRow
                  key={competitor.id}
                  competitor={competitor}
                  onDelete={handleDeleteWithHighlight}
                  onLinkProduct={onLinkProduct}
                  onViewGraph={onViewGraph}
                  highlighted={highlightedRows.has(competitor.id)}
                  highlightColor={highlightedRows.has(competitor.id) ? 'warning' : undefined}
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
