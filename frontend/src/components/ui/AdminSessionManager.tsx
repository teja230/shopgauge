import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Grid,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Stack
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  People as PeopleIcon,
  Computer as ComputerIcon,
  PhoneAndroid as PhoneIcon,
  Tablet as TabletIcon,
  DesktopMac as DesktopIcon,
  AccessTime as AccessTimeIcon,
  ExpandMore as ExpandMoreIcon,
  Store as StoreIcon,
  MonitorHeart as MonitorHeartIcon,
  Timeline as TimelineIcon,
  Settings as SettingsIcon,
  Clear as ClearIcon,
  Block as BlockIcon,
  RestartAlt as RestartAltIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNotifications } from '../../hooks/useNotifications';
import { 
  getAdminSessionHealth, 
  getAdminShopsWithSessions, 
  getAdminShopSessions, 
  refreshAdminShopSessions, 
  invalidateAdminShopSessions 
} from '../../api/admin';
import RefreshHeader from './RefreshHeader';
import { debugLog } from './DebugPanel';

interface SessionHealthData {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  uniqueShops: number;
  avgSessionsPerShop: number;
  healthScore: number;
  recommendations: string[];
}

interface ShopSessionData {
  shopDomain: string;
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  lastActivity: string;
}

interface DetailedSessionData {
  sessionId: string;
  createdAt: string;
  lastAccessedAt: string;
  ipAddress: string;
  userAgent: string | null;
  isActive: boolean;
  isExpired: boolean;
  expiresAt?: string;
}

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 20,
  overflow: 'hidden',
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(6px)',
  boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
  border: `1px solid ${theme.palette.divider}`,
  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
  },
}));

const MetricCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
  border: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  minHeight: 120,
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: 12,
  textTransform: 'none',
  fontWeight: 600,
  padding: theme.spacing(1.5, 3),
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
}));

const AdminSessionManager: React.FC = () => {
  const { addNotification } = useNotifications();
  const [sessionHealth, setSessionHealth] = useState<SessionHealthData | null>(null);
  const [shopsWithSessions, setShopsWithSessions] = useState<ShopSessionData[]>([]);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [shopSessions, setShopSessions] = useState<DetailedSessionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showShopDetails, setShowShopDetails] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'refresh' | 'invalidate';
    shopDomain: string;
  } | null>(null);

  // Optimized refresh state management
  const [healthRefreshCooldown, setHealthRefreshCooldown] = useState(0);
  const [shopsRefreshCooldown, setShopsRefreshCooldown] = useState(0);
  const [shopRefreshCooldowns, setShopRefreshCooldowns] = useState<Record<string, number>>({});

  
  // Debounce refs
  const healthRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shopsRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shopRefreshTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Add state for lastUpdated
  const [sessionHealthLastUpdated, setSessionHealthLastUpdated] = useState<Date | null>(null);
  const [shopsLastUpdated, setShopsLastUpdated] = useState<Date | null>(null);

  // Constants for refresh optimization
  const HEALTH_REFRESH_COOLDOWN = 120; // 2 minutes (increased from 30 seconds)
  const SHOPS_REFRESH_COOLDOWN = 60; // 60 seconds
  const SHOP_REFRESH_COOLDOWN = 45; // 45 seconds
  const DEBOUNCE_DELAY = 300; // 300ms debounce



  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (healthRefreshTimeoutRef.current) {
        clearTimeout(healthRefreshTimeoutRef.current);
      }
      if (shopsRefreshTimeoutRef.current) {
        clearTimeout(shopsRefreshTimeoutRef.current);
      }
      Object.values(shopRefreshTimeoutsRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Cooldown timers
  useEffect(() => {
    if (healthRefreshCooldown > 0) {
      const timer = setTimeout(() => setHealthRefreshCooldown(healthRefreshCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [healthRefreshCooldown]);

  useEffect(() => {
    if (shopsRefreshCooldown > 0) {
      const timer = setTimeout(() => setShopsRefreshCooldown(shopsRefreshCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [shopsRefreshCooldown]);

  // Shop-specific cooldown timers
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    Object.entries(shopRefreshCooldowns).forEach(([shopDomain, cooldown]) => {
      if (cooldown > 0) {
        const timer = setTimeout(() => {
          setShopRefreshCooldowns(prev => ({
            ...prev,
            [shopDomain]: prev[shopDomain] - 1
          }));
        }, 1000);
        timers.push(timer);
      }
    });
    
    return () => timers.forEach(timer => clearTimeout(timer));
  }, [shopRefreshCooldowns]);

  const fetchSessionHealth = useCallback(async (showNotification = false) => {
    if (healthLoading || healthRefreshCooldown > 0) return;
    
    setHealthLoading(true);
    try {
      const response = await getAdminSessionHealth();
      if (response.success) {
        setSessionHealth(response);
        if (showNotification) {
          addNotification('Session health data updated successfully', 'success');
        }
      } else {
        throw new Error(response.error || 'Failed to fetch session health');
      }
    } catch (error) {
      if (showNotification) {
        addNotification(
          error instanceof Error ? error.message : 'Failed to fetch session health',
          'error'
        );
      }
    } finally {
      setHealthLoading(false);
    }
  }, [addNotification, healthLoading, healthRefreshCooldown]);

  const fetchShopsWithSessions = useCallback(async () => {
    if (shopsLoading || shopsRefreshCooldown > 0) return;
    
    setShopsLoading(true);
    try {
      const response = await getAdminShopsWithSessions();
      if (response.success) {
        setShopsWithSessions(response.shops || []);
      } else {
        throw new Error(response.error || 'Failed to fetch shops with sessions');
      }
    } catch (error) {
      addNotification(
        error instanceof Error ? error.message : 'Failed to fetch shops with sessions',
        'error'
      );
    } finally {
      setShopsLoading(false);
    }
  }, [addNotification, shopsLoading, shopsRefreshCooldown]);

  const fetchShopSessions = useCallback(async (shopDomain: string) => {
    debugLog.info(`View Session button clicked for shop: ${shopDomain}`, { shopDomain }, 'AdminSessionManager');
    setSessionsLoading(true);
    
    try {
      debugLog.debug(`Starting API call to getAdminShopSessions for: ${shopDomain}`, { shopDomain }, 'AdminSessionManager');
      const response = await getAdminShopSessions(shopDomain);
      debugLog.info(`API response received for shop sessions`, { 
        shopDomain, 
        success: response.success, 
        sessionCount: response.sessions?.length || 0,
        hasError: !!response.error 
      }, 'AdminSessionManager');
      
      if (response.success) {
        setShopSessions(response.sessions || []);
        setSelectedShop(shopDomain);
        setShowShopDetails(true);
        debugLog.info(`Successfully opened shop sessions dialog for: ${shopDomain}`, { 
          shopDomain, 
          sessionCount: response.sessions?.length || 0 
        }, 'AdminSessionManager');
      } else {
        debugLog.error(`API returned error for shop sessions`, { 
          shopDomain, 
          error: response.error 
        }, 'AdminSessionManager');
        throw new Error(response.error || 'Failed to fetch shop sessions');
      }
    } catch (error) {
      debugLog.error(`Exception occurred while fetching shop sessions`, { 
        shopDomain, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 'AdminSessionManager');
      console.error('Error fetching shop sessions:', error);
      addNotification(
        error instanceof Error ? error.message : 'Failed to fetch shop sessions',
        'error'
      );
    } finally {
      setSessionsLoading(false);
      debugLog.debug(`fetchShopSessions completed for: ${shopDomain}`, { shopDomain }, 'AdminSessionManager');
    }
  }, [addNotification]);

  const handleRefreshShopSessions = useCallback(async (shopDomain: string) => {
    const currentCooldown = shopRefreshCooldowns[shopDomain] || 0;
    if (actionLoading || currentCooldown > 0) return;
    
    setActionLoading(`refresh-${shopDomain}`);
    try {
      const response = await refreshAdminShopSessions(shopDomain);
      if (response.success) {
        addNotification(
          `Refreshed sessions for ${shopDomain}: removed ${response.removedExpiredSessions} expired, ${response.remainingSessions} remaining`,
          'success'
        );
        // Refresh data
        await fetchShopsWithSessions();
        if (selectedShop === shopDomain) {
          await fetchShopSessions(shopDomain);
        }
      } else {
        throw new Error(response.error || 'Failed to refresh shop sessions');
      }
    } catch (error) {
      addNotification(
        error instanceof Error ? error.message : 'Failed to refresh shop sessions',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  }, [addNotification, selectedShop, fetchShopsWithSessions, fetchShopSessions, actionLoading, shopRefreshCooldowns]);

  const handleInvalidateShopSessions = useCallback(async (shopDomain: string) => {
    setActionLoading(`invalidate-${shopDomain}`);
    try {
      const response = await invalidateAdminShopSessions(shopDomain);
      if (response.success) {
        addNotification(
          `Invalidated all ${response.invalidatedSessions} sessions for ${shopDomain}`,
          'success'
        );
        // Refresh data
        await fetchShopsWithSessions();
        if (selectedShop === shopDomain) {
          setShowShopDetails(false);
          setSelectedShop(null);
          setShopSessions([]);
        }
      } else {
        throw new Error(response.error || 'Failed to invalidate shop sessions');
      }
    } catch (error) {
      addNotification(
        error instanceof Error ? error.message : 'Failed to invalidate shop sessions',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  }, [addNotification, selectedShop, fetchShopsWithSessions]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'refresh') {
      await handleRefreshShopSessions(confirmAction.shopDomain);
    } else if (confirmAction.type === 'invalidate') {
      await handleInvalidateShopSessions(confirmAction.shopDomain);
    }

    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, [confirmAction, handleRefreshShopSessions, handleInvalidateShopSessions]);

  // Debounced refresh functions - defined after all handlers
  const debouncedHealthRefresh = useCallback(() => {
    if (healthRefreshTimeoutRef.current) {
      clearTimeout(healthRefreshTimeoutRef.current);
    }
    
    healthRefreshTimeoutRef.current = setTimeout(async () => {
      if (healthRefreshCooldown > 0) return;
      
      setHealthRefreshCooldown(HEALTH_REFRESH_COOLDOWN);
      await fetchSessionHealth(true); // Show notification for user-triggered refresh
    }, DEBOUNCE_DELAY);
  }, [healthRefreshCooldown, fetchSessionHealth]);

  const debouncedShopsRefresh = useCallback(() => {
    if (shopsRefreshTimeoutRef.current) {
      clearTimeout(shopsRefreshTimeoutRef.current);
    }
    
    shopsRefreshTimeoutRef.current = setTimeout(async () => {
      if (shopsRefreshCooldown > 0) return;
      
      setShopsRefreshCooldown(SHOPS_REFRESH_COOLDOWN);
      await fetchShopsWithSessions();
    }, DEBOUNCE_DELAY);
  }, [shopsRefreshCooldown, fetchShopsWithSessions]);

  const debouncedShopRefresh = useCallback((shopDomain: string) => {
    if (shopRefreshTimeoutsRef.current[shopDomain]) {
      clearTimeout(shopRefreshTimeoutsRef.current[shopDomain]);
    }
    
    shopRefreshTimeoutsRef.current[shopDomain] = setTimeout(async () => {
      const currentCooldown = shopRefreshCooldowns[shopDomain] || 0;
      if (currentCooldown > 0) return;
      
      setShopRefreshCooldowns(prev => ({
        ...prev,
        [shopDomain]: SHOP_REFRESH_COOLDOWN
      }));
      
      await handleRefreshShopSessions(shopDomain);
    }, DEBOUNCE_DELAY);
  }, [shopRefreshCooldowns, handleRefreshShopSessions]);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getDeviceIcon = (userAgent: string | null | undefined) => {
    if (!userAgent) {
      return <ComputerIcon />; // Default icon for unknown/null user agent
    }
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile')) return <PhoneIcon />;
    if (ua.includes('tablet')) return <TabletIcon />;
    return <DesktopIcon />;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusIcon = (isActive: boolean, isExpired: boolean) => {
    if (isExpired) return <ErrorIcon color="error" />;
    if (isActive) return <CheckCircleIcon color="success" />;
    return <WarningIcon color="warning" />;
  };

  // Update lastUpdated on successful fetch
  const fetchSessionHealthWithUpdate = useCallback(async () => {
    await fetchSessionHealth(true); // Show notification for user-triggered refresh
    setSessionHealthLastUpdated(new Date());
  }, [fetchSessionHealth]);
  
  const fetchShopsWithSessionsWithUpdate = useCallback(async () => {
    await fetchShopsWithSessions();
    setShopsLastUpdated(new Date());
  }, [fetchShopsWithSessions]);

  // Initialize data on component mount only (no notifications)
  useEffect(() => {
    fetchSessionHealth(false); // No notification for initial load
    fetchShopsWithSessions();
  }, []); // Empty dependency array to run only on mount

  return (
    <Box>
      {/* Session Health Overview */}
      <StyledCard sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MonitorHeartIcon color="primary" />
              Session Health Overview
            </Typography>
            <RefreshHeader
              lastUpdated={sessionHealthLastUpdated ? (() => {
                const diff = Math.floor((Date.now() - sessionHealthLastUpdated.getTime()) / 1000);
                if (diff < 60) return 'Just now';
                if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
                return sessionHealthLastUpdated.toLocaleString();
              })() : 'Never'}
              onRefresh={fetchSessionHealthWithUpdate}
              loading={healthLoading}
              cooldown={healthRefreshCooldown > 0}
              cooldownRemaining={healthRefreshCooldown}
              label="Refresh Health"
              tooltip="Refresh session health metrics"
            />
          </Box>

                     {sessionHealth ? (
             <>
               <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3 }}>
                 <MetricCard>
                   <Typography variant="h4" color="primary" fontWeight="bold">
                     {sessionHealth.totalSessions}
                   </Typography>
                   <Typography variant="body2" color="text.secondary">
                     Total Sessions
                   </Typography>
                 </MetricCard>
                 <MetricCard>
                   <Typography variant="h4" color="success.main" fontWeight="bold">
                     {sessionHealth.activeSessions}
                   </Typography>
                   <Typography variant="body2" color="text.secondary">
                     Active Sessions
                   </Typography>
                 </MetricCard>
                 <MetricCard>
                   <Typography variant="h4" color="warning.main" fontWeight="bold">
                     {sessionHealth.expiredSessions}
                   </Typography>
                   <Typography variant="body2" color="text.secondary">
                     Expired Sessions
                   </Typography>
                 </MetricCard>
                 <MetricCard>
                   <Typography variant="h4" color="info.main" fontWeight="bold">
                     {sessionHealth.uniqueShops}
                   </Typography>
                   <Typography variant="body2" color="text.secondary">
                     Active Shops
                   </Typography>
                 </MetricCard>
               </Box>

               {/* Health Score */}
               <Box sx={{ mt: 3 }}>
                 <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                   <Typography variant="h6" fontWeight="bold">
                     System Health Score
                   </Typography>
                   <Chip
                     label={`${sessionHealth.healthScore}%`}
                     color={getHealthColor(sessionHealth.healthScore) as any}
                     variant="filled"
                     size="small"
                   />
                 </Box>
                 <LinearProgress
                   variant="determinate"
                   value={sessionHealth.healthScore}
                   color={getHealthColor(sessionHealth.healthScore) as any}
                   sx={{ height: 8, borderRadius: 4 }}
                 />
               </Box>

               {/* Recommendations */}
               {sessionHealth.recommendations.length > 0 && (
                 <Box sx={{ mt: 3 }}>
                   <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                     Recommendations
                   </Typography>
                   <List dense>
                     {sessionHealth.recommendations.map((rec, index) => (
                       <ListItem key={index} sx={{ px: 0 }}>
                         <ListItemIcon>
                           <InfoIcon color="info" />
                         </ListItemIcon>
                         <ListItemText primary={rec} />
                       </ListItem>
                     ))}
                   </List>
                 </Box>
               )}
             </>
           ) : (
             <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
               <CircularProgress />
             </Box>
           )}
        </CardContent>
      </StyledCard>

      {/* Shops with Sessions */}
      <StyledCard>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StoreIcon color="primary" />
              Shops with Active Sessions
            </Typography>
            <RefreshHeader
              lastUpdated={shopsLastUpdated ? (() => {
                const diff = Math.floor((Date.now() - shopsLastUpdated.getTime()) / 1000);
                if (diff < 60) return 'Just now';
                if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
                return shopsLastUpdated.toLocaleString();
              })() : 'Never'}
              onRefresh={fetchShopsWithSessionsWithUpdate}
              loading={shopsLoading}
              cooldown={shopsRefreshCooldown > 0}
              cooldownRemaining={shopsRefreshCooldown}
              label="Refresh Shops"
              tooltip="Refresh shops with sessions"
            />
          </Box>

          {shopsWithSessions.length > 0 ? (
            <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Shop Domain</strong></TableCell>
                    <TableCell align="center"><strong>Total Sessions</strong></TableCell>
                    <TableCell align="center"><strong>Active Sessions</strong></TableCell>
                    <TableCell align="center"><strong>Expired Sessions</strong></TableCell>
                    <TableCell align="center"><strong>Last Activity</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shopsWithSessions.map((shop) => (
                    <TableRow key={shop.shopDomain} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {shop.shopDomain}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={shop.totalSessions}
                          color="primary"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={shop.activeSessions}
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={shop.expiredSessions}
                          color="warning"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="text.secondary">
                          {formatTimestamp(shop.lastActivity)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="View Sessions">
                            <IconButton
                              size="small"
                              onClick={() => fetchShopSessions(shop.shopDomain)}
                              disabled={sessionsLoading}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Refresh Sessions">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                const currentCooldown = shopRefreshCooldowns[shop.shopDomain] || 0;
                                if (currentCooldown > 0) {
                                  addNotification(`Please wait ${currentCooldown}s before refreshing ${shop.shopDomain} again`, 'warning');
                                  return;
                                }
                                setConfirmAction({ type: 'refresh', shopDomain: shop.shopDomain });
                                setShowConfirmDialog(true);
                              }}
                              disabled={actionLoading === `refresh-${shop.shopDomain}` || (shopRefreshCooldowns[shop.shopDomain] || 0) > 0}
                            >
                              {actionLoading === `refresh-${shop.shopDomain}` ? (
                                <CircularProgress size={16} />
                              ) : (shopRefreshCooldowns[shop.shopDomain] || 0) > 0 ? (
                                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                  {shopRefreshCooldowns[shop.shopDomain]}s
                                </Typography>
                              ) : (
                                <RestartAltIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Invalidate All Sessions">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setConfirmAction({ type: 'invalidate', shopDomain: shop.shopDomain });
                                setShowConfirmDialog(true);
                              }}
                              disabled={actionLoading === `invalidate-${shop.shopDomain}`}
                            >
                              {actionLoading === `invalidate-${shop.shopDomain}` ? (
                                <CircularProgress size={16} />
                              ) : (
                                <BlockIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No shops with active sessions found
              </Typography>
            </Box>
          )}
        </CardContent>
      </StyledCard>

      {/* Shop Sessions Details Dialog */}
      <Dialog
        open={showShopDetails}
        onClose={() => setShowShopDetails(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StoreIcon color="primary" />
            Sessions for {selectedShop}
          </Box>
        </DialogTitle>
        <DialogContent>
          {shopSessions.length > 0 ? (
            <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Session ID</strong></TableCell>
                    <TableCell align="center"><strong>Device</strong></TableCell>
                    <TableCell align="center"><strong>IP Address</strong></TableCell>
                    <TableCell align="center"><strong>Created</strong></TableCell>
                    <TableCell align="center"><strong>Last Accessed</strong></TableCell>
                    <TableCell align="center"><strong>Status</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shopSessions.map((session) => (
                    <TableRow key={session.sessionId} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                          {session.sessionId.substring(0, 20)}...
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={session.userAgent}>
                          <IconButton size="small">
                            {getDeviceIcon(session.userAgent)}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontFamily="monospace">
                          {session.ipAddress}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="text.secondary">
                          {formatTimestamp(session.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="text.secondary">
                          {formatTimestamp(session.lastAccessedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {getStatusIcon(session.isActive, session.isExpired)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No sessions found for this shop
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowShopDetails(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>
          Confirm Action
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {confirmAction?.type === 'refresh' ? 'refresh' : 'invalidate all'} sessions for{' '}
            <strong>{confirmAction?.shopDomain}</strong>?
          </Typography>
          {confirmAction?.type === 'invalidate' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This will force logout all users from this shop immediately.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmAction?.type === 'invalidate' ? 'error' : 'primary'}
            variant="contained"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminSessionManager; 