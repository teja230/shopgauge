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
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';

interface SessionSyncStatus {
  sessionId: string;
  isInvalidating: boolean;
  shouldAllowOperation: boolean;
}

interface SessionManagementToolsProps {
  onClearStuckSession: (sessionId: string) => Promise<void>;
  onEmergencySessionCleanup: () => Promise<void>;
  onCheckSessionSyncStatus: (sessionId: string) => Promise<SessionSyncStatus | null>;
  onRefreshSessionSyncStatus: () => Promise<void>;
}

const SessionManagementTools: React.FC<SessionManagementToolsProps> = ({
  onClearStuckSession,
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
  const [sessionSyncRefreshCooldown, setSessionSyncRefreshCooldown] = useState(0);
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

  const handleEmergencySessionCleanup = async () => {
    setEmergencySessionCleanupLoading(true);
    try {
      await onEmergencySessionCleanup();
      addNotification('Emergency session cleanup completed', 'success');
    } catch (error) {
      addNotification('Emergency session cleanup failed', 'error');
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
      const result = await onCheckSessionSyncStatus(sessionId);
      if (isMountedRef.current) {
        setSessionSyncStatus(result);
        if (result) {
          addNotification('Session status retrieved successfully', 'success');
        } else {
          addNotification('Session not found or invalid', 'warning');
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        setSessionSyncStatus(null);
        addNotification('Failed to check session status', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setSessionSyncStatusLoading(false);
      }
    }
  };

  const handleRefreshSessionSyncStatus = async () => {
    // Prevent refresh if already loading, in cooldown, or component unmounted
    if (sessionSyncStatusLoading || sessionSyncRefreshCooldown > 0 || !isMountedRef.current) {
      return;
    }

    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Debounce the refresh with 300ms delay
    refreshTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;

      setSessionSyncStatusLoading(true);
      try {
        // Set cooldown to prevent rapid successive calls
        setSessionSyncRefreshCooldown(30); // 30 second cooldown

        // Call the parent refresh handler
        await onRefreshSessionSyncStatus();
        
        // Refresh current session status if available
        if (sessionSyncStatus && sessionSyncStatus.sessionId) {
          await handleCheckSessionSyncStatus(sessionSyncStatus.sessionId);
        } else if (manualSessionId.trim()) {
          await handleCheckSessionSyncStatus(manualSessionId.trim());
        }
        
        addNotification('Session sync status refreshed', 'success');
      } catch (error) {
        addNotification('Failed to refresh session sync status', 'error');
      } finally {
        if (isMountedRef.current) {
          setSessionSyncStatusLoading(false);
        }
      }
    }, 300); // 300ms debounce delay
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
                Stuck Session Management
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
                Clear stuck session markers and resolve invalidation loops
              </Typography>
              
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => handleClearStuckSession('88f94376-48fb-4cee-974f-d3dfcb2f2793')}
                  disabled={stuckSessionLoading}
                  startIcon={stuckSessionLoading ? <CircularProgress size={16} /> : <ClearIcon />}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                    color: 'white'
                  }}
                >
                  {stuckSessionLoading ? 'Clearing...' : 'Clear Stuck Session'}
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

        {/* Session Synchronization Status */}
        <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MonitorHeartIcon />
                Session Sync Status
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
                Monitor session synchronization and invalidation state
              </Typography>
              
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => handleCheckSessionSyncStatus('88f94376-48fb-4cee-974f-d3dfcb2f2793')}
                  disabled={sessionSyncStatusLoading}
                  startIcon={sessionSyncStatusLoading ? <CircularProgress size={16} /> : <InfoIcon />}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                    color: 'white'
                  }}
                >
                  {sessionSyncStatusLoading ? 'Checking...' : 'Check Session Status'}
                </Button>
                
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleRefreshSessionSyncStatus}
                  disabled={sessionSyncStatusLoading || sessionSyncRefreshCooldown > 0}
                  startIcon={sessionSyncStatusLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                  sx={{ 
                    color: 'white', 
                    borderColor: 'rgba(255,255,255,0.5)',
                    '&:hover': { 
                      borderColor: 'white',
                      backgroundColor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  {sessionSyncStatusLoading ? 'Refreshing...' : 
                   sessionSyncRefreshCooldown > 0 ? `Wait ${sessionSyncRefreshCooldown}s` : 
                   'Refresh Status'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Session Status Display */}
      {sessionSyncStatus && (
        <Box sx={{ mt: 3 }}>
          <Card sx={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InfoIcon color="primary" />
                Session Synchronization Status
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Session ID
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                      {sessionSyncStatus.sessionId}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Is Invalidating
                    </Typography>
                    <Chip
                      label={sessionSyncStatus.isInvalidating ? 'Yes' : 'No'}
                      color={sessionSyncStatus.isInvalidating ? 'error' : 'success'}
                      size="small"
                    />
                  </Box>
                </Box>
                <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Allow Operations
                    </Typography>
                    <Chip
                      label={sessionSyncStatus.shouldAllowOperation ? 'Yes' : 'No'}
                      color={sessionSyncStatus.shouldAllowOperation ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Session Management Actions */}
      <Box sx={{ mt: 3 }}>
        <Card sx={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon color="primary" />
              Session Management Actions
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Manual Session Input
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter session ID to manage"
                    value={manualSessionId}
                    onChange={(e) => setManualSessionId(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleCheckSessionSyncStatus(manualSessionId)}
                      disabled={!manualSessionId.trim() || sessionSyncStatusLoading}
                      startIcon={<InfoIcon />}
                    >
                      Check Status
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handleClearStuckSession(manualSessionId)}
                      disabled={!manualSessionId.trim() || stuckSessionLoading}
                      startIcon={<ClearIcon />}
                    >
                      Clear Stuck
                    </Button>
                  </Stack>
                </Box>
              </Box>
              
              <Box sx={{ flex: '1 1 400px', minWidth: 0 }}>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Bulk Operations
                  </Typography>
                  <Stack spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleEmergencySessionCleanup}
                      disabled={emergencySessionCleanupLoading}
                      startIcon={emergencySessionCleanupLoading ? <CircularProgress size={16} /> : <RestartAltIcon />}
                      fullWidth
                    >
                      {emergencySessionCleanupLoading ? 'Emergency Cleanup...' : 'Emergency Session Cleanup'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleRefreshSessionSyncStatus}
                      disabled={sessionSyncStatusLoading || sessionSyncRefreshCooldown > 0}
                      startIcon={sessionSyncStatusLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                      fullWidth
                    >
                      {sessionSyncStatusLoading ? 'Refreshing...' : 
                       sessionSyncRefreshCooldown > 0 ? `Wait ${sessionSyncRefreshCooldown}s` : 
                       'Refresh All Status'}
                    </Button>
                  </Stack>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default SessionManagementTools; 