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
  checkSessionLimit: () => Promise<SessionLimitResponse | null>;
  deleteSession: (sessionId: string) => Promise<boolean>;
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

  const checkSessionLimit = useCallback(async (): Promise<SessionLimitResponse | null> => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 useSessionLimit: Checking session limit at /api/sessions/limit-check');
      
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
        
        // Automatically show dialog if limit is reached
        if (data.limitReached && data.success) {
          setShowSessionDialog(true);
        }
        
        return data;
      } else if (response.status === 404) {
        const errorMsg = 'Session limit endpoint not found - this feature may not be available';
        console.error('❌ useSessionLimit: 404 Not Found - Session limit endpoint not available');
        console.error('❌ This might indicate:', {
          possibleCauses: [
            'Backend controller not properly registered',
            'API routing issue',
            'Session endpoint not accessible',
            'Authentication timing issue'
          ]
        });
        setError(errorMsg);
        return null;
      } else if (response.status === 401) {
        const errorMsg = 'Authentication required - please log in again';
        console.error('❌ useSessionLimit: 401 Unauthorized - User not authenticated');
        console.error('❌ This might indicate:', {
          possibleCauses: [
            'No shop cookie present',
            'Session expired',
            'Authentication not completed',
            'Cookie not being sent with request'
          ]
        });
        setError(errorMsg);
        return null;
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        const errorMsg = `Failed to check session limit: ${response.status} ${errorText}`;
        console.error('❌ useSessionLimit: Failed to check session limit:', response.status);
        console.error('❌ Error details:', errorText);
        setError(errorMsg);
        return null;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error occurred';
      console.error('❌ useSessionLimit: Network error checking session limit:', error);
      console.error('❌ This might indicate:', {
        possibleCauses: [
          'Network connectivity issue',
          'Backend server not responding',
          'CORS issue',
          'Request timeout'
        ]
      });
      
      setError(errorMsg);
      
      // Only show toast error if it's not a network connectivity issue during initial load
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('❌ Network fetch error - not showing toast to avoid user confusion');
      } else {
        toast.error('Failed to check session limit');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSessionData = useCallback(async (): Promise<void> => {
    console.log('🔄 useSessionLimit: Refreshing session data');
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
            setSessionLimitData({
              ...sessionLimitData,
              sessions: updatedSessions,
              currentSessionCount: updatedSessions.length,
              limitReached: updatedSessions.length >= sessionLimitData.maxSessions
            });
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
    checkSessionLimit,
    deleteSession,
    closeSessionDialog,
    openSessionDialog,
    canProceedWithLogin,
    refreshSessionData,
  };
};

export default useSessionLimit; 