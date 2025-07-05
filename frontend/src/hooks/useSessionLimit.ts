import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { fetchWithAuth } from '../api';
import { useNotifications } from './useNotifications';

// Cache duration for session limit data (5 minutes)
const SESSION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 2000; // 2 seconds base delay
const FAILURE_COOLDOWN_PERIOD = 10 * 60 * 1000; // 10 minutes cooldown after max retries

interface SessionInfo {
  sessionId: string;
  isCurrentSession: boolean;
  createdAt: string;
  lastAccessedAt: string;
  lastUsedFormatted?: string;
  ipAddress: string;
  userAgent: string;
  isExpired: boolean;
  expiresAt?: string;
}

interface SessionLimitResponse {
  limitReached: boolean;
  maxSessions: number;
  currentSessionCount: number;
  shop: string;
  currentSessionId: string;
  sessions: SessionInfo[];
  success: boolean;
  error?: string;
}

interface UseSessionLimitReturn {
  sessionLimitData: SessionLimitResponse | null;
  loading: boolean;
  error: string | null;
  showSessionDialog: boolean;
  lastChecked: Date | null;
  checkSessionLimit: () => Promise<SessionLimitResponse | null>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  deleteSessions: (sessionIds: string[]) => Promise<{ success: number; failed: number }>;
  closeSessionDialog: () => void;
  openSessionDialog: () => void;
  canProceedWithLogin: () => boolean;
  refreshSessionData: () => Promise<void>;
}

export const useSessionLimit = (): UseSessionLimitReturn => {
  const [sessionLimitData, setSessionLimitData] = useState<SessionLimitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);
  const [lastFailureTime, setLastFailureTime] = useState<number | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);

  const notifications = useNotifications();

  // Cache management
  const getCacheKey = () => 'session_limit_cache';
  
  const loadFromCache = (): SessionLimitResponse | null => {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > SESSION_CACHE_DURATION;
      
      if (isExpired) {
        localStorage.removeItem(getCacheKey());
        return null;
      }
      
      // Update states from cache
      setLastChecked(new Date(timestamp));
      return data;
    } catch (error) {
      console.warn('Failed to load session limit from cache:', error);
      localStorage.removeItem(getCacheKey());
      return null;
    }
  };
  
  const saveToCache = (data: SessionLimitResponse) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
      setLastChecked(new Date());
    } catch (error) {
      console.warn('Failed to save session limit to cache:', error);
    }
  };

  // Check if we're in a cooldown period after failures
  const isInCooldownPeriod = (): boolean => {
    if (!lastFailureTime) return false;
    return Date.now() - lastFailureTime < FAILURE_COOLDOWN_PERIOD;
  };

  const checkSessionLimit = useCallback(async (retryCount = 0): Promise<SessionLimitResponse | null> => {
    // Prevent overlapping requests
    if (isRequestInProgress) {
      console.log('🔄 useSessionLimit: Request already in progress, skipping');
      return null;
    }

    // Check cooldown period
    if (isInCooldownPeriod() && retryCount === 0) {
      console.log('⏸️ useSessionLimit: In cooldown period, skipping request');
      setError('Session management temporarily unavailable (cooling down)');
      return null;
    }

    // Check cache first
    const cachedData = loadFromCache();
    if (cachedData && retryCount === 0) {
      console.log('✅ useSessionLimit: Using cached session data');
      setSessionLimitData(cachedData);
      setError(null);
      return cachedData;
    }

    setIsRequestInProgress(true);
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 useSessionLimit: Checking session limit (attempt ${retryCount + 1})`);
      
      const response = await fetchWithAuth('/api/sessions/limit-check', {
        method: 'GET',
      });

      console.log('🔍 useSessionLimit: Response status:', response.status);

      if (response.ok) {
        const data: SessionLimitResponse = await response.json();
        console.log('✅ useSessionLimit: Session limit check successful:', data);
        
        setSessionLimitData(data);
        setError(null);
        setLastFailureTime(null); // Clear failure time on success
        saveToCache(data);
        
        // Automatically show dialog if limit is reached
        if (data.limitReached && data.success) {
          setShowSessionDialog(true);
        }
        
        return data;
      } else if (response.status === 404) {
        console.log('ℹ️ useSessionLimit: Session limit endpoint not available - this is optional');
        
        // Don't show error for 404 - treat as optional feature
        setError(null);
        setLastChecked(new Date());
        setLastFailureTime(null); // Don't treat 404 as a failure for cooldown
        
        return null;
      } else if (response.status === 401) {
        console.log('ℹ️ useSessionLimit: Authentication required - user may not be logged in yet');
        
        // Don't show error for 401 during initial load
        setError(null);
        setLastChecked(new Date());
        setLastFailureTime(null); // Don't treat 401 as a failure for cooldown
        
        return null;
      } else {
        // For other errors, implement retry logic
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount); // Exponential backoff
          console.log(`⏳ useSessionLimit: Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
          
          // Use a promise-based approach instead of recursive setTimeout
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Reset request in progress before retry
          setIsRequestInProgress(false);
          return await checkSessionLimit(retryCount + 1);
        }
        
        const errorMsg = `Session management temporarily unavailable`;
        console.log('⚠️ useSessionLimit: Max retries reached, entering cooldown period');
        
        // Set error and enter cooldown period
        setError(errorMsg);
        setLastChecked(new Date());
        setLastFailureTime(Date.now()); // Start cooldown period
        return null;
      }
    } catch (error) {
      // For network errors, implement retry logic
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
        console.log(`⏳ useSessionLimit: Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
        
        // Use a promise-based approach instead of recursive setTimeout
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reset request in progress before retry
        setIsRequestInProgress(false);
        return await checkSessionLimit(retryCount + 1);
      }
      
      const errorMsg = 'Session management is currently unavailable';
      console.log('ℹ️ useSessionLimit: Network error after max retries - entering cooldown period');
      
      // Don't show toast for network errors - handle gracefully
      setError(errorMsg);
      setLastChecked(new Date());
      setLastFailureTime(Date.now()); // Start cooldown period
      
      return null;
    } finally {
      setLoading(false);
      setIsRequestInProgress(false);
    }
  }, [isRequestInProgress, isInCooldownPeriod]);

  const refreshSessionData = useCallback(async (): Promise<void> => {
    console.log('🔄 useSessionLimit: Force refreshing session data (bypassing cache)');
    
    // Clear cache and failure state to force fresh fetch
    localStorage.removeItem(getCacheKey());
    setLastFailureTime(null); // Clear cooldown period on manual refresh
    
    await checkSessionLimit();
  }, [checkSessionLimit]);

  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetchWithAuth('/api/sessions/terminate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          // Update local session data
          if (sessionLimitData) {
            const updatedSessions = sessionLimitData.sessions.filter(s => s.sessionId !== sessionId);
            const updatedData = {
              ...sessionLimitData,
              sessions: updatedSessions,
              currentSessionCount: updatedSessions.length,
              limitReached: updatedSessions.length >= sessionLimitData.maxSessions
            };
            
            setSessionLimitData(updatedData);
            saveToCache(updatedData); // Update cache
          }
          
          notifications.showSuccess('Session removed successfully', {
            persistent: true,
            category: 'Session Management'
          });
          return true;
        } else {
          notifications.showError(result.error || 'Failed to remove session', {
            persistent: true,
            category: 'Session Management'
          });
          return false;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        notifications.showError(errorData.error || 'Failed to remove session', {
          persistent: true,
          category: 'Session Management'
        });
        return false;
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      notifications.showError('Network error while removing session', {
        persistent: true,
        category: 'Session Management'
      });
      return false;
    }
  }, [sessionLimitData, notifications]);

  const deleteSessions = useCallback(async (sessionIds: string[]): Promise<{ success: number; failed: number }> => {
    let successCount = 0;
    let failedCount = 0;

    try {
      // Delete sessions sequentially to avoid overwhelming the server
      for (const sessionId of sessionIds) {
        try {
          const response = await fetchWithAuth('/api/sessions/terminate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionId }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              successCount++;
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error('Error deleting session:', sessionId, error);
          failedCount++;
        }

        // Small delay between requests to avoid overwhelming the server
        if (sessionIds.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Update local session data after all deletions
      if (sessionLimitData && successCount > 0) {
        const remainingSessionIds = sessionLimitData.sessions
          .map(s => s.sessionId)
          .filter(id => !sessionIds.includes(id) || failedCount > 0);
        
        const updatedSessions = sessionLimitData.sessions.filter(s => remainingSessionIds.includes(s.sessionId));
        const updatedData = {
          ...sessionLimitData,
          sessions: updatedSessions,
          currentSessionCount: updatedSessions.length,
          limitReached: updatedSessions.length >= sessionLimitData.maxSessions
        };
        
        setSessionLimitData(updatedData);
        saveToCache(updatedData); // Update cache
      }

      // Send a single consolidated notification
      if (successCount > 0 && failedCount === 0) {
        notifications.showSuccess(
          successCount === 1 
            ? 'Session removed successfully' 
            : `${successCount} sessions removed successfully`, 
          {
            persistent: true,
            category: 'Session Management'
          }
        );
      } else if (successCount > 0 && failedCount > 0) {
        notifications.showWarning(
          `${successCount} sessions removed, ${failedCount} failed to remove`, 
          {
            persistent: true,
            category: 'Session Management'
          }
        );
      } else if (failedCount > 0) {
        notifications.showError(
          failedCount === 1 
            ? 'Failed to remove session' 
            : `Failed to remove ${failedCount} sessions`, 
          {
            persistent: true,
            category: 'Session Management'
          }
        );
      }

      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error('Error in bulk session deletion:', error);
      notifications.showError('Network error while removing sessions', {
        persistent: true,
        category: 'Session Management'
      });
      return { success: 0, failed: sessionIds.length };
    }
  }, [sessionLimitData, notifications]);

  const closeSessionDialog = useCallback(() => {
    setShowSessionDialog(false);
  }, []);

  const openSessionDialog = useCallback(() => {
    setShowSessionDialog(true);
  }, []);

  const canProceedWithLogin = useCallback((): boolean => {
    if (!sessionLimitData) return true; // Allow if we haven't checked yet
    
    // Can proceed if limit is not reached or if current session already exists
    return !sessionLimitData.limitReached || 
           sessionLimitData.sessions.some(s => s.isCurrentSession);
  }, [sessionLimitData]);

  return {
    sessionLimitData,
    loading,
    error,
    showSessionDialog,
    lastChecked,
    checkSessionLimit,
    deleteSession,
    deleteSessions,
    closeSessionDialog,
    openSessionDialog,
    canProceedWithLogin,
    refreshSessionData,
  };
};

export default useSessionLimit; 