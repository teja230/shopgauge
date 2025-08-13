import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Snackbar,
  Typography,
  Button,
  Chip,
  Stack,
  LinearProgress,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  WifiOff as OfflineIcon,
  Wifi as OnlineIcon,
  SignalWifiOff as PoorConnectionIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Types
interface NetworkStatus {
  online: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NetworkStatusHandlerProps {
  onNetworkChange?: (status: NetworkStatus) => void;
  showPersistentIndicator?: boolean;
  showConnectionQuality?: boolean;
  autoRetry?: boolean;
  retryInterval?: number;
}

// Styled Components
const NetworkIndicator = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 80, // Below header
  right: 16,
  zIndex: theme.zIndex.snackbar,
  minWidth: 300,
  maxWidth: 400,
}));

const ConnectionQualityChip = styled(Chip)<{ quality: 'good' | 'fair' | 'poor' }>(({ theme, quality }) => ({
  fontSize: '0.75rem',
  height: 24,
  ...(quality === 'good' && {
    backgroundColor: theme.palette.success.light + '20',
    color: theme.palette.success.dark,
    border: `1px solid ${theme.palette.success.light}`,
  }),
  ...(quality === 'fair' && {
    backgroundColor: theme.palette.warning.light + '20',
    color: theme.palette.warning.dark,
    border: `1px solid ${theme.palette.warning.light}`,
  }),
  ...(quality === 'poor' && {
    backgroundColor: theme.palette.error.light + '20',
    color: theme.palette.error.dark,
    border: `1px solid ${theme.palette.error.light}`,
  }),
}));

// Network quality assessment
const getConnectionQuality = (status: NetworkStatus): 'good' | 'fair' | 'poor' => {
  if (!status.online) return 'poor';
  
  const { effectiveType, downlink, rtt } = status;
  
  // Use effective connection type if available
  if (effectiveType) {
    if (effectiveType === '4g' || effectiveType === '5g') return 'good';
    if (effectiveType === '3g') return 'fair';
    return 'poor';
  }
  
  // Use downlink and RTT if available
  if (downlink !== undefined && rtt !== undefined) {
    if (downlink > 2 && rtt < 100) return 'good';
    if (downlink > 0.5 && rtt < 300) return 'fair';
    return 'poor';
  }
  
  // Default to good if online but no detailed info
  return 'good';
};

// Format connection info
const formatConnectionInfo = (status: NetworkStatus) => {
  const info = [];
  
  if (status.effectiveType) {
    info.push(`Type: ${status.effectiveType.toUpperCase()}`);
  }
  
  if (status.downlink !== undefined) {
    info.push(`Speed: ${status.downlink.toFixed(1)} Mbps`);
  }
  
  if (status.rtt !== undefined) {
    info.push(`Latency: ${status.rtt}ms`);
  }
  
  if (status.saveData) {
    info.push('Data Saver: ON');
  }
  
  return info;
};

// Custom hook for network status (internal)
const useNetworkStatusInternal = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    online: navigator.onLine,
  });
  
  const updateNetworkStatus = useCallback(() => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    const newStatus: NetworkStatus = {
      online: navigator.onLine,
      ...(connection && {
        connectionType: connection.type,
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      }),
    };
    
    setStatus(newStatus);
    return newStatus;
  }, []);
  
  useEffect(() => {
    const handleOnline = () => updateNetworkStatus();
    const handleOffline = () => updateNetworkStatus();
    const handleConnectionChange = () => updateNetworkStatus();
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen for connection changes if supported
    const connection = (navigator as any).connection;
    if (connection && typeof connection.addEventListener === 'function') {
      connection.addEventListener('change', handleConnectionChange);
    }
    
    // Initial status
    updateNetworkStatus();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [updateNetworkStatus]);
  
  return status;
};

// Retry mechanism hook
const useAutoRetry = (enabled: boolean, interval: number, onRetry: () => void) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  useEffect(() => {
    if (!enabled || retryCount === 0) return;
    
    setIsRetrying(true);
    const timer = setTimeout(() => {
      onRetry();
      setIsRetrying(false);
    }, interval);
    
    return () => clearTimeout(timer);
  }, [enabled, retryCount, interval, onRetry]);
  
  const triggerRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
  }, []);
  
  const resetRetry = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);
  
  return { retryCount, isRetrying, triggerRetry, resetRetry };
};

// Main Component
const NetworkStatusHandler: React.FC<NetworkStatusHandlerProps> = ({
  onNetworkChange,
  showPersistentIndicator = false,
  showConnectionQuality = true,
  autoRetry = false,
  retryInterval = 5000,
}) => {
  const networkStatus = useNetworkStatusInternal();
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [showReconnectedAlert, setShowReconnectedAlert] = useState(false);
  const [previousOnlineStatus, setPreviousOnlineStatus] = useState(navigator.onLine);
  const [showDetails, setShowDetails] = useState(false);
  
  // Auto retry functionality
  const { retryCount, isRetrying, triggerRetry, resetRetry } = useAutoRetry(
    autoRetry && !networkStatus.online,
    retryInterval,
    () => {
      // Attempt to reconnect by making a simple fetch request
      fetch('/api/health', { method: 'HEAD' })
        .then(() => {
          console.log('Network connectivity restored');
          resetRetry();
        })
        .catch(() => {
          console.log('Still offline, will retry...');
        });
    }
  );
  
  // Handle network status changes
  useEffect(() => {
    if (onNetworkChange) {
      onNetworkChange(networkStatus);
    }
    
    // Show alerts for status changes
    if (previousOnlineStatus && !networkStatus.online) {
      setShowOfflineAlert(true);
      setShowReconnectedAlert(false);
      if (autoRetry) {
        triggerRetry();
      }
    } else if (!previousOnlineStatus && networkStatus.online) {
      setShowOfflineAlert(false);
      setShowReconnectedAlert(true);
      resetRetry();
      // Auto-hide reconnected alert after 3 seconds
      setTimeout(() => setShowReconnectedAlert(false), 3000);
    }
    
    setPreviousOnlineStatus(networkStatus.online);
  }, [networkStatus, previousOnlineStatus, onNetworkChange, autoRetry, triggerRetry, resetRetry]);
  
  const connectionQuality = getConnectionQuality(networkStatus);
  const connectionInfo = formatConnectionInfo(networkStatus);
  
  const handleRetryNow = () => {
    window.location.reload();
  };
  
  const handleDismissOffline = () => {
    setShowOfflineAlert(false);
  };
  
  return (
    <>
      {/* Persistent Network Indicator */}
      {showPersistentIndicator && (
        <NetworkIndicator>
          <Alert
            severity={networkStatus.online ? 'success' : 'error'}
            variant="outlined"
            icon={networkStatus.online ? <OnlineIcon /> : <OfflineIcon />}
            sx={{
              backgroundColor: networkStatus.online ? 'success.light' + '10' : 'error.light' + '10',
              border: networkStatus.online ? '1px solid' : '2px solid',
              borderColor: networkStatus.online ? 'success.light' : 'error.main',
            }}
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                {showConnectionQuality && networkStatus.online && (
                  <ConnectionQualityChip
                    label={connectionQuality.toUpperCase()}
                    quality={connectionQuality}
                    size="small"
                  />
                )}
                {connectionInfo.length > 0 && (
                  <IconButton
                    size="small"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                )}
              </Stack>
            }
          >
            <AlertTitle sx={{ fontWeight: 600 }}>
              {networkStatus.online ? 'Connected' : 'Offline'}
            </AlertTitle>
            {networkStatus.online ? (
              <Typography variant="body2">
                Network connection is active
                {connectionQuality === 'poor' && ' but may be slow'}
              </Typography>
            ) : (
              <Stack spacing={1}>
                <Typography variant="body2">
                  No internet connection detected
                </Typography>
                {autoRetry && retryCount > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Auto-retry attempt {retryCount}
                      {isRetrying && '...'}
                    </Typography>
                    {isRetrying && (
                      <LinearProgress sx={{ mt: 0.5, height: 4 }} />
                    )}
                  </Box>
                )}
              </Stack>
            )}
            
            {/* Connection Details */}
            <Collapse in={showDetails && connectionInfo.length > 0}>
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  Connection Details:
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {connectionInfo.map((info, index) => (
                    <Typography key={index} variant="caption" color="text.secondary">
                      {info}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            </Collapse>
          </Alert>
        </NetworkIndicator>
      )}
      
      {/* Offline Alert Snackbar */}
      <Snackbar
        open={showOfflineAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert
          severity="error"
          variant="filled"
          icon={<OfflineIcon />}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                size="small"
                onClick={handleRetryNow}
                startIcon={<RefreshIcon />}
              >
                Retry
              </Button>
              <IconButton
                size="small"
                color="inherit"
                onClick={handleDismissOffline}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          }
          sx={{ minWidth: 400 }}
        >
          <AlertTitle>Connection Lost</AlertTitle>
          <Typography variant="body2">
            You're now offline. Some features may not work properly.
          </Typography>
          {autoRetry && (
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              Automatically retrying every {retryInterval / 1000} seconds...
            </Typography>
          )}
        </Alert>
      </Snackbar>
      
      {/* Reconnected Alert Snackbar */}
      <Snackbar
        open={showReconnectedAlert}
        autoHideDuration={3000}
        onClose={() => setShowReconnectedAlert(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert
          severity="success"
          variant="filled"
          icon={<OnlineIcon />}
          onClose={() => setShowReconnectedAlert(false)}
        >
          <AlertTitle>Connection Restored</AlertTitle>
          You're back online! All features are now available.
        </Alert>
      </Snackbar>
    </>
  );
};

// Hook for components to use network status
export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    online: navigator.onLine,
  });
  
  useEffect(() => {
    const updateStatus = () => {
      const connection = (navigator as any).connection;
      setStatus({
        online: navigator.onLine,
        ...(connection && {
          connectionType: connection.type,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        }),
      });
    };
    
    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const connection = (navigator as any).connection;
    if (connection && typeof connection.addEventListener === 'function') {
      connection.addEventListener('change', updateStatus);
    }
    
    updateStatus();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, []);
  
  return status;
};

export default NetworkStatusHandler;