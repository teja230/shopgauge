import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface SessionInfo {
  sessionId: string;
  isCurrentSession: boolean;
  createdAt: string;
  lastAccessedAt: string;
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
  closeSessionDialog: () => void;
  openSessionDialog: () => void;
  canProceedWithLogin: () => boolean;
  refreshSessionData: () => Promise<void>;
}

// Cache duration for session limit data (5 minutes)
const SESSION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE = 2000; // 2 seconds base delay

export const useSessionLimit = (): UseSessionLimitReturn => {
  const [sessionLimitData, setSessionLimitData] = useState<SessionLimitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

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

  const checkSessionLimit = useCallback(async (retryCount = 0): Promise<SessionLimitResponse | null> => {
    // Check cache first
    const cachedData = loadFromCache();
    if (cachedData && retryCount === 0) {
      console.log('✅ useSessionLimit: Using cached session data');
      setSessionLimitData(cachedData);
      setError(null);
      return cachedData;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 useSessionLimit: Checking session limit at /api/sessions/limit-check (attempt ${retryCount + 1})`);
      
      const response = await fetch('/api/sessions/limit-check', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('🔍 useSessionLimit: Response status:', response.status);

      if (response.ok) {
        const data: SessionLimitResponse = await response.json();
        console.log('✅ useSessionLimit: Session limit check successful:', data);
        
        setSessionLimitData(data);
        setError(null);
        saveToCache(data);
        
        // Automatically show dialog if limit is reached
        if (data.limitReached && data.success) {
          setShowSessionDialog(true);
        }
        
        return data;
      } else if (response.status === 404) {
        const errorMsg = 'Session limit feature is currently unavailable';
        console.log('ℹ️ useSessionLimit: Session limit endpoint not available - this is optional');
        
        // Don't show error for 404 - treat as optional feature
        setError(null);
        setLastChecked(new Date());
        
        return null;
      } else if (response.status === 401) {
        const errorMsg = 'Authentication required for session management';
        console.log('ℹ️ useSessionLimit: Authentication required - user may not be logged in yet');
        
        // Don't show error for 401 during initial load
        setError(null);
        setLastChecked(new Date());
        
        return null;
      } else {
        // For other errors, implement retry logic
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount); // Exponential backoff
          console.log(`⏳ useSessionLimit: Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
          
          setTimeout(() => {
            checkSessionLimit(retryCount + 1);
          }, delay);
          
          return null;
        }
        
        const errorText = await response.text().catch(() => 'Unknown error');
        const errorMsg = `Session management temporarily unavailable`;
        console.log('⚠️ useSessionLimit: Max retries reached, giving up gracefully');
        
        // Set error but don't show toast - handle gracefully
        setError(errorMsg);
        setLastChecked(new Date());
        return null;
      }
    } catch (error) {
      // For network errors, implement retry logic
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
        console.log(`⏳ useSessionLimit: Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
        
        setTimeout(() => {
          checkSessionLimit(retryCount + 1);
        }, delay);
        
        return null;
      }
      
      const errorMsg = 'Session management is currently unavailable';
      console.log('ℹ️ useSessionLimit: Network error after max retries - handling gracefully');
      
      // Don't show toast for network errors - handle gracefully
      setError(errorMsg);
      setLastChecked(new Date());
      
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSessionData = useCallback(async (): Promise<void> => {
    console.log('🔄 useSessionLimit: Force refreshing session data (bypassing cache)');
    // Clear cache to force fresh fetch
    localStorage.removeItem(getCacheKey());
    await checkSessionLimit();
  }, [checkSessionLimit]);

  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/sessions/terminate', {
        method: 'POST',
        credentials: 'include',
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
          
          toast.success('Session removed successfully');
          return true;
        } else {
          toast.error(result.error || 'Failed to remove session');
          return false;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to remove session');
        return false;
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Network error while removing session');
      return false;
    }
  }, [sessionLimitData]);

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
    closeSessionDialog,
    openSessionDialog,
    canProceedWithLogin,
    refreshSessionData,
  };
};

export default useSessionLimit; 