/**
 * Enterprise SSE Hook
 * 
 * Production-ready React hook for SSE handling with:
 * - Integration with existing authentication system
 * - Automatic cleanup on logout/tab close
 * - Rate limiting and polling fallback
 * - Comprehensive error handling
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from './useNotifications';
import { clearAllSessionCookies } from '../utils/sessionUtils';
import {
  EnterpriseSseHandler,
  createSessionSseHandler,
  type SseEvent,
  type SseConnectionState,
  type SseMetrics,
  type SseEventHandler
} from '../utils/enterpriseSseHandler';

interface UseEnterpriseSseOptions {
  autoConnect?: boolean;
  enableNotifications?: boolean;
  enableDebug?: boolean;
  pollingFallbackEnabled?: boolean;
  pollingInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

interface UseEnterpriseSseReturn {
  sseHandler: EnterpriseSseHandler | null;
  connectionState: SseConnectionState | null;
  metrics: SseMetrics | null;
  isConnected: boolean;
  isReconnecting: boolean;
  isPolling: boolean;
  isRateLimited: boolean;
  connect: () => void;
  disconnect: () => void;
  destroy: () => void;
  resetMetrics: () => void;
}

export const useEnterpriseSse = (
  options: UseEnterpriseSseOptions = {}
): UseEnterpriseSseReturn => {
  const {
    autoConnect = true,
    enableNotifications = true,
    enableDebug = false,
    pollingFallbackEnabled = true,
    pollingInterval = 5000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000
  } = options;

  const { isAuthenticated, shop } = useAuth();
  const { addNotification } = useNotifications();
  
  const [sseHandler, setSseHandler] = useState<EnterpriseSseHandler | null>(null);
  const [connectionState, setConnectionState] = useState<SseConnectionState | null>(null);
  const [metrics, setMetrics] = useState<SseMetrics | null>(null);
  
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Create SSE event handlers
  const createEventHandlers = useCallback((): SseEventHandler => ({
    onConnect: (event) => {
      if (enableDebug) {
        console.log('[EnterpriseSSE] Connected', event);
      }
      
      if (enableNotifications) {
        addNotification('Real-time connection established', 'success', {
          duration: 3000,
          category: 'Connection'
        });
      }
    },

    onMessage: (sseEvent: SseEvent) => {
      if (enableDebug) {
        console.log('[EnterpriseSSE] Message received', sseEvent);
      }

      // Handle specific event types
      switch (sseEvent.type) {
        case 'session_invalidated':
          if (enableNotifications) {
            addNotification('Session invalidated by server', 'error', {
              persistent: true,
              category: 'Authentication',
              action: {
                label: 'Logout',
                onClick: () => handleSessionLogout()
              }
            });
          }
          handleSessionLogout();
          break;

        case 'session_expired':
          if (enableNotifications) {
            addNotification('Session expired', 'warning', {
              persistent: true,
              category: 'Authentication'
            });
          }
          break;

        case 'session_extended':
          if (enableNotifications) {
            addNotification('Session extended successfully', 'success', {
              duration: 3000,
              category: 'Authentication'
            });
          }
          break;

        case 'rate_limited':
          if (enableNotifications) {
            addNotification('Rate limited - switching to polling', 'warning', {
              duration: 5000,
              category: 'Connection'
            });
          }
          break;

        case 'heartbeat':
          // Heartbeat events are handled silently
          break;

        default:
          if (enableDebug) {
            console.log('[EnterpriseSSE] Unknown event type:', sseEvent.type);
          }
      }
    },

    onError: (error) => {
      console.error('[EnterpriseSSE] Connection error', error);
      
      if (enableNotifications) {
        addNotification('Connection error - attempting to reconnect', 'warning', {
          duration: 5000,
          category: 'Connection'
        });
      }
    },

    onReconnect: (attempt) => {
      if (enableDebug) {
        console.log('[EnterpriseSSE] Reconnecting', { attempt });
      }
      
      if (enableNotifications && attempt > 3) {
        addNotification(`Reconnecting... (attempt ${attempt})`, 'info', {
          duration: 3000,
          category: 'Connection'
        });
      }
    },

    onDisconnect: (reason) => {
      if (enableDebug) {
        console.log('[EnterpriseSSE] Disconnected', { reason });
      }
      
      if (enableNotifications) {
        addNotification(`Connection lost: ${reason}`, 'warning', {
          duration: 5000,
          category: 'Connection'
        });
      }
    },

    onHeartbeat: () => {
      if (enableDebug) {
        console.log('[EnterpriseSSE] Heartbeat');
      }
    },

    onRateLimited: (until) => {
      if (enableDebug) {
        console.log('[EnterpriseSSE] Rate limited until', until);
      }
      
      if (enableNotifications) {
        const minutes = Math.ceil((until.getTime() - Date.now()) / 60000);
        addNotification(`Rate limited for ${minutes} minutes`, 'warning', {
          duration: 5000,
          category: 'Connection'
        });
      }
    },

    onPollingStart: () => {
      if (enableDebug) {
        console.log('[EnterpriseSSE] Polling fallback started');
      }
      
      if (enableNotifications) {
        addNotification('Switched to polling mode', 'info', {
          duration: 3000,
          category: 'Connection'
        });
      }
    },

    onPollingStop: () => {
      if (enableDebug) {
        console.log('[EnterpriseSSE] Polling fallback stopped');
      }
      
      if (enableNotifications) {
        addNotification('Resumed real-time connection', 'success', {
          duration: 3000,
          category: 'Connection'
        });
      }
    }
  }), [enableDebug, enableNotifications, addNotification]);

  // Handle session logout
  const handleSessionLogout = useCallback(() => {
    if (enableDebug) {
      console.log('[EnterpriseSSE] Handling session logout');
    }
    
    // Clean up SSE connection
    if (sseHandler) {
      sseHandler.destroy();
      setSseHandler(null);
    }
    
    // Clear authentication state
    clearAllSessionCookies();
  }, [sseHandler, clearAllSessionCookies, enableDebug]);

  // Initialize SSE handler
  useEffect(() => {
    if (!isAuthenticated || !shop || isInitializedRef.current) {
      return;
    }

    if (enableDebug) {
      console.log('[EnterpriseSSE] Initializing SSE handler', { shop });
    }

    const handlers = createEventHandlers();
    
    const handler = createSessionSseHandler(shop, handlers);
    setSseHandler(handler);
    isInitializedRef.current = true;

    // Auto-connect if enabled
    if (autoConnect) {
      handler.connect();
    }

    // Cleanup on unmount
    return () => {
      if (enableDebug) {
        console.log('[EnterpriseSSE] Cleaning up SSE handler');
      }
      
      handler.destroy();
      setSseHandler(null);
      isInitializedRef.current = false;
    };
  }, [isAuthenticated, shop, autoConnect, createEventHandlers, enableDebug]);

  // Update connection state and metrics periodically
  useEffect(() => {
    if (!sseHandler) return;

    const updateState = () => {
      setConnectionState(sseHandler.getState());
      setMetrics(sseHandler.getMetrics());
    };

    // Update immediately
    updateState();

    // Set up periodic updates
    stateUpdateIntervalRef.current = setInterval(updateState, 1000);

    return () => {
      if (stateUpdateIntervalRef.current) {
        clearInterval(stateUpdateIntervalRef.current);
        stateUpdateIntervalRef.current = null;
      }
    };
  }, [sseHandler]);

  // Handle authentication state changes
  useEffect(() => {
    if (!isAuthenticated && sseHandler) {
      if (enableDebug) {
        console.log('[EnterpriseSSE] User logged out, destroying SSE handler');
      }
      
      sseHandler.destroy();
      setSseHandler(null);
      setConnectionState(null);
      setMetrics(null);
      isInitializedRef.current = false;
    }
  }, [isAuthenticated, sseHandler, enableDebug]);

  // Connect to SSE
  const connect = useCallback(() => {
    if (!sseHandler) {
      console.warn('[EnterpriseSSE] Cannot connect: no SSE handler available');
      return;
    }
    
    if (enableDebug) {
      console.log('[EnterpriseSSE] Manual connect requested');
    }
    
    sseHandler.connect();
  }, [sseHandler, enableDebug]);

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    if (!sseHandler) {
      console.warn('[EnterpriseSSE] Cannot disconnect: no SSE handler available');
      return;
    }
    
    if (enableDebug) {
      console.log('[EnterpriseSSE] Manual disconnect requested');
    }
    
    sseHandler.disconnect();
  }, [sseHandler, enableDebug]);

  // Destroy SSE handler
  const destroy = useCallback(() => {
    if (!sseHandler) {
      console.warn('[EnterpriseSSE] Cannot destroy: no SSE handler available');
      return;
    }
    
    if (enableDebug) {
      console.log('[EnterpriseSSE] Manual destroy requested');
    }
    
    sseHandler.destroy();
    setSseHandler(null);
    setConnectionState(null);
    setMetrics(null);
    isInitializedRef.current = false;
  }, [sseHandler, enableDebug]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    if (!sseHandler) {
      console.warn('[EnterpriseSSE] Cannot reset metrics: no SSE handler available');
      return;
    }
    
    if (enableDebug) {
      console.log('[EnterpriseSSE] Resetting metrics');
    }
    
    sseHandler.resetMetrics();
    setMetrics(sseHandler.getMetrics());
  }, [sseHandler, enableDebug]);

  return {
    sseHandler,
    connectionState,
    metrics,
    isConnected: connectionState?.isConnected ?? false,
    isReconnecting: connectionState?.isReconnecting ?? false,
    isPolling: connectionState?.isPolling ?? false,
    isRateLimited: sseHandler?.isRateLimited() ?? false,
    connect,
    disconnect,
    destroy,
    resetMetrics
  };
}; 