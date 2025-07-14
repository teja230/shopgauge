import React, { useState, useEffect, useCallback } from 'react';
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
  userAgent: string;
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

  const fetchSessionHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const response = await getAdminSessionHealth();
      if (response.success) {
        setSessionHealth(response);
        addNotification('Session health data updated successfully', 'success');
      } else {
        throw new Error(response.error || 'Failed to fetch session health');
      }
    } catch (error) {
      addNotification(
        error instanceof Error ? error.message : 'Failed to fetch session health',
        'error'
      );
    } finally {
      setHealthLoading(false);
    }
  }, [addNotification]);

  const fetchShopsWithSessions = useCallback(async () => {
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
  }, [addNotification]);

  const fetchShopSessions = useCallback(async (shopDomain: string) => {
    setSessionsLoading(true);
    try {
      const response = await getAdminShopSessions(shopDomain);
      if (response.success) {
        setShopSessions(response.sessions || []);
        setSelectedShop(shopDomain);
        setShowShopDetails(true);
      } else {
        throw new Error(response.error || 'Failed to fetch shop sessions');
      }
    } catch (error) {
      addNotification(
        error instanceof Error ? error.message : 'Failed to fetch shop sessions',
        'error'
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [addNotification]);

  const handleRefreshShopSessions = useCallback(async (shopDomain: string) => {
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
  }, [addNotification, selectedShop, fetchShopsWithSessions, fetchShopSessions]);

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

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getDeviceIcon = (userAgent: string) => {
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

  useEffect(() => {
    fetchSessionHealth();
    fetchShopsWithSessions();
  }, [fetchSessionHealth, fetchShopsWithSessions]);

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
            <ActionButton
              variant="outlined"
              onClick={fetchSessionHealth}
              disabled={healthLoading}
              startIcon={healthLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              Refresh Health
            </ActionButton>
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
            <ActionButton
              variant="outlined"
              onClick={fetchShopsWithSessions}
              disabled={shopsLoading}
              startIcon={shopsLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              Refresh Shops
            </ActionButton>
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
                                setConfirmAction({ type: 'refresh', shopDomain: shop.shopDomain });
                                setShowConfirmDialog(true);
                              }}
                              disabled={actionLoading === `refresh-${shop.shopDomain}`}
                            >
                              {actionLoading === `refresh-${shop.shopDomain}` ? (
                                <CircularProgress size={16} />
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