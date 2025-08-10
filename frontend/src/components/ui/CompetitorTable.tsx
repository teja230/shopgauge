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
  Collapse,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
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
  History as HistoryIcon,
  Refresh as RefreshIcon,
  VisibilityOff as VisibilityOffIcon,
  MoreVert as MoreVertIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import StoreLogo from './StoreLogo';
import { debugLog } from './DebugPanel';

import { styled } from '@mui/material/styles';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { refreshCompetitorPrices, getPriceRefreshStatus, refreshSingleCompetitor } from '../../api/index';
import { getPriceStatus } from '../../api';

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
  showingOldPrice?: boolean; // Indicates if showing old price for out-of-stock item
}

// Revert to colored icon style consistent with main branch (no muted ghost look)
const actionIconButtonSx = undefined as unknown as any;

// Secondary actions consolidated in an overflow menu for clarity
const RowOverflowMenu: React.FC<{
  competitor: Competitor;
  onOpenSite: () => void;
  onLinkProduct?: (c: Competitor) => void;
}> = ({ competitor, onOpenSite, onLinkProduct }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(competitor.url);
    } catch (_) {
      // ignore copy errors
    } finally {
      handleClose();
    }
  };

  return (
    <>
      <Tooltip title="More actions">
        <IconButton size="small" aria-label="More actions" onClick={handleOpen}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={() => { onOpenSite(); handleClose(); }}>
          <ListItemIcon>
            <LaunchIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Visit site" />
        </MenuItem>
        {onLinkProduct && (
          <MenuItem onClick={() => { onLinkProduct(competitor); handleClose(); }}>
            <ListItemIcon>
              <LinkIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={competitor.shopifyProductId ? 'Change product link' : 'Link to product'} />
          </MenuItem>
        )}
        <MenuItem onClick={handleCopy}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Copy URL" />
        </MenuItem>
      </Menu>
    </>
  );
};

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
  onRefreshPrices?: () => void;
  // Highlighting props for different actions
  highlightedCompetitorId?: string;
  highlightAction?: 'add' | 'archive' | 'restore';
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

// Price refresh button component
const PriceRefreshButton: React.FC<{
  onRefresh: () => void;
  canRefresh: boolean;
  staleCount: number;
  isLoading?: boolean;
}> = ({ onRefresh, canRefresh, staleCount, isLoading = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (!canRefresh) {
    return null;
  }

  return (
    <Tooltip title={`Refresh prices for ${staleCount} competitors (older than 24 hours)`}>
      <Button
        variant="contained"
        size="small"
        startIcon={isLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
        onClick={onRefresh}
        disabled={isLoading}
        sx={{
          ml: 1,
          minWidth: isMobile ? 'auto' : 140,
          height: 32,
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': {
            backgroundColor: 'primary.dark',
          },
          '&:disabled': {
            backgroundColor: 'action.disabledBackground',
            color: 'action.disabled',
          },
          '& .MuiButton-startIcon': {
            mr: isMobile ? 0 : 0.5,
          },
        }}
      >
        {isMobile ? (
          <RefreshIcon />
        ) : (
          `Refresh (${staleCount})`
        )}
      </Button>
    </Tooltip>
  );
};

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
    
    // Use relative time like main branch
    return formatDistanceToNow(date, { addSuffix: true });
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
  onDelete: (competitor: Competitor) => void;
  onViewGraph?: (competitor: Competitor) => void;
}> = ({ competitor, onDelete, onViewGraph }) => {
  const [expanded, setExpanded] = useState(false);
  const { shop } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRowRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshSingleCompetitor(competitor.id);
      const status = await getPriceStatus(competitor.id);
      competitor.price = status.price ?? competitor.price;
      competitor.inStock = status.inStock ?? competitor.inStock;
      competitor.lastChecked = status.lastChecked ?? competitor.lastChecked;
    } catch (error) {
      console.error('Failed to refresh competitor price:', error);
    }
    setIsRefreshing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(competitor);
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
           <Tooltip title="Price information not available from this competitor">
             <IconButton
               size="small"
               sx={{
                 color: 'text.secondary',
                 backgroundColor: 'rgba(0, 0, 0, 0.04)',
                 border: '1px solid rgba(0, 0, 0, 0.12)',
                 borderRadius: '4px',
                 minWidth: 32,
                 minHeight: 32,
                 '&:hover': {
                   backgroundColor: 'rgba(0, 0, 0, 0.08)',
                   borderColor: 'rgba(0, 0, 0, 0.24)',
                 },
               }}
             >
               <VisibilityOffIcon fontSize="small" />
             </IconButton>
           </Tooltip>
                   ) : competitor.showingOldPrice ? (
           <Tooltip title="Showing last known price - item is currently out of stock">
             <Box
               sx={{
                 display: 'flex',
                 alignItems: 'center',
                 gap: 1,
                 px: 1.5,
                 py: 0.5,
                 borderRadius: 1,
                 border: '1px solid',
                 borderColor: 'warning.main',
                 backgroundColor: 'warning.light',
                 color: 'warning.dark',
                 fontSize: '0.875rem',
                 fontWeight: 600,
                 minWidth: 60,
                 justifyContent: 'center',
               }}
             >
               <HistoryIcon sx={{ fontSize: '1rem' }} />
               {formatPrice(competitor.price)}
             </Box>
           </Tooltip>
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

            {/* Mobile: Icon-only buttons for compact layout */}
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
              <Tooltip title="Visit Site">
                <IconButton
                  size="medium"
                  onClick={handleOpenUrl}
                  sx={{ 
                    backgroundColor: 'primary.light',
                    color: 'primary.contrastText',
                    '&:hover': { backgroundColor: 'primary.main' }
                  }}
                >
                  <OpenInNewIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Refresh Price">
                <IconButton
                  size="medium"
                  onClick={handleRowRefresh}
                  disabled={isRefreshing}
                  sx={{ 
                    backgroundColor: 'info.light',
                    color: 'info.contrastText',
                    '&:hover': { backgroundColor: 'info.main' },
                    '&:disabled': { opacity: 0.6 }
                  }}
                >
                  {isRefreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
              
              {onViewGraph && (
                <Tooltip title={competitor.lastChecked ? "View History" : "No Data Available"}>
                  <span>
                    <IconButton
                      size="medium"
                      onClick={() => onViewGraph(competitor)}
                      disabled={!competitor.lastChecked}
                      sx={{ 
                        backgroundColor: 'success.light',
                        color: 'success.contrastText',
                        '&:hover': { backgroundColor: 'success.main' },
                        '&:disabled': { 
                          opacity: 0.4,
                          backgroundColor: 'grey.300',
                          color: 'grey.500'
                        }
                      }}
                    >
                      <BarChartIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              
              <Tooltip title="Archive">
                <IconButton
                  size="medium"
                  onClick={handleDelete}
                  sx={{ 
                    backgroundColor: 'warning.light',
                    color: 'warning.contrastText',
                    '&:hover': { backgroundColor: 'warning.main' }
                  }}
                >
                  <ArchiveIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Collapse>
      </CardContent>
    </CompetitorCard>
  );
};

// Desktop table row component
const DesktopTableRow: React.FC<{
  competitor: Competitor;
  onDelete: (competitor: Competitor) => void;
  onLinkProduct?: (competitor: Competitor) => void;
  onViewGraph?: (competitor: Competitor) => void;
  highlighted?: boolean;
  highlightColor?: 'success' | 'warning';
}> = ({ competitor, onDelete, onLinkProduct, onViewGraph, highlighted = false, highlightColor }) => {
  const percentChangeText = formatPercentChange(competitor.percentDiff);
  const { shop } = useAuth();

  const handleDelete = () => {
    onDelete(competitor);
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

  const [rowRefreshing, setRowRefreshing] = React.useState(false);
  const handleRowRefresh = async () => {
    if (rowRefreshing) return;
    setRowRefreshing(true);
    try {
      // Start per-competitor refresh
      await refreshSingleCompetitor(competitor.id);

      // Fetch latest status for this competitor and patch session cache entry
      const status = await getPriceStatus(competitor.id);

      // Optimistically update UI for this row
      competitor.price = status.price ?? competitor.price;
      competitor.inStock = status.inStock ?? competitor.inStock;
      competitor.lastChecked = status.lastChecked ?? competitor.lastChecked;

      // Update sessionStorage list cache in-place
      const shopDomain = shop || '';
      if (shopDomain) {
        const cacheKey = `mi_competitors_${shopDomain}`;
        try {
          const raw = sessionStorage.getItem(cacheKey);
          if (raw) {
            const arr = JSON.parse(raw) as any[];
            const idx = arr.findIndex((c: any) => String(c.id) === String(competitor.id));
            if (idx >= 0) {
              arr[idx] = {
                ...arr[idx],
                price: competitor.price,
                inStock: competitor.inStock,
                lastChecked: competitor.lastChecked,
              };
              sessionStorage.setItem(cacheKey, JSON.stringify(arr));
            }
          }
        } catch (_) {
          // ignore session errors
        }
      }
    } catch (e) {
      // noop; UI will remain unchanged on error
    } finally {
      setRowRefreshing(false);
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
           <Tooltip title="Price information not available from this competitor">
             <IconButton
               size="small"
               sx={{
                 color: 'text.secondary',
                 backgroundColor: 'rgba(0, 0, 0, 0.04)',
                 border: '1px solid rgba(0, 0, 0, 0.12)',
                 borderRadius: '4px',
                 minWidth: 32,
                 minHeight: 32,
                 '&:hover': {
                   backgroundColor: 'rgba(0, 0, 0, 0.08)',
                   borderColor: 'rgba(0, 0, 0, 0.24)',
                 },
               }}
             >
               <VisibilityOffIcon fontSize="small" />
             </IconButton>
           </Tooltip>
                 ) : competitor.showingOldPrice ? (
           <Tooltip title="Showing last known price - item is currently out of stock">
             <Typography 
               variant="body2" 
               fontWeight={600} 
               color="warning.dark"
               sx={{
                 px: 1.5,
                 py: 0.5,
                 borderRadius: 1,
                 border: '1px solid',
                 borderColor: 'warning.main',
                 backgroundColor: 'warning.light',
                 display: 'inline-flex',
                 alignItems: 'center',
                 gap: 0.5,
                 minWidth: 60,
                 textAlign: 'center',
               }}
             >
               <HistoryIcon fontSize="small" />
               {formatPrice(competitor.price)}
             </Typography>
           </Tooltip>
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
        <Stack direction="row" spacing={0.5} alignItems="center">
          {/* Primary action: Refresh */}
          <Tooltip title="Refresh price for this competitor">
            <span>
              <IconButton
                size="small"
                onClick={handleRowRefresh}
                disabled={rowRefreshing}
                aria-label="Refresh price"
                color="primary"
              
              >
                {rowRefreshing ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>

          {/* Primary action: View history (when available) */}
          <Tooltip title={competitor.lastChecked ? "View price history" : "No price history available"}>
            <span>
              <IconButton
                size="small"
                onClick={() => onViewGraph && onViewGraph(competitor)}
                disabled={!onViewGraph || !competitor.lastChecked}
                aria-label="View price history"
                color="info"
                sx={{ opacity: competitor.lastChecked ? 1 : 0.4 }}
              >
                <BarChartIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {/* Primary action: Archive */}
          <Tooltip title="Archive competitor">
            <IconButton size="small" onClick={handleDelete} aria-label="Archive competitor" color="warning">
              <ArchiveIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Overflow menu for secondary actions */}
          <RowOverflowMenu
            competitor={competitor}
            onOpenSite={handleOpenUrl}
            onLinkProduct={onLinkProduct}
          />
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
  onRefreshPrices,
  highlightedCompetitorId,
  highlightAction,
}) => {
  // Confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [competitorToDelete, setCompetitorToDelete] = useState<Competitor | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<{
    can_refresh: boolean;
    stale_count: number;
    total_competitors: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load refresh status on mount
  React.useEffect(() => {
    const loadRefreshStatus = async () => {
      try {
        const status = await getPriceRefreshStatus();
        setRefreshStatus({
          can_refresh: status.can_refresh,
          stale_count: status.stale_count,
          total_competitors: status.total_competitors,
        });
      } catch (error) {
        console.warn('Failed to load refresh status:', error);
      }
    };

    loadRefreshStatus();
  }, []);

  const handleRefreshPrices = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const result = await refreshCompetitorPrices();
      console.log('Price refresh started:', result);
      
      // Update status after refresh
      const newStatus = await getPriceRefreshStatus();
      setRefreshStatus({
        can_refresh: newStatus.can_refresh,
        stale_count: newStatus.stale_count,
        total_competitors: newStatus.total_competitors,
      });

      // Call parent callback if provided
      if (onRefreshPrices) {
        onRefreshPrices();
      }
    } catch (error) {
      console.error('Failed to refresh prices:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(new Set());

  // Function to highlight a row briefly
  const highlightRow = (competitorId: string | number, color: 'success' | 'warning') => {
    const competitorIdStr = String(competitorId);
    debugLog.info('highlightRow called', { competitorId: competitorIdStr, color }, 'CompetitorTable');
    setHighlightedRows(prev => {
      const newSet = new Set([...prev, competitorIdStr]);
      debugLog.info('Updated highlightedRows', { highlightedRows: Array.from(newSet) }, 'CompetitorTable');
      return newSet;
    });
    
    // Remove highlight after 5 seconds (industry standard for UI feedback)
    setTimeout(() => {
      setHighlightedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(competitorIdStr);
        debugLog.info('Removed highlight for', { competitorId: competitorIdStr }, 'CompetitorTable');
        return newSet;
      });
    }, 5000);
  };

  // Handle external highlighting from props
  React.useEffect(() => {
    if (highlightedCompetitorId && highlightAction) {
      debugLog.info('Highlighting triggered', { highlightedCompetitorId, highlightAction }, 'CompetitorTable');
      
      // Determine color based on action and section
      let color: 'success' | 'warning';
      
      if (highlightAction === 'add') {
        color = 'success'; // Green for adding
      } else if (highlightAction === 'archive') {
        color = 'warning'; // Orange for archiving
      } else if (highlightAction === 'restore') {
        color = 'success'; // Green for restoring
      } else {
        color = 'success';
      }
      
      debugLog.info('Highlighting with color', { color }, 'CompetitorTable');
      highlightRow(String(highlightedCompetitorId), color);
    }
  }, [highlightedCompetitorId, highlightAction]);

  // Confirmation dialog handlers
  const handleDeleteClick = (competitor: Competitor) => {
    setCompetitorToDelete(competitor);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (competitorToDelete) {
      highlightRow(String(competitorToDelete.id), 'warning');
      onDelete(competitorToDelete.id);
      setDeleteDialogOpen(false);
      setCompetitorToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setCompetitorToDelete(null);
  };

  // Enhanced delete handler with highlighting (now uses confirmation)
  const handleDeleteWithHighlight = (competitorId: string) => {
    const competitor = data.find(c => c.id === competitorId);
    if (competitor) {
      handleDeleteClick(competitor);
    }
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
          backgroundColor: 'background.paper',
          '@media (max-width: 600px)': {
            p: 2.5,
            minHeight: 56
          }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {onToggleCollapse && (
              <IconButton
                onClick={onToggleCollapse}
                size="small"
                sx={{ 
                  color: 'text.secondary',
                  minWidth: 44,
                  minHeight: 44,
                  '&:hover': {
                    color: 'text.primary'
                  },
                  '@media (max-width: 600px)': {
                    minWidth: 48,
                    minHeight: 48,
                  }
                }}
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
          
          {/* Price Refresh Button */}
          {refreshStatus && (
            <PriceRefreshButton
              onRefresh={handleRefreshPrices}
              canRefresh={refreshStatus.can_refresh}
              staleCount={refreshStatus.stale_count}
              isLoading={isRefreshing}
            />
          )}
        </Box>
      )}

      {/* Content Section - Collapsible */}
      <Collapse in={!isCollapsed} timeout={300}>
        {/* Mobile Cards */}
        <Box className="mobile-cards">
          <Stack spacing={2}>
            {data.map((competitor) => (
              <MobileCompetitorCard
                key={competitor.id}
                competitor={competitor}
                onDelete={handleDeleteClick}
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
                {data.map((competitor) => {
                  const isHighlighted = highlightedRows.has(competitor.id);
                  // Determine the correct highlight color based on the action
                  let highlightColor: 'success' | 'warning' | undefined = undefined;
                  if (isHighlighted) {
                    // Determine color based on the current highlight action
                    if (highlightAction === 'add') {
                      highlightColor = 'success'; // Green for adding
                    } else if (highlightAction === 'archive') {
                      highlightColor = 'warning'; // Orange for archiving
                    } else if (highlightAction === 'restore') {
                      highlightColor = 'success'; // Green for restoring
                    } else {
                      highlightColor = 'success'; // Default to success
                    }
                  }
                  return (
                    <DesktopTableRow
                      key={competitor.id}
                      competitor={competitor}
                      onDelete={handleDeleteClick}
                      onLinkProduct={onLinkProduct}
                      onViewGraph={onViewGraph}
                      highlighted={isHighlighted}
                      highlightColor={highlightColor}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </StyledTableContainer>
        </Box>
      </Collapse>

      {/* Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="delete-dialog-title">
          Archive Competitor
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to archive <strong>{competitorToDelete?.label}</strong>? 
            This will move the competitor to your archived list where you can restore it later if needed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="warning" variant="contained">
            Archive
          </Button>
        </DialogActions>
      </Dialog>
    </ResponsiveContainer>
  );
};

export default CompetitorTable;
