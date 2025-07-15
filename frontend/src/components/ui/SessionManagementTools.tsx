import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Stack,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Clear as ClearIcon,
  RestartAlt as RestartAltIcon,
  MonitorHeart as MonitorHeartIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';

interface SessionSyncStatus {
  sessionId: string;
  isInvalidating: boolean;
  shouldAllowOperation: boolean;
}

interface SessionManagementToolsProps {
  onClearStuckSession: (sessionId: string) => Promise<void>;
  onClearStuckSessionsForShop: (shopDomain: string) => Promise<void>;
  onGetStuckSessions: (shopDomain?: string) => Promise<any>;
  onEmergencySessionCleanup: () => Promise<void>;
  onCheckSessionSyncStatus: (sessionId: string) => Promise<void>;
  onRefreshSessionSyncStatus: () => Promise<void>;
}

const SessionManagementTools: React.FC<SessionManagementToolsProps> = ({
  onClearStuckSession,
  onClearStuckSessionsForShop,
  onGetStuckSessions,
  onEmergencySessionCleanup,
  onCheckSessionSyncStatus,
  onRefreshSessionSyncStatus,
}) => {
  const { addNotification } = useNotifications();
  const isMountedRef = useRef(true);

  // Local state for loading states
  const [stuckSessionLoading, setStuckSessionLoading] = useState(false);
  const [emergencySessionCleanupLoading, setEmergencySessionCleanupLoading] = useState(false);
  const [sessionSyncStatusLoading, setSessionSyncStatusLoading] = useState(false);
  const [sessionSyncStatus, setSessionSyncStatus] = useState<SessionSyncStatus | null>(null);
  const [manualSessionId, setManualSessionId] = useState('');
  const [manualShopDomain, setManualShopDomain] = useState('');
  const [sessionSyncRefreshCooldown, setSessionSyncRefreshCooldown] = useState(0);
  const [stuckSessionsData, setStuckSessionsData] = useState<any>(null);
  const [stuckSessionsLoading, setStuckSessionsLoading] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cooldown timer effect
  useEffect(() => {
    if (sessionSyncRefreshCooldown > 0) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          setSessionSyncRefreshCooldown(sessionSyncRefreshCooldown - 1);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [sessionSyncRefreshCooldown]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Wrapper handlers with local loading states
  const handleClearStuckSession = async (sessionId: string) => {
    if (!sessionId.trim()) return;
    setStuckSessionLoading(true);
    try {
      await onClearStuckSession(sessionId);
      addNotification('Stuck session cleared successfully', 'success');
    } catch (error) {
      addNotification('Failed to clear stuck session', 'error');
    } finally {
      if (isMountedRef.current) {
        setStuckSessionLoading(false);
      }
    }
  };

  const handleClearStuckSessionsForShop = async (shopDomain: string) => {
    if (!shopDomain.trim()) return;
    setStuckSessionLoading(true);
    try {
      await onClearStuckSessionsForShop(shopDomain);
      addNotification(`Stuck sessions cleared for ${shopDomain}`, 'success');
      // Refresh stuck sessions data
      await handleGetStuckSessions(shopDomain);
    } catch (error) {
      addNotification('Failed to clear stuck sessions', 'error');
    } finally {
      if (isMountedRef.current) {
        setStuckSessionLoading(false);
      }
    }
  };

  const handleGetStuckSessions = async (shopDomain?: string) => {
    setStuckSessionsLoading(true);
    try {
      const result = await onGetStuckSessions(shopDomain);
      setStuckSessionsData(result);
      // Success notification is handled by the parent component
    } catch (error) {
      console.error('Error in handleGetStuckSessions:', error);
      addNotification('Failed to get stuck sessions', 'error');
    } finally {
      if (isMountedRef.current) {
        setStuckSessionsLoading(false);
      }
    }
  };

  const handleEmergencySessionCleanup = async () => {
    setEmergencySessionCleanupLoading(true);
    try {
      await onEmergencySessionCleanup();
      addNotification('Emergency session cleanup completed', 'success');
    } catch (error) {
      addNotification('Failed to perform emergency session cleanup', 'error');
    } finally {
      if (isMountedRef.current) {
        setEmergencySessionCleanupLoading(false);
      }
    }
  };

  const handleCheckSessionSyncStatus = async (sessionId: string) => {
    if (!sessionId.trim()) return;
    setSessionSyncStatusLoading(true);
    try {
      await onCheckSessionSyncStatus(sessionId);
      addNotification('Session sync status checked', 'success');
    } catch (error) {
      addNotification('Failed to check session sync status', 'error');
    } finally {
      if (isMountedRef.current) {
        setSessionSyncStatusLoading(false);
      }
    }
  };

  const handleRefreshSessionSyncStatus = async () => {
    if (sessionSyncRefreshCooldown > 0) return;
    setSessionSyncRefreshCooldown(30);
    setSessionSyncStatusLoading(true);
    try {
      await onRefreshSessionSyncStatus();
      addNotification('Session sync status refreshed', 'success');
    } catch (error) {
      addNotification('Failed to refresh session sync status', 'error');
    } finally {
      if (isMountedRef.current) {
        setSessionSyncStatusLoading(false);
      }
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <SecurityIcon color="primary" />
        Session Management Tools
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* Stuck Session Management */}
        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ClearIcon />
                Stuck Session Discovery
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
                Find and clear stuck session markers by shop domain
              </Typography>
              
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => handleGetStuckSessions()}
                  disabled={stuckSessionsLoading}
                  startIcon={stuckSessionsLoading ? <CircularProgress size={16} /> : <SearchIcon />}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                    color: 'white'
                  }}
                >
                  {stuckSessionsLoading ? 'Searching...' : 'Find All Stuck Sessions'}
                </Button>
                
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleEmergencySessionCleanup}
                  disabled={emergencySessionCleanupLoading}
                  startIcon={emergencySessionCleanupLoading ? <CircularProgress size={16} /> : <RestartAltIcon />}
                  sx={{ 
                    color: 'white', 
                    borderColor: 'rgba(255,255,255,0.5)',
                    '&:hover': { 
                      borderColor: 'white',
                      backgroundColor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  {emergencySessionCleanupLoading ? 'Cleaning...' : 'Emergency Session Cleanup'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Session Management Actions */}
        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon color="primary" />
                Session Management Actions
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Shop Domain Input
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Enter shop domain (e.g., mystore.myshopify.com)"
                      value={manualShopDomain}
                      onChange={(e) => setManualShopDomain(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleGetStuckSessions(manualShopDomain)}
                        disabled={!manualShopDomain.trim() || stuckSessionsLoading}
                        startIcon={<SearchIcon />}
                      >
                        Find Stuck Sessions
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => handleClearStuckSessionsForShop(manualShopDomain)}
                        disabled={!manualShopDomain.trim() || stuckSessionLoading}
                        startIcon={<ClearIcon />}
                      >
                        Clear Stuck Sessions
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Display Stuck Sessions Results */}
      {stuckSessionsData && (
        <Box sx={{ mt: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Stuck Sessions Found
              </Typography>
              
              {stuckSessionsData.stuckSessionsByShop ? (
                // All shops view
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Found {stuckSessionsData.totalStuckSessions} stuck sessions across {stuckSessionsData.totalShops} shops
                  </Typography>
                  {Object.entries(stuckSessionsData.stuckSessionsByShop).map(([shopDomain, sessions]: [string, any]) => (
                    <Box key={shopDomain} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {shopDomain} ({sessions.length} stuck sessions)
                      </Typography>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => handleClearStuckSessionsForShop(shopDomain)}
                        disabled={stuckSessionLoading}
                        startIcon={<ClearIcon />}
                        sx={{ mr: 1 }}
                      >
                        Clear All for {shopDomain}
                      </Button>
                      <Box sx={{ mt: 1 }}>
                        {sessions.map((session: any, index: number) => (
                          <Typography key={index} variant="caption" sx={{ display: 'block', fontFamily: 'monospace' }}>
                            {session.key}: {session.value} ({session.type})
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                // Single shop view
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Found {stuckSessionsData.count} stuck sessions for {stuckSessionsData.shopDomain}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => handleClearStuckSessionsForShop(stuckSessionsData.shopDomain)}
                    disabled={stuckSessionLoading}
                    startIcon={<ClearIcon />}
                    sx={{ mb: 2 }}
                  >
                    Clear All for {stuckSessionsData.shopDomain}
                  </Button>
                  <Box>
                    {stuckSessionsData.stuckSessions?.map((session: any, index: number) => (
                      <Typography key={index} variant="caption" sx={{ display: 'block', fontFamily: 'monospace' }}>
                        {session.key}: {session.value} ({session.type})
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default SessionManagementTools; 